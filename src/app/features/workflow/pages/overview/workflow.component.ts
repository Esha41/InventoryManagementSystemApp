import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, Observable, forkJoin, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { LucideAngularModule, Search, ChevronLeft, ChevronRight, Eye, FileEdit, Plus } from 'lucide-angular';
import { WorkflowService } from '@workflow/services/workflow.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto, ApplicationEntityDto } from '@models/backend-user.model';
import { WorkflowDto, BackendWorkflowDto, WorkflowStepDto, WorkflowStepNotifier, WorkflowStepTransitionDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationMap } from '@models/common.types';
import { ProfileDataService } from '@profile/services/profile-data.service';
import { ConfigService } from '@services/config.service';
import { trackById, trackByIndex } from '@utils/trackby.utils';
import { defaultPageSize } from '@constants/app.constants';

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent, ConfirmDialogComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './workflow.component.html',
  styleUrls: ['./workflow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Eye = Eye;
  readonly FileEdit = FileEdit;
  readonly Plus = Plus;
  readonly trackById = trackById;
  readonly trackByIndex = trackByIndex;

  workflows: WorkflowDto[] = [];
  filteredWorkflows: WorkflowDto[] = [];
  searchTerm: string = '';
  statusFilter: 'all' | 'Active' | 'Inactive' = 'all';

  loading = false;
  errorMessage: string | null = null;

  currentPage: number = 1;
  rowsPerPage: number = defaultPageSize;
  readonly rowsPerPageOptions = [5, 10, 20, 50];

  showViewModal = false;
  showDeleteDialog = false;
  workflowToDelete: { id: number; name: string } | null = null;
  selectedWorkflow: BackendWorkflowDto | null = null;

  deleteDialogTitle = '';
  deleteDialogMessage = '';
  deleteDialogDescription = '';
  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string; entity?: ApplicationEntityDto }> = [];
  readonly workflowStatusOptions = [
    { label: 'Active', value: 'Active' as const },
    { label: 'Inactive', value: 'Inactive' as const }
  ];

  hasOpenDropdown = false;
  private mutationObserver?: MutationObserver;
  private positioningInterval?: ReturnType<typeof setInterval>;
  private boundRepositionDropdowns?: () => void;
  private boundHandleDocumentClick?: () => void;
  private destroy$ = new Subject<void>();

  // Super admin check
  isSuperAdmin = false;

  constructor(
    private router: Router,
    private workflowService: WorkflowService,
    private translationService: TranslationService,
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private translate: TranslateService,
    private toastService: ToastService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
    private profileDataService: ProfileDataService
  ) { }

  ngOnInit(): void {
    // Check if user is super admin
    const profileData = this.profileDataService.getFullProfileData();
    this.isSuperAdmin = profileData?.isSuperAdmin || false;

    this.loadWorkflows();
    this.backendUserService.getAllRolesSimple().pipe(takeUntil(this.destroy$)).subscribe({ next: r => { this.roles = r; this.cdr.markForCheck(); }, error: (err) => { this.configService.logError('Failed to load roles', err); this.roles = []; this.cdr.markForCheck(); } });
    this.loadApplicationEntities();

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadApplicationEntities();
      });
  }

  private loadApplicationEntities(): void {
    this.backendUserService.getApplicationEntities().pipe(takeUntil(this.destroy$)).subscribe({
      next: (entities: ApplicationEntityDto[]) => {
        const currentLang = getCurrentLang(this.translate);
        this.allApplicationEntities = (entities || []).map((e: ApplicationEntityDto) => {
          const id = e?.id ?? (e as ApplicationEntityDto & { applicationEntityId?: number }).applicationEntityId ?? 0;
          const localizedName = getLocalizedName(e, currentLang);
          return { id, name: localizedName || String(id), entity: e };
        });
        this.cdr.markForCheck();
      },
      error: (err) => { this.configService.logError('Failed to load application entities', err); this.allApplicationEntities = []; this.cdr.markForCheck(); }
    });
  }

  get totalPages(): number {
    const totalItems = this.filteredWorkflows.length;
    if (totalItems === 0) {
      return 1;
    }
    return Math.ceil(totalItems / this.rowsPerPage);
  }

  private validateCurrentPage(): void {
    const maxPages = this.totalPages;
    if (this.currentPage > maxPages && maxPages > 0) {
      this.currentPage = maxPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.validateCurrentPage();
  }

  getWorkflowType(id: number | string): string {
    if (id === null || id === undefined) {
      return 'Unknown';
    }

    const lang = this.translationService.getCurrentLanguage();
    const typeName = this.workflowService.getWorkflowTypeNameById(id, lang);

    return typeName;
  }
  loadWorkflows(): void {
    this.loading = true;
    this.errorMessage = null;

    this.workflowService.getWorkflows().pipe(takeUntil(this.destroy$)).subscribe({
      next: (workflows) => {
        this.workflows = workflows;
        this.currentPage = 1;
        this.filterWorkflows();
        this.validateCurrentPage();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.translate.get('toast.failedToLoad').pipe(takeUntil(this.destroy$)).subscribe((msg: string) => {
          this.errorMessage = (error instanceof Error ? error.message : String(error)) || msg;
          this.cdr.markForCheck();
        });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  filterWorkflows(): void {
    let filtered = [...this.workflows];

    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(workflow => {
        const workflowName = getLocalizedName(workflow, getCurrentLang(this.translate));
        return workflowName.toLowerCase().includes(searchLower) ||
          workflow.id.toString().includes(this.searchTerm);
      });
    }

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(workflow => workflow.status === this.statusFilter);
    }

    this.filteredWorkflows = filtered;
  }

  setStatusFilter(filter: 'all' | 'Active' | 'Inactive'): void {
    this.statusFilter = filter;
    this.currentPage = 1;
    this.filterWorkflows();
    this.validateCurrentPage();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.filterWorkflows();
    this.validateCurrentPage();
  }

  get paginatedWorkflows(): WorkflowDto[] {
    this.validateCurrentPage();
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.filteredWorkflows.slice(startIndex, startIndex + this.rowsPerPage);
  }

  onPageChange(page: number): void {
    const maxPages = this.totalPages;
    if (page < 1 || page > maxPages || maxPages === 0) {
      return;
    }
    this.currentPage = page;
  }

  onViewDetails(id: number): void {
    this.loading = true;
    this.workflowService.getWorkflowDetailById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: wf => {
        this.selectedWorkflow = wf;
        this.showViewModal = true;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.translate.get('toast.failedToLoadDetails').pipe(takeUntil(this.destroy$)).subscribe((msg: string) => {
          this.errorMessage = (err instanceof Error ? err.message : String(err)) || msg;
          this.cdr.markForCheck();
        });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onEdit(id: number): void {
    this.router.navigate(['/workflow', id, 'edit']);
  }


  onAddWorkflow(): void {
    this.router.navigate(['/workflow/add']);
  }

  onDelete(id: number): void {
    const workflow = this.workflows.find(w => w.id === id);
    if (!workflow) return;

    const workflowName = getLocalizedName(workflow, getCurrentLang(this.translate));
    this.workflowToDelete = { id: workflow.id, name: workflowName };

    this.deleteDialogTitle = this.translate.instant('workflow.deleteConfirmation.title');
    this.deleteDialogMessage = this.translate.instant('workflow.deleteConfirmation.message');
    const workflowLabel = this.translate.instant('workflow.deleteConfirmation.workflow');
    this.deleteDialogDescription = `${workflowLabel}: ${workflowName}`;

    this.showDeleteDialog = true;
  }

  onDeleteConfirm(): void {
    if (!this.workflowToDelete) return;

    const id = this.workflowToDelete.id;
    this.workflowService.deleteWorkflow(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.workflows = this.workflows.filter(w => w.id !== id);
        this.currentPage = 1;
        this.filterWorkflows();
        this.validateCurrentPage();
        this.showDeleteDialog = false;
        this.workflowToDelete = null;
        this.cdr.markForCheck();

        this.translate.get(['toast.success', 'toast.workflowDeleted']).pipe(takeUntil(this.destroy$)).subscribe((translations: TranslationMap) => {
          this.toastService.success(translations['toast.workflowDeleted'], translations['toast.success']);
        });
      },
      error: (error) => {
        this.translate.get(['toast.error', 'toast.failedToDeleteWorkflow']).pipe(takeUntil(this.destroy$)).subscribe((translations: TranslationMap) => {
          const errorMsg = translations['toast.failedToDeleteWorkflow'] || 'Failed to delete workflow';
          this.errorMessage = (error instanceof Error ? error.message : String(error)) || errorMsg;
          this.toastService.error(errorMsg, translations['toast.error']);
        });

        this.showDeleteDialog = false;
        this.workflowToDelete = null;
        this.cdr.markForCheck();
      }
    });
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.workflowToDelete = null;
  }

  getStatusButtonClass(status: string): string {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-300';
      case 'Inactive': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  getWorkflowTypeName(type?: number): string {
    if (type === undefined || type === null) return '-';
    const lang = this.translationService.getCurrentLanguage();
    return this.workflowService.getWorkflowTypeNameById(type, lang);
  }

  getRoleNameById(roleId?: string | null): string {
    if (!roleId) return '';
    const r = this._findRole(roleId);
    return r ? getLocalizedName(r, getCurrentLang(this.translate)) || r.name : String(roleId);
  }

  getEntityNameById(entityId?: number | null): string {
    if (entityId === undefined || entityId === null) return '';
    const e = this.allApplicationEntities.find(x => x.id === entityId);
    if (e) {
      const entity = e.entity;
      if (entity) {
        return getLocalizedName(entity, getCurrentLang(this.translate)) || e.name || String(e.id);
      }
      return e.name || String(e.id);
    }
    return String(entityId);
  }

  getWorkflowName(workflow: BackendWorkflowDto | WorkflowDto | null | undefined): string {
    if (!workflow) return '';
    const name = (workflow as { workflowName?: string }).workflowName ?? (workflow as { name?: string }).name;
    return getLocalizedName({ name }, getCurrentLang(this.translate)) || name || '';
  }

  resolveHigherApplicationEntityId(step: WorkflowStepDto | null | undefined): number | null {
    if (!step) return null;
    return step.higherApplicationEntityId ?? step.higherApprovalApplicationEntityId ?? step.higherApprovalEntityId ?? null;
  }

  resolveHigherApprovalRoleId(step: WorkflowStepDto | null | undefined): string | null {
    if (!step) return null;
    return step.higherApprovalRoleId ?? step.higherRoleId ?? null;
  }

  private _findRole(id: string): RoleDto | undefined {
    return this.roles.find(r => r.id === id);
  }

  orderLabel(n: number): string {
    if (n <= 0) {
      return String(n);
    }

    const key = this.getOrdinalKey(n);
    if (key) {
      if (key.includes('-')) {
        return key.replace('-', ' ');
      }
      return this.translate.instant(key);
    }

    return this.translate.instant('workflow.stepNumber', { number: n });
  }

  private getOrdinalKey(n: number): string | null {
    const predefined: { [k: number]: string } = {
      1: 'workflow.first',
      2: 'workflow.second',
      3: 'workflow.third',
      4: 'workflow.fourth',
      5: 'workflow.fifth',
      6: 'workflow.sixth',
      7: 'workflow.seventh',
      8: 'workflow.eighth',
      9: 'workflow.ninth',
      10: 'workflow.tenth',
      11: 'workflow.eleventh',
      12: 'workflow.twelfth',
      13: 'workflow.thirteenth',
      14: 'workflow.fourteenth',
      15: 'workflow.fifteenth',
      16: 'workflow.sixteenth',
      17: 'workflow.seventeenth',
      18: 'workflow.eighteenth',
      19: 'workflow.nineteenth',
      20: 'workflow.twentieth'
    };

    if (predefined[n]) {
      return predefined[n];
    }

    const tens: { [k: number]: string } = {
      20: 'workflow.twentieth',
      30: 'workflow.thirtieth',
      40: 'workflow.fortieth',
      50: 'workflow.fiftieth',
      60: 'workflow.sixtieth',
      70: 'workflow.seventieth',
      80: 'workflow.eightieth',
      90: 'workflow.ninetieth',
      100: 'workflow.oneHundredth'
    };

    if (tens[n]) {
      return tens[n];
    }

    if (n > 20 && n < 100) {
      const ones = n % 10;
      const base = n - ones;
      const baseKey = tens[base];
      const onesKey = predefined[ones];
      if (baseKey && onesKey) {
        const baseText = this.translate.instant(baseKey).replace(/th$/i, '').trim();
        const onesText = this.translate.instant(onesKey).toLowerCase();
        return `${baseText}-${onesText}`;
      }
    }

    return null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupDropdownPositioning();
  }

  private cleanupDropdownPositioning(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }
    if (this.positioningInterval) {
      clearInterval(this.positioningInterval);
      this.positioningInterval = undefined;
    }
    if (this.boundRepositionDropdowns) {
      document.removeEventListener('scroll', this.boundRepositionDropdowns, true);
    }
    if (this.boundHandleDocumentClick) {
      document.removeEventListener('click', this.boundHandleDocumentClick);
      this.boundHandleDocumentClick = undefined;
    }
    this.resetDropdownPanels();
  }

  private resetDropdownPanels(): void {
    document.querySelectorAll<HTMLElement>('.app-dropdown-panel').forEach((panel) => {
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
      panel.style.width = '';
      panel.style.maxWidth = '';
    });
  }

  private checkAndPositionDropdowns(): void {
    const openDropdowns = document.querySelectorAll('.app-dropdown-open');
    this.hasOpenDropdown = openDropdowns.length > 0;

    if (this.hasOpenDropdown) {
      this.repositionDropdowns();
      if (!this.positioningInterval) {
        if (!this.boundRepositionDropdowns) {
          this.boundRepositionDropdowns = this.repositionDropdowns.bind(this);
        }
        document.addEventListener('scroll', this.boundRepositionDropdowns, true);
        this.positioningInterval = setInterval(() => {
          if (this.hasOpenDropdown) {
            this.repositionDropdowns();
          } else {
            this.stopPositioningInterval();
          }
        }, 100);
      }
    } else {
      this.stopPositioningInterval();
      this.resetDropdownPanels();
    }
  }

  private stopPositioningInterval(): void {
    if (this.positioningInterval) {
      clearInterval(this.positioningInterval);
      this.positioningInterval = undefined;
      if (this.boundRepositionDropdowns) {
        document.removeEventListener('scroll', this.boundRepositionDropdowns, true);
      }
    }
  }

  private repositionDropdowns(): void {
    const scrollContainer = document.querySelector('.edit-steps-table-scroll-container');
    if (!scrollContainer) return;

    document.querySelectorAll<HTMLElement>('.app-dropdown-open').forEach((trigger) => {
      const dropdown = trigger.closest('.app-dropdown');
      const panel = dropdown?.querySelector('.app-dropdown-panel') as HTMLElement;

      if (!panel || !scrollContainer.contains(dropdown)) return;

      const rect = trigger.getBoundingClientRect();
      Object.assign(panel.style, {
        position: 'fixed',
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        minWidth: `${rect.width}px`,
        maxWidth: `${rect.width}px`,
        zIndex: '10000',
        right: 'auto'
      });
    });
  }

  closeModals(): void {
    this.showViewModal = false;
    this.selectedWorkflow = null;
    this.hasOpenDropdown = false;
    this.cleanupDropdownPositioning();
  }


  /**
   * Get formatted list of notifying roles for a step
   */
  getNotifyingRoles(step: WorkflowStepDto | null | undefined): string {
    if (!step?.notifiers) return '-';
    const roleNotifiers = step.notifiers.filter((n: WorkflowStepNotifier) => n.roleId);
    if (roleNotifiers.length === 0) return '-';
    return roleNotifiers.map((n: WorkflowStepNotifier) => {
      const roleName = getLocalizedName({ name: n.roleName, nameAr: n.roleNameAr }, getCurrentLang(this.translate));
      return roleName || n.roleName || n.roleId;
    }).join(', ');
  }

  /**
   * Get formatted list of notifying users for a step
   */
  getNotifyingUsers(step: WorkflowStepDto | null | undefined): string {
    if (!step?.notifiers) return '-';
    const userNotifiers = step.notifiers.filter((n: WorkflowStepNotifier) => n.userId);
    if (userNotifiers.length === 0) return '-';
    return userNotifiers.map((n: WorkflowStepNotifier) => {
      const userName = getLocalizedName(
        { name: n.userFullNameEn, nameAr: n.userFullNameAr },
        getCurrentLang(this.translate)
      );
      return userName || n.userName || n.userId;
    }).join(', ');
  }

  /**
   * Get formatted list of skip-to steps for a step (returns array for line-by-line display)
   */
  getSkipToSteps(step: WorkflowStepDto | null | undefined): string[] {
    let skipToStepIds: number[] = [];

    if (Array.isArray(step?.transitions) && step.transitions.length > 0) {
      skipToStepIds = step.transitions
        .map((t: WorkflowStepTransitionDto) => t.targetWorkflowStepId)
        .filter((id: number | undefined) => id != null && id !== undefined);
    } else if (Array.isArray(step?.allowedSkipTargetIds) && step.allowedSkipTargetIds.length > 0) {
      skipToStepIds = [...step.allowedSkipTargetIds];
    }

    if (skipToStepIds.length === 0) {
      return [];
    }

    const steps: WorkflowStepDto[] = this.selectedWorkflow?.workflowSteps || [];
    const skipToStepLabels = skipToStepIds
      .map((targetId: number) => {
        const targetStep = steps.find(s => s.id === targetId);
        if (!targetStep) return null;
        const roleName = this.getRoleNameById(targetStep.applicationRoleId);
        const entityName = this.getEntityNameById(targetStep.applicationEntityId);
        const orderLabel = this.orderLabel(targetStep.stepOrder);
        return `${orderLabel} - ${roleName}${entityName ? ` (${entityName})` : ''}`;
      })
      .filter((label: string | null) => label !== null) as string[];

    return skipToStepLabels;
  }
}


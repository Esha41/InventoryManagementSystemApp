import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, Observable, forkJoin, throwError, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { LucideAngularModule, Search, ChevronLeft, ChevronRight, Eye, FileEdit, Plus } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { WorkflowDto, WorkflowStepNotifierDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent, PaginationComponent, RowsPerPageComponent, ConfirmDialogComponent, HasPermissionDirective, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './workflow.component.html',
  styleUrls: ['./workflow.component.css']
})
export class WorkflowComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Eye = Eye;
  readonly FileEdit = FileEdit;
  readonly Plus = Plus;

  workflows: WorkflowDto[] = [];
  filteredWorkflows: WorkflowDto[] = [];
  searchTerm: string = '';
 
  loading = false;
  errorMessage: string | null = null;
  
  currentPage: number = 1;
  rowsPerPage: number = 10;
  readonly rowsPerPageOptions = [5, 10, 20, 50];

  showViewModal = false;
  showEditModal = false;
  showDeleteDialog = false;
  workflowToDelete: { id: number; name: string } | null = null;
  selectedWorkflow: any = null;
  
  deleteDialogTitle = '';
  deleteDialogMessage = '';
  deleteDialogDescription = '';
  editForm: { id: number; name: string; status: 'Active' | 'Inactive'; workflowType?: number } | null = null;
  editWorkflowType: number = 1;
  editSteps: Array<{ 
    order: number; 
    roleId: string | null; 
    applicationEntityId: number | null; 
    requireHigherApproval?: boolean; 
    higherApprovalRoleId?: string | null; 
    higherApplicationEntityId?: number | null;
    notifyingRoleIds?: string[];
    notifyingUserIds?: string[]; // Selected user IDs for notifications
    workflowStepId?: number; // For existing steps
    usersInNotifyingRoles?: Array<{ roleId: string; users: any[] }>; // Cache users by role
    availableUsers?: Array<{ id: string; userName: string; roles?: string[] }>; // All available users from selected roles with their roles
  }> = [];
  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string }> = [];
  workflowTypes: Array<{ id: number; name: string }> = [];
  readonly workflowStatusOptions = [
    { label: 'Active', value: 'Active' as const },
    { label: 'Inactive', value: 'Inactive' as const }
  ];

  hasOpenDropdown = false;
  private mutationObserver?: MutationObserver;
  private positioningInterval?: any;
  private boundRepositionDropdowns?: () => void;
  private boundHandleDocumentClick?: () => void;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private workflowService: WorkflowService,
    private translationService: TranslationService,
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private translate: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadWorkflows();
    this.backendUserService.getAllRolesSimple().subscribe({ next: r => this.roles = r, error: () => this.roles = [] });
    this.loadApplicationEntities();
    
    const lang = this.translationService.getCurrentLanguage();
    this.workflowTypes = this.workflowService.getWorkflowTypeItems(lang);

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadApplicationEntities();
      });
  }

  private loadApplicationEntities(): void {
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: any[]) => {
        const currentLang = getCurrentLang(this.translate);
        this.allApplicationEntities = (entities || []).map((e: any) => {
          const id = e?.id ?? e?.applicationEntityId ?? e;
          const localizedName = getLocalizedName(e, currentLang);
          return { id, name: localizedName || String(id), entity: e };
        });
      },
      error: () => { this.allApplicationEntities = []; }
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
    
    this.workflowService.getWorkflows().subscribe({
      next: (workflows) => {
        this.workflows = workflows;
        this.currentPage = 1;
        this.filterWorkflows();
        this.validateCurrentPage();
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to load workflows';
        this.loading = false;
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

    this.filteredWorkflows = filtered;
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
    this.workflowService.getWorkflowDetailById(id).subscribe({
      next: wf => {
        this.selectedWorkflow = wf;
        this.showViewModal = true;
        this.loading = false;
      },
      error: err => {
        this.errorMessage = err.message || 'Failed to load workflow';
        this.loading = false;
      }
    });
  }

  onEdit(id: number): void {
    const target = this.workflows.find(w => w.id === id);
    if (!target) return;
    this.workflowService.getWorkflowDetailById(id).subscribe({
      next: wf => {
        const status = wf?.isActive ? 'Active' : 'Inactive';
        this.editForm = { 
          id: wf?.id || target.id, 
          name: wf?.workflowName || target.name, 
          status: status as 'Active' | 'Inactive',
          workflowType: wf?.workflowType || target.workflowType || 1
        };
        this.editWorkflowType = wf?.workflowType || target.workflowType || 1;
        const steps = (wf?.workflowSteps || []) as any[];
        this.editSteps = steps.map((s, idx) => ({ 
          order: s.stepOrder || idx + 1, 
          roleId: s.applicationRoleId || null, 
          applicationEntityId: s.applicationEntityId || null,
          requireHigherApproval: !!s.requireHigherApproval,
          higherApprovalRoleId: s.higherApprovalRoleId || null,
          higherApplicationEntityId: (s as any).higherApplicationEntityId || null,
          // Initialize notifiers arrays - will be populated from API
          notifyingRoleIds: [],
          notifyingUserIds: [],
          workflowStepId: s.id,
          usersInNotifyingRoles: [],
          availableUsers: [] // Will be populated by loadUsersForNotifyingRoles
        }));
        
        // Load notifiers for each step from the API first, then load users
        // This ensures saved notifiers are displayed in dropdowns
        this.loadNotifiersForSteps(() => {
          // After notifiers are loaded, load all users for dropdowns
          this.loadAllUsersForSteps();
        });
        
        this.showEditModal = true;
        setTimeout(() => {
          this.initializeEditModalDropdowns();
        }, 0);
      },
      error: () => {
        this.editForm = { id: target.id, name: target.name, status: (target.status as any), workflowType: target.workflowType };
        this.editWorkflowType = target.workflowType || 1;
        this.editSteps = [];
        this.showEditModal = true;
        setTimeout(() => {
          this.initializeEditModalDropdowns();
        }, 0);
      }
    });
  }

  private initializeEditModalDropdowns(): void {
    const stepsContainer = document.querySelector('.edit-steps-table-wrapper');
    if (!stepsContainer) return;

    this.mutationObserver = new MutationObserver(() => {
      this.checkAndPositionDropdowns();
    });

    this.mutationObserver.observe(stepsContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    this.boundHandleDocumentClick = () => {
      setTimeout(() => this.checkAndPositionDropdowns(), 0);
    };
    document.addEventListener('click', this.boundHandleDocumentClick);
    
    this.checkAndPositionDropdowns();
  }

  onAddWorkflow(): void {
    this.router.navigate(['/workflow/add']);
  }
  addEditStep(): void { 
    const newStep = { 
      order: this.editSteps.length + 1, 
      roleId: null, 
      applicationEntityId: null, 
      requireHigherApproval: false, 
      higherApprovalRoleId: null, 
      higherApplicationEntityId: null,
      notifyingRoleIds: [],
      notifyingUserIds: [],
      usersInNotifyingRoles: [],
      availableUsers: []
    };
    this.editSteps.push(newStep);
    // Load all users for the new step
    setTimeout(() => {
      this.loadUsersForNotifyingRoles(newStep, this.editSteps.length - 1);
    }, 0);
  }
  removeEditStep(index: number): void { this.editSteps.splice(index, 1); this.editSteps = this.editSteps.map((s, i) => ({ ...s, order: i + 1 })); }

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
    this.workflowService.deleteWorkflow(id).subscribe({
      next: () => {
        this.workflows = this.workflows.filter(w => w.id !== id);
        this.currentPage = 1;
        this.filterWorkflows();
        this.validateCurrentPage();
        
        this.translate.get(['toast.success', 'toast.workflowDeleted']).subscribe((translations: any) => {
          this.toastService.success(translations['toast.workflowDeleted'], translations['toast.success']);
        });
        
        this.showDeleteDialog = false;
        this.workflowToDelete = null;
      },
      error: (error) => {
        this.errorMessage = error.message || 'Failed to delete workflow';
        
        this.translate.get(['toast.error', 'toast.failedToDeleteWorkflow']).subscribe((translations: any) => {
          const errorMsg = error.message || translations['toast.failedToDeleteWorkflow'];
          this.toastService.error(errorMsg, translations['toast.error']);
        });
        
        this.showDeleteDialog = false;
        this.workflowToDelete = null;
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
    const workflowTypes: { [key: number]: string } = {
      1: 'Type 1',
      2: 'Type 2',
      3: 'Type 3',
      4: 'Type 4',
      5: 'Type 5'
    };
    return workflowTypes[type] || `Type ${type}`;
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
      const entity = (e as any).entity;
      if (entity) {
        return getLocalizedName(entity, getCurrentLang(this.translate)) || e.name || String(e.id);
      }
      return e.name || String(e.id);
    }
    return String(entityId);
  }

  getWorkflowName(workflow: any): string {
    return getLocalizedName(workflow, getCurrentLang(this.translate)) || workflow?.name || '';
  }

  resolveHigherApplicationEntityId(step: any): number | null {
    if (!step) return null;
    return step.higherApplicationEntityId ?? step.higherApprovalApplicationEntityId ?? step.higherApprovalEntityId ?? null;
  }

  resolveHigherApprovalRoleId(step: any): string | null {
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
    document.querySelectorAll('.app-dropdown-panel').forEach((panel: any) => {
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

    document.querySelectorAll('.app-dropdown-open').forEach((trigger: any) => {
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
    this.showEditModal = false;
    this.selectedWorkflow = null;
    this.editForm = null;
    this.hasOpenDropdown = false;
    this.cleanupDropdownPositioning();
  }

  saveEdit(): void {
    if (!this.editForm) return;
    const editId = this.editForm.id;
    
    // Store notifier data before saving workflow (in case step IDs change)
    const notifierData = this.editSteps.map((s, idx) => ({
      originalIndex: idx,
      workflowStepId: s.workflowStepId,
      notifyingRoleIds: s.notifyingRoleIds || [],
      notifyingUserIds: s.notifyingUserIds || []
    }));
    
    const backendPayload = {
      id: editId,
      workflowName: this.editForm.name,
      workflowType: this.editWorkflowType,
      isActive: this.editForm.status === 'Active',
      isSpecialOrReserved: false,
      workflowSteps: (this.editSteps || []).map((s, idx) => ({
        id: s.workflowStepId, // Include existing step ID if available
        stepOrder: idx + 1,
        applicationRoleId: s.roleId as any,
        applicationEntityId: s.applicationEntityId as any,
        mustApprove: false,
        requireHigherApproval: !!s.requireHigherApproval,
        higherApprovalRoleId: s.requireHigherApproval ? (s.higherApprovalRoleId || null) : null,
        higherApplicationEntityId: s.requireHigherApproval ? (s.higherApplicationEntityId || null) : null,
        reserveQty: false,
        notifyingRoleIds: s.notifyingRoleIds || [],
        notifyingUserIds: s.notifyingUserIds || []
      }))
    } as any;

    // Update notifiers independently - don't wait for workflow update to succeed
    // This allows updating notifiers even if workflow steps are in approval history
    const updateNotifiers = (): Observable<boolean> => {
      // Use step IDs from editSteps directly (don't need to reload workflow)
      const notifierSaveObservables: Observable<boolean>[] = [];
      
      this.editSteps.forEach((step, idx) => {
        const notifierInfo = notifierData[idx];
        if (notifierInfo && step.workflowStepId) {
          const roleIds = notifierInfo.notifyingRoleIds || [];
          const userIds = notifierInfo.notifyingUserIds || [];
          
          // Only call API if there are notifiers to save (backend requires at least one)
          // If both are empty, skip (existing notifiers remain unchanged)
          if (roleIds.length > 0 || userIds.length > 0) {
            notifierSaveObservables.push(
              this.workflowService.updateStepNotifiers(
                step.workflowStepId,
                roleIds,
                userIds
              ).pipe(
                catchError(err => {
                  // Return success observable so forkJoin continues - notifier update failure shouldn't block other updates
                  return new Observable<boolean>(observer => {
                    observer.next(true);
                    observer.complete();
                  });
                })
              )
            );
          }
        }
      });
      
      // Save notifiers for all steps in parallel
      if (notifierSaveObservables.length === 0) {
        // Return a successful observable immediately when no notifiers to update
        return of(true);
      }
      
      return forkJoin(notifierSaveObservables).pipe(
        map(() => true)
      );
    };

    // Try to update workflow, but always update notifiers regardless of workflow update result
    this.workflowService.updateBackendWorkflow(backendPayload).pipe(
      catchError(err => {
        // If workflow update fails (e.g., steps in approval history), still update notifiers
        // Return a success observable so we can continue to update notifiers
        return new Observable<any>(observer => {
          observer.next(null);
          observer.complete();
        });
      }),
      switchMap(() => {
        // Always update notifiers after workflow update attempt
        return updateNotifiers();
      })
    ).subscribe({
      next: () => {
        // Notifiers have been updated successfully
        this.translate.get(['toast.success', 'toast.workflowUpdated']).subscribe((translations: any) => {
          this.toastService.success(translations['toast.workflowUpdated'], translations['toast.success']);
        });
        
        setTimeout(() => {
          this.loadWorkflows();
          this.closeModals();
        }, 500);
      },
      error: err => {
        // This error is from notifier updates, not workflow update
        this.errorMessage = err.message || 'Failed to update step notifiers';
        
        // Still show success for workflow update
        this.translate.get(['toast.success', 'toast.workflowUpdated']).subscribe((translations: any) => {
          this.toastService.success(translations['toast.workflowUpdated'], translations['toast.success']);
        });
        
        setTimeout(() => {
          this.loadWorkflows();
          this.closeModals();
        }, 500);
      }
    });
  }

  private loadNotifiersForSteps(callback?: () => void): void {
    // Load saved notifiers for each step from the API
    const stepsWithIds = this.editSteps.filter(step => step.workflowStepId);
    
    if (stepsWithIds.length === 0) {
      // No steps to load notifiers for, call callback immediately
      if (callback) callback();
      return;
    }
    
    const notifierObservables = stepsWithIds.map(step => 
      this.workflowService.getStepNotifiers(step.workflowStepId!).pipe(
        map(notifiers => ({ step, notifiers })),
        catchError(err => {
          // Return empty notifiers on error
          return new Observable<{ step: any; notifiers: any[] }>(observer => {
            observer.next({ step, notifiers: [] });
            observer.complete();
          });
        })
      )
    );
    
    // Load all notifiers in parallel
    forkJoin(notifierObservables).subscribe({
      next: (results) => {
        results.forEach(({ step, notifiers }) => {
          // Extract role IDs and user IDs from notifiers
          const roleIds: string[] = [];
          const userIds: string[] = [];
          
          notifiers.forEach(notifier => {
            if (notifier.roleId) {
              roleIds.push(notifier.roleId);
            }
            if (notifier.userId) {
              userIds.push(String(notifier.userId)); // Normalize to string
            }
          });
          
          // Update the step with saved notifiers
          step.notifyingRoleIds = roleIds;
          step.notifyingUserIds = userIds;
        });
        
        // Trigger change detection
        this.cdr.detectChanges();
        
        // Call callback after all notifiers are loaded
        if (callback) {
          setTimeout(() => callback(), 100);
        }
      },
      error: (err) => {
        // Initialize empty arrays for all steps if loading fails
        this.editSteps.forEach(step => {
          step.notifyingRoleIds = step.notifyingRoleIds || [];
          step.notifyingUserIds = step.notifyingUserIds || [];
        });
        
        if (callback) {
          setTimeout(() => callback(), 100);
        }
      }
    });
  }

  private loadAllUsersForSteps(): void {
    // Load all users for all steps
    this.editSteps.forEach((step, index) => {
      // Ensure arrays are initialized
      step.notifyingRoleIds = step.notifyingRoleIds || [];
      step.notifyingUserIds = step.notifyingUserIds || [];
      step.availableUsers = step.availableUsers || [];
      
      // Load all users for the dropdown
      setTimeout(() => {
        this.loadUsersForNotifyingRoles(step, index);
      }, 100);
    });
  }

  private loadUsersForNotifyingRoles(step: any, stepIndex: number): void {
    // Initialize arrays if needed
    if (!step.usersInNotifyingRoles) {
      step.usersInNotifyingRoles = [];
    }
    if (!step.availableUsers) {
      step.availableUsers = [];
    }

    // Preserve selected user IDs before loading, normalize to strings
    const preservedUserIds = step.notifyingUserIds 
      ? [...step.notifyingUserIds].map((id: any) => String(id))
      : [];

    // Fetch ALL users (not filtered by roles)
    this.backendUserService.getUsers().subscribe({
      next: (allUsers) => {
        // Map all users to the format needed for the dropdown, normalize IDs to strings
        step.availableUsers = (allUsers || []).map((user: any) => ({
          id: String(user.id),
          userName: user.userName || ''
        })).sort((a: any, b: any) => 
          (a.userName || '').localeCompare(b.userName || '')
        );
        
        // Restore selected user IDs after loading users, ensure type matching
        if (preservedUserIds.length > 0) {
          // Filter to only include users that exist in availableUsers, using string comparison
          const validUserIds = preservedUserIds.filter((userId: string) => 
            step.availableUsers.some((u: any) => String(u.id) === String(userId))
          );
          step.notifyingUserIds = validUserIds.length > 0 ? [...validUserIds] : [];
        }
        
        // Trigger change detection by creating new array references
        step.availableUsers = [...step.availableUsers];
        if (step.notifyingUserIds && step.notifyingUserIds.length > 0) {
          step.notifyingUserIds = [...step.notifyingUserIds];
        } else {
          step.notifyingUserIds = [];
        }
        if (step.notifyingRoleIds && step.notifyingRoleIds.length > 0) {
          step.notifyingRoleIds = [...step.notifyingRoleIds];
        } else {
          step.notifyingRoleIds = [];
        }
        
        // Force change detection
        this.cdr.detectChanges();
      },
      error: (err) => {
        step.availableUsers = [];
        step.availableUsers = [...step.availableUsers];
      }
    });
  }

  private saveStepNotifiers(): Observable<boolean> {
    const saveObservables: Observable<boolean>[] = [];
    
    // Save notifiers for all steps that have workflowStepId
    this.editSteps.forEach((step) => {
      if (step.workflowStepId) {
        const saveObs = this.workflowService.updateStepNotifiers(
          step.workflowStepId,
          step.notifyingRoleIds || [],
          step.notifyingUserIds || []
        );
        saveObservables.push(saveObs);
      }
    });

    if (saveObservables.length === 0) {
      return new Observable(observer => {
        observer.next(true);
        observer.complete();
      });
    }

    // Execute all saves in parallel using forkJoin
    return forkJoin(saveObservables).pipe(
      map(() => true),
      catchError((err) => {
        return throwError(() => err);
      })
    );
  }

  onNotifyingRolesChange(stepIndex: number): void {
    const step = this.editSteps[stepIndex];
    if (!step) return;
    
    // Ensure notifyingRoleIds is initialized
    if (!step.notifyingRoleIds) {
      step.notifyingRoleIds = [];
    }
    
    // Ensure notifyingUserIds is initialized
    if (!step.notifyingUserIds) {
      step.notifyingUserIds = [];
    }
    
    // Load all users (not filtered by roles)
    // Users dropdown is independent of roles selection
    this.loadUsersForNotifyingRoles(step, stepIndex);
  }
}


import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight, GripVertical } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto, ApplicationEntityDto } from '@models/backend-user.model';
import { TranslationService } from '@services/translation.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { CreateWorkflowDto } from '@models/workflow.model';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { WorkflowType } from '@models/workflow.model';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationMap } from '@models/common.types';
import { trackByIndex } from '@utils/trackby.utils';

/** Add workflow step form shape */
interface AddStepForm {
  roleId: string | null;
  applicationEntityId: number | null;
  entities: number[];
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string | null;
  higherApplicationEntityId?: number | null;
  canReturn?: boolean;
  parallelRoleIds?: string[];
  errors?: { role?: boolean; entity?: boolean; higherRole?: boolean; higherEntity?: boolean };
}

@Component({
  selector: 'app-add-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DragDropModule, DropdownComponent, HasPermissionDirective],
  templateUrl: './add-workflow.component.html',
  styleUrls: ['./add-workflow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddWorkflowComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly GripVertical = GripVertical;
  readonly trackByIndex = trackByIndex;

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  workflowForm: CreateWorkflowDto = {
    name: '',
    status: 'Active'
  };

  selectedWorkflowType: number = 1;

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  steps: AddStepForm[] = [];

  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string; entity?: ApplicationEntityDto }> = [];
  workflowTypes: Array<{ id: number; name: string }> = [];
  readonly workflowStatusOptions = [
    { label: 'workflow.active', value: 'Active' as const },
    { label: 'workflow.inactive', value: 'Inactive' as const }
  ];

  hasOpenDropdown = false;
  private readonly destroy$ = new Subject<void>();
  private mutationObserver?: MutationObserver;
  private positioningInterval?: ReturnType<typeof setInterval>;

  constructor(
    private workflowService: WorkflowService,
    private backendUserService: BackendUserService,
    private translationService: TranslationService,
    private lookupService: LookupService,
    private router: Router,
    private translate: TranslateService,
    private toastService: ToastService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.positioningInterval) {
      clearInterval(this.positioningInterval);
    }
    document.removeEventListener('click', this.handleDocumentClick.bind(this));
    document.removeEventListener('scroll', this.repositionDropdowns.bind(this), true);
  }

  private handleDocumentClick(event: MouseEvent): void {
    setTimeout(() => {
      this.checkAndPositionDropdowns();
    }, 0);
  }

  private checkAndPositionDropdowns(): void {
    const openDropdowns = document.querySelectorAll('.app-dropdown-open');
    this.hasOpenDropdown = openDropdowns.length > 0;

    if (this.hasOpenDropdown) {
      this.repositionDropdowns();
      if (!this.positioningInterval) {
        document.addEventListener('scroll', this.repositionDropdowns.bind(this), true);
        this.positioningInterval = setInterval(() => {
          if (this.hasOpenDropdown) {
            this.repositionDropdowns();
          } else {
            clearInterval(this.positioningInterval);
            this.positioningInterval = undefined;
            document.removeEventListener('scroll', this.repositionDropdowns.bind(this), true);
          }
        }, 100);
      }
    } else {
      if (this.positioningInterval) {
        clearInterval(this.positioningInterval);
        this.positioningInterval = undefined;
        document.removeEventListener('scroll', this.repositionDropdowns.bind(this), true);
      }
      document.querySelectorAll<HTMLElement>('.app-dropdown-panel').forEach((panel) => {
        panel.style.position = '';
        panel.style.top = '';
        panel.style.left = '';
        panel.style.width = '';
        panel.style.maxWidth = '';
      });
    }
  }

  private repositionDropdowns(): void {
    const scrollContainer = document.querySelector('.steps-table-scroll-container');
    if (!scrollContainer) return;

    const openDropdowns = document.querySelectorAll('.app-dropdown-open');
    openDropdowns.forEach((trigger: Element) => {
      const dropdown = trigger.closest('.app-dropdown');
      if (!dropdown) return;

      const panel = dropdown.querySelector('.app-dropdown-panel') as HTMLElement;
      if (!panel) return;

      if (scrollContainer.contains(dropdown)) {
        const triggerRect = trigger.getBoundingClientRect();

        const top = triggerRect.bottom + 8;
        const left = triggerRect.left;
        const width = triggerRect.width;

        panel.style.position = 'fixed';
        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.width = `${width}px`;
        panel.style.maxWidth = `${width}px`;
        panel.style.minWidth = `${width}px`;
        panel.style.zIndex = '10000';
        panel.style.right = 'auto';
      }
    });
  }

  ngOnInit(): void {
    this.workflowForm.status = 'Active';

    setTimeout(() => {
      this.mutationObserver = new MutationObserver(() => {
        this.checkAndPositionDropdowns();
      });

      const stepsContainer = document.querySelector('.steps-table-wrapper');
      if (stepsContainer) {
        this.mutationObserver.observe(stepsContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class']
        });
      }

      document.addEventListener('click', this.handleDocumentClick.bind(this));

      this.checkAndPositionDropdowns();
    }, 0);
    this.backendUserService.getAllRolesSimple().pipe(takeUntil(this.destroy$)).subscribe({
      next: roles => { this.roles = roles; this.cdr.markForCheck(); },
      error: (err) => { this.configService.logError('Failed to load roles', err); this.roles = []; this.cdr.markForCheck(); }
    });
    this.loadApplicationEntities();

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadApplicationEntities();
    });
    const lang = this.translationService.getCurrentLanguage();
    this.workflowTypes = this.workflowService.getWorkflowTypeItems(lang);

    if (this.workflowTypes.length > 0) {
      this.selectedWorkflowType = this.workflowTypes[0].id;
    }
  }

  private loadApplicationEntities(): void {
    this.backendUserService.getApplicationEntities().pipe(takeUntil(this.destroy$)).subscribe({
      next: (entities: ApplicationEntityDto[]) => {
        const currentLang = getCurrentLang(this.translate);
        this.allApplicationEntities = (entities || []).map((e: ApplicationEntityDto) => {
          const id = e?.id ?? (e as ApplicationEntityDto & { applicationEntityId?: number }).applicationEntityId ?? 0;
          const localizedName = getLocalizedName(e, currentLang);
          const fallback = e.nameEn ?? e.nameAr ?? '';
          return { id, name: localizedName || fallback || String(id), entity: e };
        });
        this.cdr.markForCheck();
      },
      error: (err) => { this.configService.logError('Failed to load application entities', err); this.allApplicationEntities = []; this.cdr.markForCheck(); }
    });
  }


  onSubmit(): void {
    if (!this.workflowForm.name || this.workflowForm.name.trim() === '') {
      this.translate.get('workflow.nameRequired').pipe(takeUntil(this.destroy$)).subscribe(msg => {
        this.errorMessage = msg;
        this.cdr.markForCheck();
      });
      return;
    }

    (this.steps || []).forEach((_, idx) => this.updateStepErrors(idx));

    if ((this.steps || []).some(step => !this.isStepValid(step))) {
      this.errorMessage = this.translate.instant('workflow.stepFieldsRequired');
      const title = this.translate.instant('toast.warning');
      this.toastService.warning(this.errorMessage || '', title);
      return;
    }

    const payload = {
      workflowName: this.workflowForm.name.trim(),
      workflowType: this.selectedWorkflowType,
      isActive: this.workflowForm.status === 'Active',
      isSpecialOrReserved: false,
      workflowSteps: (this.steps || []).map((s, idx) => ({
        stepOrder: idx + 1,
        applicationRoleId: s.roleId as string,
        applicationEntityId: (s.applicationEntityId as number) || 0,
        mustApprove: false,
        requireHigherApproval: !!s.requireHigherApproval,
        higherApprovalRoleId: s.requireHigherApproval ? (s.higherApprovalRoleId || null) : null,
        higherApplicationEntityId: s.requireHigherApproval ? (s.higherApplicationEntityId || null) : null,
        reserveQty: false,
        canReturn: !!s.canReturn,
        parallelRoleIds: Array.isArray(s.parallelRoleIds)
          ? [...new Set(s.parallelRoleIds.filter(id => !!id && id !== s.roleId))]
          : []
      }))
    };

    this.submitting = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.markForCheck();

    this.workflowService.createBackendWorkflow(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.submitting = false;
        this.cdr.markForCheck();
        const message = this.translate.instant('workflow.createdSuccess');
        const title = this.translate.instant('toast.success');
        this.toastService.success(message, title);
        this.router.navigate(['/workflow']);
      },
      error: (error) => {
        this.submitting = false;
        this.cdr.markForCheck();

        this.translate.get(['toast.error', 'toast.failedToCreateWorkflow']).pipe(takeUntil(this.destroy$)).subscribe((translations: TranslationMap) => {
          const errorMsg = translations['toast.failedToCreateWorkflow'] || 'Failed to create workflow';
          this.errorMessage = error.message || errorMsg;
          this.cdr.markForCheck();
          this.toastService.error(errorMsg, translations['toast.error']);
        });
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/workflow']);
  }

  clearError(): void {
    this.errorMessage = null;
  }

  clearSuccess(): void {
    this.successMessage = null;
  }

  addStep(): void {
    if (this.steps.length > 0) {
      const lastIndex = this.steps.length - 1;
      this.updateStepErrors(lastIndex);
      const lastStep = this.steps[lastIndex];
      if (this.hasRoleError(lastStep) || this.hasEntityError(lastStep)) {
        const message = this.translate.instant('workflow.stepFieldsRequiredAdd');
        const title = this.translate.instant('toast.warning');
        this.toastService.warning(message, title);
        return;
      }
    }

    this.steps.push({
      roleId: null,
      applicationEntityId: null,
      entities: [],
      requireHigherApproval: false,
      higherApprovalRoleId: null,
      higherApplicationEntityId: null,
      canReturn: false,
      parallelRoleIds: [],
      errors: { role: true, entity: true, higherRole: false, higherEntity: false }
    });

    setTimeout(() => {
      const scrollContainer = document.querySelector('.steps-table-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 0);
  }

  removeStep(index: number): void {
    this.steps.splice(index, 1);
  }

  onStepDrop(event: CdkDragDrop<any[]>): void {
    moveItemInArray(this.steps, event.previousIndex, event.currentIndex);
  }

  onRoleChange(index: number): void {
    const step = this.steps[index];
    if (!step || !step.roleId) { step.entities = []; step.applicationEntityId = null; return; }
    this.backendUserService.getApplicationEntitiesByRole(step.roleId).pipe(takeUntil(this.destroy$)).subscribe({
      next: ids => {
        step.entities = ids;
        if (!ids.includes(step.applicationEntityId || -1)) {
          step.applicationEntityId = null;
        }
        this.updateStepErrors(index);
        this.cdr.markForCheck();
      },
      error: (err) => { this.configService.logError('Failed to load application entities for role', err); step.entities = []; step.applicationEntityId = null; this.cdr.markForCheck(); }
    });
    this.updateStepErrors(index);
  }

  getEntitiesForStep(index: number): Array<{ id: number; name?: string }> {
    const step = this.steps[index];
    if (!step || !Array.isArray(step.entities) || step.entities.length === 0) {
      return [];
    }
    const allowed = new Set(step.entities);
    return this.allApplicationEntities
      .filter(e => allowed.has(e.id))
      .map(e => ({ id: e.id, name: e.name }));
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

  hasRoleError(step: AddStepForm): boolean {
    return !!step?.errors?.role;
  }

  hasEntityError(step: AddStepForm): boolean {
    return !!step?.errors?.entity;
  }

  onStepFieldBlur(index: number): void {
    this.updateStepErrors(index);
  }

  private updateStepErrors(index: number): void {
    const step = this.steps[index];
    if (!step) {
      return;
    }
    step.errors = step.errors || { role: false, entity: false, higherRole: false, higherEntity: false };
    step.errors.role = !step.roleId;
    step.errors.entity = !step.applicationEntityId;

    if (step.requireHigherApproval) {
      step.errors.higherRole = !step.higherApprovalRoleId;
      step.errors.higherEntity = !step.higherApplicationEntityId;
    } else {
      step.errors.higherRole = false;
      step.errors.higherEntity = false;
    }
  }

  hasHigherRoleError(step: AddStepForm): boolean {
    return !!step?.errors?.higherRole;
  }

  hasHigherEntityError(step: AddStepForm): boolean {
    return !!step?.errors?.higherEntity;
  }

  private buildHigherApprovalKey(step: AddStepForm): { baseRoleKey: string | null; baseEntityKey: string | null } {
    const baseRoleKey = step?.requireHigherApproval ? 'workflow.stepHigherRoleRequired' : null;
    const baseEntityKey = step?.requireHigherApproval ? 'workflow.stepHigherEntityRequired' : null;
    return { baseRoleKey, baseEntityKey };
  }

  private isStepValid(step: AddStepForm): boolean {
    if (!step) {
      return true;
    }
    const roleValid = !!step.roleId;
    const entityValid = !!step.applicationEntityId;
    const higherRoleValid = !step.requireHigherApproval || !!step.higherApprovalRoleId;
    const higherEntityValid = !step.requireHigherApproval || !!step.higherApplicationEntityId;
    return roleValid && entityValid && higherRoleValid && higherEntityValid;
  }
}


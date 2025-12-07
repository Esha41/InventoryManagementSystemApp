import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { TranslationService } from '@services/translation.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { CreateWorkflowDto } from '@models/workflow.model';
import { ToastService } from '@services/toast.service';
import { WorkflowType } from '@models/workflow.model';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-add-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent, HasPermissionDirective],
  templateUrl: './add-workflow.component.html',
  styleUrls: ['./add-workflow.component.css']
})
export class AddWorkflowComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

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
  
  selectedWorkflowType: number = 1; // Default workflow type
  
  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Steps UI state (client-side only for now)
  steps: Array<{ 
    roleId: string | null; 
    applicationEntityId: number | null; 
    entities: number[];
    requireHigherApproval?: boolean;
    higherApprovalRoleId?: string | null;
    higherApplicationEntityId?: number | null;
    errors?: { role?: boolean; entity?: boolean; higherRole?: boolean; higherEntity?: boolean };
  }>=[];

  roles: RoleDto[] = [];
  // Full application entities cache loaded once
  allApplicationEntities: Array<{ id: number; name?: string }> = [];
  workflowTypes: Array<{ id: number; name: string }> = [];
  readonly workflowStatusOptions = [
    { label: 'workflow.active', value: 'Active' as const },
    { label: 'workflow.inactive', value: 'Inactive' as const }
  ];

  hasOpenDropdown = false;
  private mutationObserver?: MutationObserver;
  private positioningInterval?: ReturnType<typeof setInterval>;

  constructor(
    private workflowService: WorkflowService,
    private backendUserService: BackendUserService,
    private translationService: TranslationService,
    private lookupService: LookupService,
    private router: Router,
    private translate: TranslateService,
    private toastService: ToastService
  ) {}

  ngOnDestroy(): void {
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
      // Reposition on scroll
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
      // Reset all dropdown panels
      document.querySelectorAll('.app-dropdown-panel').forEach((panel: any) => {
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
    openDropdowns.forEach((trigger: any) => {
      const dropdown = trigger.closest('.app-dropdown');
      if (!dropdown) return;

      const panel = dropdown.querySelector('.app-dropdown-panel') as HTMLElement;
      if (!panel) return;

      // Check if dropdown is inside scroll container
      if (scrollContainer.contains(dropdown)) {
        const triggerRect = trigger.getBoundingClientRect();
        
        // Calculate position relative to viewport
        const top = triggerRect.bottom + 8; // 0.5rem = 8px
        const left = triggerRect.left;
        const width = triggerRect.width;

        // Apply fixed positioning to escape overflow clipping
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
    // Initialize with Active status
    this.workflowForm.status = 'Active';
    
    // Set up mutation observer to watch for dropdown state changes
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

      // Also listen for clicks to detect dropdown toggles
      document.addEventListener('click', this.handleDocumentClick.bind(this));
      
      // Initial check
      this.checkAndPositionDropdowns();
    }, 0);
    // Load roles for steps dropdown
    this.backendUserService.getAllRolesSimple().subscribe({
      next: roles => this.roles = roles,
      error: () => this.roles = []
    });
    // Load all application entities once, used to render names
    this.loadApplicationEntities();

    // Subscribe to language changes to update entity names
    this.translate.onLangChange.subscribe(() => {
      this.loadApplicationEntities();
    });
    const lang = this.translationService.getCurrentLanguage(); // 'ar' or 'en'
    this.workflowTypes = this.workflowService.getWorkflowTypeItems(lang);

    if (this.workflowTypes.length > 0) {
      this.selectedWorkflowType = this.workflowTypes[0].id;
    }
  }

  private loadApplicationEntities(): void {
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: any[]) => {
        const currentLang = getCurrentLang(this.translate);
        this.allApplicationEntities = (entities || []).map((e: any) => {
          const id = e?.id ?? e?.applicationEntityId ?? e;
          const localizedName = getLocalizedName(e, currentLang);
          const fallback = e?.name || e?.displayName || e?.entityName || e?.applicationEntityName || e?.title || e?.label;
          return { id, name: localizedName || fallback || String(id), entity: e }; // Store entity for dynamic updates
        });
      },
      error: () => { this.allApplicationEntities = []; }
    });
  }


  onSubmit(): void {
    if (!this.workflowForm.name || this.workflowForm.name.trim() === '') {
      this.errorMessage = 'Workflow name is required';
      return;
    }

    (this.steps || []).forEach((_, idx) => this.updateStepErrors(idx));

    if ((this.steps || []).some(step => !this.isStepValid(step))) {
      this.errorMessage = this.translate.instant('workflow.stepFieldsRequired');
      const title = this.translate.instant('toast.warning');
      this.toastService.warning(this.errorMessage || '', title);
      return;
    }

    // Build backend payload
    const payload = {
      workflowName: this.workflowForm.name.trim(),
      workflowType: this.selectedWorkflowType,
      isActive: this.workflowForm.status === 'Active',
      isSpecialOrReserved: false, // default - can add UI control later
      workflowSteps: (this.steps || []).map((s, idx) => ({
        stepOrder: idx + 1,
        applicationRoleId: s.roleId as string,
        applicationEntityId: (s.applicationEntityId as number) || 0,
        mustApprove: false,
        requireHigherApproval: !!s.requireHigherApproval,
        higherApprovalRoleId: s.requireHigherApproval ? (s.higherApprovalRoleId || null) : null,
        higherApplicationEntityId: s.requireHigherApproval ? (s.higherApplicationEntityId || null) : null,
        reserveQty: false
      }))
    };

    // Log payload being sent to backend
    console.log('Create Workflow payload:', JSON.stringify(payload, null, 2));

    this.submitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    this.workflowService.createBackendWorkflow(payload).subscribe({
      next: () => {
        this.submitting = false;
        const message = this.translate.instant('workflow.createdSuccess');
        const title = this.translate.instant('toast.success');
        this.toastService.success(message, title);
        this.router.navigate(['/workflow']);
      },
      error: (error) => {
        this.submitting = false;
        this.errorMessage = error.message || 'Failed to create workflow';
        console.error('Error creating workflow:', error);
        
        this.translate.get(['toast.error', 'toast.failedToCreateWorkflow']).subscribe((translations: any) => {
          const errorMsg = error.message || translations['toast.failedToCreateWorkflow'] || 'Failed to create workflow';
          this.errorMessage = errorMsg;
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

  // Steps handlers
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
      errors: { role: true, entity: true, higherRole: false, higherEntity: false }
    });

    // Scroll to the newly added row after Angular updates the view
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

  onRoleChange(index: number): void {
    const step = this.steps[index];
    if (!step || !step.roleId) { step.entities = []; step.applicationEntityId = null; return; }
    this.backendUserService.getApplicationEntitiesByRole(step.roleId).subscribe({
      next: ids => {
        console.log('ids', ids);
        step.entities = ids;
        // reset selection if not in list
        if (!ids.includes(step.applicationEntityId || -1)) {
          step.applicationEntityId = null;
        }
        this.updateStepErrors(index);
      },
      error: () => { step.entities = []; step.applicationEntityId = null; }
    });
    this.updateStepErrors(index);
  }

  // Returns the list of entity objects allowed for this step (filtered by IDs)
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

  // Human‑readable order label supporting up to 100 steps
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

  hasRoleError(step: any): boolean {
    return !!step?.errors?.role;
  }

  hasEntityError(step: any): boolean {
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

  hasHigherRoleError(step: any): boolean {
    return !!step?.errors?.higherRole;
  }

  hasHigherEntityError(step: any): boolean {
    return !!step?.errors?.higherEntity;
  }

  private buildHigherApprovalKey(step: any): { baseRoleKey: string | null; baseEntityKey: string | null } {
    const baseRoleKey = step?.requireHigherApproval ? 'workflow.stepHigherRoleRequired' : null;
    const baseEntityKey = step?.requireHigherApproval ? 'workflow.stepHigherEntityRequired' : null;
    return { baseRoleKey, baseEntityKey };
  }

  private isStepValid(step: any): boolean {
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


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Save, X, ArrowLeft } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { TranslationService } from '@services/translation.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { CreateWorkflowDto } from '@models/workflow.model';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-add-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './add-workflow.component.html',
  styleUrls: ['./add-workflow.component.css']
})
export class AddWorkflowComponent implements OnInit {
  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;

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

  constructor(
    private workflowService: WorkflowService,
    private backendUserService: BackendUserService,
    private translationService: TranslationService,
    private lookupService: LookupService,
    private router: Router,
    private translate: TranslateService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Initialize with Active status
    this.workflowForm.status = 'Active';
    // Load roles for steps dropdown
    this.backendUserService.getAllRolesSimple().subscribe({
      next: roles => this.roles = roles,
      error: () => this.roles = []
    });
    // Load all application entities once, used to render names
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: any[]) => {
        const lang = this.translationService.getCurrentLanguage();
        this.allApplicationEntities = (entities || []).map((e: any) => {
          const id = e?.id ?? e?.applicationEntityId ?? e;
          const nameLocalized = lang === 'ar' ? (e?.nameAr || e?.nameAR) : (e?.nameEn || e?.nameEN);
          const fallback = e?.name || e?.displayName || e?.entityName || e?.applicationEntityName || e?.title || e?.label;
          return { id, name: nameLocalized || fallback || String(id) };
        });
      },
      error: () => { this.allApplicationEntities = []; }
    });

    // Load workflow types lookup
    this.lookupService.getWorkflowTypes().subscribe({
      next: (types: LookupItem[]) => {
        const lang = this.translationService.getCurrentLanguage();
        this.workflowTypes = (types || [])
          .filter(t => t.id !== undefined)
          .map(t => ({ id: t.id!, name: (lang === 'ar' ? t.nameAr : t.nameEn) || String(t.id) }));
        if (this.workflowTypes.length > 0) {
          this.selectedWorkflowType = this.workflowTypes[0].id;
        }
      },
      error: () => { this.workflowTypes = []; }
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


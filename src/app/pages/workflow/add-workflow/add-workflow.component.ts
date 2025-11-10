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
import { WorkflowType } from '@models/workflow.model';

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
    private translate: TranslateService
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
const lang = this.translationService.getCurrentLanguage(); // 'ar' or 'en'

this.workflowTypes =  this.workflowService.getWorkflowTypeItems(lang);

if (this.workflowTypes.length > 0) {
  this.selectedWorkflowType = this.workflowTypes[0].id;
}
  }


  onSubmit(): void {
    if (!this.workflowForm.name || this.workflowForm.name.trim() === '') {
      this.errorMessage = 'Workflow name is required';
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
    this.steps.push({ 
      roleId: null, 
      applicationEntityId: null, 
      entities: [],
      requireHigherApproval: false,
      higherApprovalRoleId: null,
      higherApplicationEntityId: null
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
      },
      error: () => { step.entities = []; step.applicationEntityId = null; }
    });
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

  // Human‑readable order label (1->First, 2->Second, 3->Third, 4->Fourth, ... up to 10th)
  orderLabel(n: number): string {
    const keyMap: { [k: number]: string } = {
      1: 'workflow.first',
      2: 'workflow.second',
      3: 'workflow.third',
      4: 'workflow.fourth',
      5: 'workflow.fifth',
      6: 'workflow.sixth',
      7: 'workflow.seventh',
      8: 'workflow.eighth',
      9: 'workflow.ninth',
      10: 'workflow.tenth'
    };
    const key = keyMap[n];
    return key ? this.translate.instant(key) : String(n);
  }
}


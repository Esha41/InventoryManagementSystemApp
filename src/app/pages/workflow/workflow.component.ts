import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Search, ChevronLeft, ChevronRight, Eye, FileEdit, Plus } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { WorkflowDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { ToastService } from '@services/toast.service';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';

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
  
  // Pagination
  currentPage: number = 1;
  rowsPerPage: number = 10;
  readonly rowsPerPageOptions = [5, 10, 20, 50];

  // Modal state
  showViewModal = false;
  showEditModal = false;
  showDeleteDialog = false;
  workflowToDelete: { id: number; name: string } | null = null;
  selectedWorkflow: any = null;
  
  // Delete dialog translations
  deleteDialogTitle = '';
  deleteDialogMessage = '';
  deleteDialogDescription = '';
  editForm: { id: number; name: string; status: 'Active' | 'Inactive'; workflowType?: number } | null = null;
  editWorkflowType: number = 1;
  editSteps: Array<{ order: number; roleId: string | null; applicationEntityId: number | null; requireHigherApproval?: boolean; higherApprovalRoleId?: string | null; higherApplicationEntityId?: number | null }> = [];
  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string }> = [];
  workflowTypes: Array<{ id: number; name: string }> = [];
  readonly workflowStatusOptions = [
    { label: 'Active', value: 'Active' as const },
    { label: 'Inactive', value: 'Inactive' as const }
  ];

  // Dropdown positioning state for edit modal
  hasOpenDropdown = false;
  private mutationObserver?: MutationObserver;
  private positioningInterval?: any;
  private boundRepositionDropdowns?: () => void;
  private boundHandleDocumentClick?: () => void;

  constructor(
    private router: Router,
    private workflowService: WorkflowService,
    private translationService: TranslationService,
    private backendUserService: BackendUserService,
    private lookupService: LookupService,
    private translate: TranslateService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadWorkflows();
    // Preload roles and application entities for edit modal
    this.backendUserService.getAllRolesSimple().subscribe({ next: r => this.roles = r, error: () => this.roles = [] });
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: any[]) => {
        this.allApplicationEntities = (entities || []).map((e: any) => ({ id: e?.id ?? e?.applicationEntityId ?? e, name: e?.nameEn || e?.name || String(e?.id ?? e) }));
      },
      error: () => { this.allApplicationEntities = []; }
    });
const lang = this.translationService.getCurrentLanguage(); // 'ar' or 'en'

 this.workflowTypes =  this.workflowService.getWorkflowTypeItems(lang);

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

getWorkflowType (id: number)
{
  console.log("dd");
 return this.workflowService. getWorkflowTypeNameById(id, this.translationService.getCurrentLanguage());
console.log( this.workflowService. getWorkflowTypeNameById(id, this.translationService.getCurrentLanguage()));
}
  loadWorkflows(): void {
    this.loading = true;
    this.errorMessage = null;
    
    console.log('Loading workflows...');
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
        console.error('Error loading workflows:', error);
      }
    });
  }

  filterWorkflows(): void {
    let filtered = [...this.workflows];

    if (this.searchTerm) {
      filtered = filtered.filter(workflow =>
        workflow.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        workflow.id.toString().includes(this.searchTerm)
      );
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
    // Load workflow detail to get accurate status and steps
    this.workflowService.getWorkflowDetailById(id).subscribe({
      next: wf => {
        // Get status from the detail API (isActive boolean)
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
          higherApplicationEntityId: (s as any).higherApplicationEntityId || null
        }));
        this.showEditModal = true;
        // Initialize dropdown positioning after modal opens
        setTimeout(() => {
          this.initializeEditModalDropdowns();
        }, 0);
      },
      error: () => {
        // Fallback to list data if detail fails
        this.editForm = { id: target.id, name: target.name, status: (target.status as any), workflowType: target.workflowType };
        this.editWorkflowType = target.workflowType || 1;
        this.editSteps = [];
        this.showEditModal = true;
        // Initialize dropdown positioning after modal opens
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
    // Navigate to add workflow page
    this.router.navigate(['/workflow/add']);
  }
  addEditStep(): void { this.editSteps.push({ order: this.editSteps.length + 1, roleId: null, applicationEntityId: null, requireHigherApproval: false, higherApprovalRoleId: null, higherApplicationEntityId: null }); }
  removeEditStep(index: number): void { this.editSteps.splice(index, 1); this.editSteps = this.editSteps.map((s, i) => ({ ...s, order: i + 1 })); }

  onDelete(id: number): void {
    const workflow = this.workflows.find(w => w.id === id);
    if (!workflow) return;
    
    this.workflowToDelete = { id: workflow.id, name: workflow.name };
    
    // Load translations synchronously using instant()
    this.deleteDialogTitle = this.translate.instant('workflow.deleteConfirmation.title');
    this.deleteDialogMessage = this.translate.instant('workflow.deleteConfirmation.message');
    const workflowLabel = this.translate.instant('workflow.deleteConfirmation.workflow');
    this.deleteDialogDescription = `${workflowLabel}: ${this.workflowToDelete.name}`;
    
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
        console.error('Failed to delete workflow:', error);
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
    // Map workflow type numbers to names
    const workflowTypes: { [key: number]: string } = {
      1: 'Type 1',
      2: 'Type 2',
      3: 'Type 3',
      4: 'Type 4',
      5: 'Type 5'
    };
    return workflowTypes[type] || `Type ${type}`;
  }

  // Helpers to display names in View modal
  getRoleNameById(roleId?: string | null): string {
    if (!roleId) return '';
    const r = this._findRole(roleId);
    return r ? r.name : String(roleId);
  }

  getEntityNameById(entityId?: number | null): string {
    if (entityId === undefined || entityId === null) return '';
    const e = this.allApplicationEntities.find(x => x.id === entityId);
    return e ? (e.name || String(e.id)) : String(entityId);
  }

  // Resolve varying backend field names for higher approval entity/role
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

  ngOnDestroy(): void {
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
    
    // Log the status being saved
    console.log('Saving workflow with status:', this.editForm.status);
    console.log('isActive will be:', this.editForm.status === 'Active');
    
    // Build backend update payload including steps
    const backendPayload = {
      id: editId,
      workflowName: this.editForm.name,
      workflowType: this.editWorkflowType,
      isActive: this.editForm.status === 'Active',
      isSpecialOrReserved: false, // default - can add UI control later
      workflowSteps: (this.editSteps || []).map((s, idx) => ({
        stepOrder: idx + 1,
        applicationRoleId: s.roleId as any,
        applicationEntityId: s.applicationEntityId as any,
        mustApprove: false,
        requireHigherApproval: !!s.requireHigherApproval,
        higherApprovalRoleId: s.requireHigherApproval ? (s.higherApprovalRoleId || null) : null,
        higherApplicationEntityId: s.requireHigherApproval ? (s.higherApplicationEntityId || null) : null,
        reserveQty: false
      }))
    } as any;

    console.log('Payload being sent:', JSON.stringify(backendPayload, null, 2));

    this.workflowService.updateBackendWorkflow(backendPayload).subscribe({
      next: (response) => {
        console.log('Workflow update successful, reloading list...');
        
        this.translate.get(['toast.success', 'toast.workflowUpdated']).subscribe((translations: any) => {
          this.toastService.success(translations['toast.workflowUpdated'], translations['toast.success']);
        });
        
        setTimeout(() => {
          this.loadWorkflows();
          this.closeModals();
        }, 500);
      },
      error: err => {
        console.error('Error updating workflow:', err);
        console.error('Error details:', JSON.stringify(err, null, 2));
        this.errorMessage = err.message || 'Failed to update workflow';
        
        this.translate.get(['toast.error', 'toast.failedToUpdateWorkflow']).subscribe((translations: any) => {
          const errorMsg = err.message || translations['toast.failedToUpdateWorkflow'];
          this.toastService.error(errorMsg, translations['toast.error']);
        });
      }
    });
  }
}


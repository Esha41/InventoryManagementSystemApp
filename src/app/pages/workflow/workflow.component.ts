import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, ChevronLeft, ChevronRight, Eye, FileEdit, Plus } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { WorkflowDto } from '@models/workflow.model';

@Component({
  selector: 'app-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './workflow.component.html',
  styleUrls: ['./workflow.component.css']
})
export class WorkflowComponent implements OnInit {
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
  itemsPerPage: number = 20;
  totalPages: number = 1;

  // Modal state
  showViewModal = false;
  showEditModal = false;
  selectedWorkflow: any = null;
  editForm: { id: number; name: string; status: 'Active' | 'Inactive' } | null = null;
  editSteps: Array<{ order: number; roleId: string | null; applicationEntityId: number | null }> = [];
  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string }> = [];

  constructor(
    private router: Router,
    private workflowService: WorkflowService,
    private backendUserService: BackendUserService
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
  }

  loadWorkflows(): void {
    this.loading = true;
    this.errorMessage = null;
    
    this.workflowService.getWorkflows().subscribe({
      next: (workflows) => {
        this.workflows = workflows;
        this.filterWorkflows();
        this.calculateTotalPages();
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

    // Filter by search term
    if (this.searchTerm) {
      filtered = filtered.filter(workflow =>
        workflow.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        workflow.id.toString().includes(this.searchTerm)
      );
    }

    this.filteredWorkflows = filtered;
    this.calculateTotalPages();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.filterWorkflows();
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredWorkflows.length / this.itemsPerPage);
  }

  get paginatedWorkflows(): WorkflowDto[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredWorkflows.slice(startIndex, endIndex);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
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
    this.editForm = { id: target.id, name: target.name, status: (target.status as any) };
    // Load existing steps
    this.workflowService.getWorkflowDetailById(id).subscribe({
      next: wf => {
        const steps = (wf?.workflowSteps || []) as any[];
        this.editSteps = steps.map((s, idx) => ({ order: s.stepOrder || idx + 1, roleId: s.applicationRoleId || null, applicationEntityId: s.applicationEntityId || null }));
        this.showEditModal = true;
      },
      error: () => {
        this.editSteps = [];
        this.showEditModal = true;
      }
    });
  }

  onAddWorkflow(): void {
    // Navigate to add workflow page
    this.router.navigate(['/workflow/add']);
  }
  addEditStep(): void { this.editSteps.push({ order: this.editSteps.length + 1, roleId: null, applicationEntityId: null }); }
  removeEditStep(index: number): void { this.editSteps.splice(index, 1); this.editSteps = this.editSteps.map((s, i) => ({ ...s, order: i + 1 })); }

  onDelete(id: number): void {
    const confirmed = window.confirm('Are you sure you want to delete this workflow?');
    if (!confirmed) return;
    this.workflowService.deleteWorkflow(id).subscribe({
      next: () => {
        // Remove from local list and refresh filtered/pagination
        this.workflows = this.workflows.filter(w => w.id !== id);
        this.filterWorkflows();
        this.calculateTotalPages();
      },
      error: (error) => {
        console.error('Failed to delete workflow:', error);
        this.errorMessage = error.message || 'Failed to delete workflow';
      }
    });
  }

  getStatusButtonClass(status: string): string {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-300';
      case 'Inactive': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  closeModals(): void {
    this.showViewModal = false;
    this.showEditModal = false;
    this.selectedWorkflow = null;
    this.editForm = null;
  }

  saveEdit(): void {
    if (!this.editForm) return;
    const editId = this.editForm.id;
    // Build backend update payload including steps
    const backendPayload = {
      id: editId,
      workflowName: this.editForm.name,
      workflowType: 1,
      requesterType: 1,
      isActive: this.editForm.status === 'Active',
      workflowSteps: (this.editSteps || []).map((s, idx) => ({
        stepOrder: idx + 1,
        applicationRoleId: s.roleId as any,
        applicationEntityId: s.applicationEntityId as any,
        mustApprove: false,
        requireHigherApproval: false,
        higherApprovalRoleId: null,
        reserveQty: false
      }))
    } as any;

    this.workflowService.updateBackendWorkflow(backendPayload).subscribe({
      next: () => {
        // Reflect changes locally
        const idx = this.workflows.findIndex(w => w.id === editId);
        if (idx !== -1) {
          const newName = this.editForm ? this.editForm.name : this.workflows[idx].name;
          const newStatus = this.editForm ? this.editForm.status : (this.workflows[idx] as any).status;
          this.workflows[idx].name = newName;
          (this.workflows[idx] as any).status = newStatus as any;
        }
        this.filterWorkflows();
        this.closeModals();
      },
      error: err => {
        this.errorMessage = err.message || 'Failed to update workflow';
      }
    });
  }
}


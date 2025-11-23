import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, CheckCircle, Clock, User, Package, FileText } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { mapToRequestDetail, RequestTypeEnum, RequestStatusEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getRequestStatusBadgeClass, getPriorityBadgeClass, getApprovalStatusBadgeClass } from '@utils/status-class.utils';

@Component({
  selector: 'app-workflow-approval-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './workflow-approval-detail.component.html',
  styleUrls: ['./workflow-approval-detail.component.css']
})
export class WorkflowApprovalDetailComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly FileText = FileText;

  private readonly destroy$ = new Subject<void>();

  requestId: number = 0;
  requestDetail: RequestDetail | null = null;
  loading: boolean = true;
  error: string | null = null;
  
  // Approval/Rejection form
  comments: string = '';
  sendToHigherApproval: boolean = false;
  processing: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: BackendAuthService
  ) {}

  ngOnInit(): void {
    // Use route params observable instead of snapshot for better reactivity
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = parseInt(params['id'], 10);
        if (isNaN(id)) {
          this.error = 'Invalid request ID';
          this.loading = false;
          return;
        }
        this.requestId = id;
        this.loadRequestDetail();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRequestDetail(): void {
    this.loading = true;
    this.error = null;

    this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response) 
          ? response 
          : (response?.data || []);
        
        const baseRequest = data.find(r => r.id === this.requestId);
        
        if (!baseRequest) {
          this.error = 'Request not found';
          this.loading = false;
          return;
        }

        // Load items from the specific order/return/discard API based on request type
        this.loadRequestItems(baseRequest).then(() => {
          this.requestDetail = mapToRequestDetail(baseRequest);
          this.loading = false;
        }).catch(() => {
          // Still show the request detail even if items fail to load
          this.requestDetail = mapToRequestDetail(baseRequest);
          this.loading = false;
        });
      },
      error: (error) => {
        this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load request details');
        this.loading = false;
      }
    });
  }

  private async loadRequestItems(baseRequest: BaseRequestDto): Promise<void> {
    return new Promise((resolve) => {
      let endpoint = '';
      
      switch (baseRequest.requestType) {
        case RequestTypeEnum.Order:
          endpoint = `/order/${this.requestId}`;
          break;
        case RequestTypeEnum.Return:
          endpoint = API_ENDPOINTS.RETURNS.BY_ID(this.requestId);
          break;
        case RequestTypeEnum.Discard:
          endpoint = API_ENDPOINTS.DISCARDS.BY_ID(this.requestId);
          break;
        default:
          resolve();
          return;
      }

      this.apiService.getWithAuth<any>(endpoint)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            const detailData = response?.data || response;
            
            if (detailData && detailData.requestItems) {
              baseRequest.requestItems = detailData.requestItems;
            }
            
            resolve();
          },
          error: () => {
            // Don't reject - just continue without items
            resolve();
          }
        });
    });
  }

  getStatusClass(status: string): string {
    return getRequestStatusBadgeClass(status);
  }

  getPriorityClass(priority: string): string {
    return getPriorityBadgeClass(priority);
  }

  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.AlertTriangle;
      case 'Pending': return this.Clock;
      default: return this.Clock;
    }
  }

  getApprovalStatusClass(status: string): string {
    return getApprovalStatusBadgeClass(status);
  }

  approveRequest(): void {
    if (this.processing || !this.requestDetail) return;
    
    this.processing = true;
    const payload = {
      baseRequestID: this.requestId,
      isApproved: true,
      comments: this.comments || undefined,
      sendToHigherApproval: this.sendToHigherApproval || false,
      action: RequestStatusEnum.Approved
    };

    this.apiService.postWithAuth(
      API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
      payload
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.comments = '';
        this.sendToHigherApproval = false;
        this.loadRequestDetail(); // Reload to get updated status
        this.processing = false;
      },
      error: (error) => {
        this.error = ErrorHandler.extractErrorMessage(error, 'Failed to approve request');
        this.processing = false;
      }
    });
  }

  rejectRequest(): void {
    if (this.processing || !this.requestDetail) return;
    
    this.processing = true;
    const payload = {
      baseRequestID: this.requestId,
      isApproved: false,
      comments: this.comments || undefined,
      sendToHigherApproval: this.sendToHigherApproval || false,
      action: RequestStatusEnum.Rejected
    };

    this.apiService.postWithAuth(
      API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
      payload
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.comments = '';
        this.sendToHigherApproval = false;
        this.loadRequestDetail(); // Reload to get updated status
        this.processing = false;
      },
      error: (error) => {
        this.error = ErrorHandler.extractErrorMessage(error, 'Failed to reject request');
        this.processing = false;
      }
    });
  }

  canApproveOrReject(): boolean {
    if (!this.requestDetail || this.processing) {
      return false;
    }
    
    // Don't show buttons if status is not Pending
    if (this.requestDetail.status !== 'Pending') {
      return false;
    }
    
    // Get current user info
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }
    
    const currentUserId = currentUser.id?.toLowerCase() || '';
    const currentUserName = currentUser.userName?.toLowerCase() || '';
    const currentUserEmail = currentUser.email?.toLowerCase() || '';
    
    // Check if current user has already approved or rejected in the approval history
    if (this.requestDetail.approvalHistory && this.requestDetail.approvalHistory.length > 0) {
      const hasUserAlreadyActed = this.requestDetail.approvalHistory.some(step => {
        // Only check steps that have been approved or rejected (not pending)
        if (step.status === 'Approved' || step.status === 'Rejected') {
          const changedBy = step.changedBy?.toLowerCase() || '';
          const approverName = step.approverName?.toLowerCase() || '';
          
          // Check if the changedBy or approverName matches current user
          // Match by user ID, username, or email
          const matchesUserId = currentUserId && changedBy.includes(currentUserId);
          const matchesUserName = currentUserName && (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
          const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);
          
          if (matchesUserId || matchesUserName || matchesUserEmail) {
            return true;
          }
        }
        return false;
      });
      
      if (hasUserAlreadyActed) {
        return false;
      }
    }
    
    // If we reach here, the user hasn't acted yet and status is Pending
    // The backend will handle permission check (only current approver can approve)
    return true;
  }

  hasHigherApproval(): boolean {
    if (!this.requestDetail || !this.requestDetail.approvalHistory) {
      return false;
    }

    // Find the current pending step
    const pendingStep = this.requestDetail.approvalHistory.find(step => step.status === 'Pending' && step.isPending);
    
    if (!pendingStep || !pendingStep.requireHigherApproval) {
      return false;
    }

    const hasApprovedStepWithSameWorkflowStepId = this.requestDetail.approvalHistory.some(step => 
      step.workflowStepId === pendingStep.workflowStepId && 
      step.status === 'Approved'
    );

   
    return !hasApprovedStepWithSameWorkflowStepId;
  }

  goBack(): void {
    this.router.navigate(['/requests-management']);
  }
}

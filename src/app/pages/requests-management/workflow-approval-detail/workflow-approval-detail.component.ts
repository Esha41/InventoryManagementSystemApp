import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, CheckCircle, Clock, User, Package, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ToastService } from '@services/toast.service';
import { RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { mapToRequestDetail, RequestTypeEnum, RequestStatusEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getRequestStatusBadgeClass, getPriorityBadgeClass, getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-workflow-approval-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, HasPermissionDirective],
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
  readonly Eye = Eye;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  private readonly destroy$ = new Subject<void>();

  
  private readonly SUPPLY_REVIEW_PERMISSION = 'UpdateRequestAndSuggestLots';
  private readonly UPDATE_REQUEST_AND_SUPPLY_PERMISSION = 'UpdateRequestAndSupply';
  private readonly CANNOT_REJECT_PERMISSION = 'CannotRejectRequest';
  private readonly SET_SUPPLY_PICKUP_DATE_PERMISSION = 'SetSupplyPickupDate';
  private readonly CONFIRM_SUPPLY_PICKUP_DATE_PERMISSION = 'ConfirmSupplyPickupDate'; 

  requestId: number = 0;
  requestDetail: RequestDetail | null = null;
  loading: boolean = true;
  error: string | null = null;
  
  // Collapsible sections state
  isApprovalWorkflowExpanded: boolean = true;
  
  // Approval/Rejection form
  comments: string = '';
  sendToHigherApproval: boolean = false;
  processing: boolean = false;

  // Pickup date management
  pickupDate: string = '';
  pickupDateProcessing: boolean = false;
  confirmPickupDateProcessing: boolean = false;
  isPickupDateAlreadySet: boolean = false; // Track if date was already set (from backend or after setting)

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: BackendAuthService,
    private toastService: ToastService
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
    // Reset pickup date state when loading new request
    this.isPickupDateAlreadySet = false;

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

        this.loadRequestItems(baseRequest).then(() => {
          this.requestDetail = mapToRequestDetail(baseRequest);
          // Load supply data if this is an order request
          if (this.requestDetail.requestType === 'Order') {
            this.loadSupplyData();
          }
          this.loading = false;
        }).catch(() => {
          this.requestDetail = mapToRequestDetail(baseRequest);
          // Load supply data if this is an order request
          if (this.requestDetail.requestType === 'Order') {
            this.loadSupplyData();
          }
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

  /**
   * Load supply data for the order and populate pickup date if available
   */
  private loadSupplyData(): void {
    this.apiService.getWithAuth<any>(
      API_ENDPOINTS.SUPPLY.BY_ORDER_ID(this.requestId)
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const supplyData = response?.data || response;
        
        // If supply exists and has a supply date, populate the pickup date field
        if (supplyData && supplyData.supplyDate) {
          // Convert ISO date string to datetime-local format (YYYY-MM-DDTHH:mm)
          const supplyDate = new Date(supplyData.supplyDate);
          if (!isNaN(supplyDate.getTime())) {
            // Format to datetime-local input format
            const year = supplyDate.getFullYear();
            const month = String(supplyDate.getMonth() + 1).padStart(2, '0');
            const day = String(supplyDate.getDate()).padStart(2, '0');
            const hours = String(supplyDate.getHours()).padStart(2, '0');
            const minutes = String(supplyDate.getMinutes()).padStart(2, '0');
            
            this.pickupDate = `${year}-${month}-${day}T${hours}:${minutes}`;
            // Mark that the date has already been set
            this.isPickupDateAlreadySet = true;
          }
        }
      },
      error: (error) => {
        // Silently handle error - supply might not exist yet, which is fine
        console.log('No supply data found for this order');
      }
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
    // Immediately update status to prevent buttons from showing
    if (this.requestDetail) {
      this.requestDetail.status = 'Confirmed';
    }
    
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
        // Reload to get updated status and approval history
        this.loadRequestDetail();
      },
      error: (error) => {
        this.error = ErrorHandler.extractErrorMessage(error, 'Failed to approve request');
        this.processing = false;
        // Revert status on error by reloading
        if (this.requestDetail) {
          this.loadRequestDetail();
        }
      }
    });
  }

  rejectRequest(): void {
    if (this.processing || !this.requestDetail) return;
    
    this.processing = true;
    // Immediately update status to prevent buttons from showing
    if (this.requestDetail) {
      this.requestDetail.status = 'Rejected';
    }
    
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
        // Reload to get updated status and approval history
        this.loadRequestDetail();
      },
      error: (error) => {
        this.error = ErrorHandler.extractErrorMessage(error, 'Failed to reject request');
        this.processing = false;
        // Revert status on error
        if (this.requestDetail) {
          this.loadRequestDetail();
        }
      }
    });
  }

  canApproveOrReject(): boolean {
    if (!this.requestDetail || this.processing) {
      return false;
    }
    
    if (this.requestDetail.status !== 'Pending') {
      return false;
    }
    
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }
    
    // Check if user is administrator (multiple detection methods)
    const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
    const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') || 
                              currentUser?.email?.toLowerCase().includes('administrator');
    const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
    
    const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;
    
    if (isAdministrator) {
      return true;
    }
    
    const currentUserId = currentUser.id?.toLowerCase() || '';
    const currentUserName = currentUser.userName?.toLowerCase() || '';
    const currentUserEmail = currentUser.email?.toLowerCase() || '';
    
    const currentPendingStep = this.requestDetail.approvalHistory?.find(
      step => step.status === 'Pending' && step.isPending
    );
    
    if (!currentPendingStep) {
      return false;
    }
 
    if (this.requestDetail.approvalHistory && this.requestDetail.approvalHistory.length > 0) {
      const hasUserAlreadyActedInCurrentStep = this.requestDetail.approvalHistory.some(step => {
        if (step.workflowStepId === currentPendingStep.workflowStepId) {
          if (step.status === 'Approved' || step.status === 'Rejected') {
            const changedBy = step.changedBy?.toLowerCase() || '';
            const approverName = step.approverName?.toLowerCase() || '';
            
            const matchesUserId = currentUserId && changedBy.includes(currentUserId);
            const matchesUserName = currentUserName && (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
            const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);
            
            if (matchesUserId || matchesUserName || matchesUserEmail) {
              return true;
            }
          }
        }
        return false;
      });
      
      if (hasUserAlreadyActedInCurrentStep) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if user can reject requests
   * Administrators bypass CannotRejectRequest permission
   */
  canRejectRequest(): boolean {
    const currentUser = this.authService.getCurrentUser();
    
    try {
      // Check if user is administrator (multiple detection methods)
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') || 
                                currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
      
      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;
      
      if (isAdministrator) {
        return true;
      }
      
      // For non-administrators, check CannotRejectRequest permission
      const hasCannotRejectPermission = this.authService.hasPermission(this.CANNOT_REJECT_PERMISSION);
      
      return !hasCannotRejectPermission;
    } catch (error) {
      return true;
    }
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

  canReviewSupply(): boolean {
    if (!this.requestDetail) {
      return false;
    }

    if (this.requestDetail.requestType !== 'Order') {
      return false;
    }

    if (this.requestDetail.status !== 'Pending') {
      return false;
    }

    try {
      return this.authService.hasPermission(this.SUPPLY_REVIEW_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  navigateToSupplyReview(): void {
    if (!this.requestDetail || !this.requestId) {
      return;
    }

    this.router.navigate(['/requests-management', this.requestId, 'supply-request-detail']);
  }

  /**
   * Check if user can update request and supply
   */
  canUpdateRequestAndSupply(): boolean {
    if (!this.requestDetail) {
      return false;
    }

    if (this.requestDetail.requestType !== 'Order') {
      return false;
    }

    try {
      return this.authService.hasPermission(this.UPDATE_REQUEST_AND_SUPPLY_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  navigateToSupplyOrder(): void {
    if (!this.requestDetail || !this.requestId) {
      this.toastService.error('Invalid request data');
      return;
    }

    // Navigate with query param to indicate this is an orderId, not a supplyId
    this.router.navigate(['/supply-order', this.requestId], { queryParams: { byOrder: true } });
  }

  canSetSupplyPickupDate(): boolean {
    if (!this.requestDetail || this.requestDetail.requestType !== 'Order') {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();
    
    try {
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') || 
                                currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
      
      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;
      
      if (isAdministrator) {
        return true;
      }
      
      return this.authService.hasPermission(this.SET_SUPPLY_PICKUP_DATE_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  canConfirmSupplyPickupDate(): boolean {
    if (!this.requestDetail || this.requestDetail.requestType !== 'Order') {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();
    
    try {
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') || 
                                currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
      
      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;
      
      if (isAdministrator) {
        return true;
      }
      
      return this.authService.hasPermission(this.CONFIRM_SUPPLY_PICKUP_DATE_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  setSupplyPickupDate(): void {
    if (this.pickupDateProcessing || !this.requestDetail || !this.pickupDate) {
      if (!this.pickupDate) {
        this.toastService.error('Please select a pickup date');
      }
      return;
    }

    // Prevent changes if date already set
    if (this.isPickupDateAlreadySet) {
      this.toastService.error('Pickup date has already been set and cannot be modified');
      return;
    }

    this.pickupDateProcessing = true;

    const supplyDate = new Date(this.pickupDate).toISOString();

    const payload = {
      supplyDate: supplyDate
    };

    this.apiService.putWithAuth(
      API_ENDPOINTS.SUPPLY.SET_PICKUP_DATE_BY_ORDER(this.requestId),
      payload
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.toastService.success('Pickup date set successfully and locked for confirmation');
        // Mark the date as set and lock the input
        this.isPickupDateAlreadySet = true;
        this.pickupDateProcessing = false;
        // Don't clear pickupDate - keep it to show in both sections
        this.loadRequestDetail();
      },
      error: (error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to set pickup date');
        this.toastService.error(errorMessage);
        this.pickupDateProcessing = false;
      }
    });
  }

  confirmSupplyPickupDate(): void {
    if (this.confirmPickupDateProcessing || !this.requestDetail || !this.pickupDate) {
      if (!this.pickupDate) {
        this.toastService.error('Please select a pickup date');
      }
      return;
    }

    this.confirmPickupDateProcessing = true;

    const supplyDate = new Date(this.pickupDate).toISOString();

    const payload = {
      supplyDate: supplyDate
    };

    this.apiService.putWithAuth(
      API_ENDPOINTS.SUPPLY.CONFIRM_PICKUP_DATE_BY_ORDER(this.requestId),
      payload
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.toastService.success('Pickup date confirmed successfully');
        // Mark as set so the Set section shows the updated date as locked
        this.isPickupDateAlreadySet = true;
        this.confirmPickupDateProcessing = false;
        // Reload to sync everything
        this.loadRequestDetail();
      },
      error: (error) => {
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to confirm pickup date');
        this.toastService.error(errorMessage);
        this.confirmPickupDateProcessing = false;
      }
    });
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Clock, User, Package, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ToastService } from '@services/toast.service';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { SupplyService, SubmitSupplyDto, SupplyDto } from '@services/supply.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { mapToRequestDetail, RequestTypeEnum, RequestStatusEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getRequestStatusBadgeClass, getPriorityBadgeClass, getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { TranslationService } from '@services/translation.service';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-workflow-approval-detail',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TranslateModule, 
    LucideAngularModule, 
    HasPermissionDirective,
    LoadingStateComponent,
    ErrorStateComponent,
    DropdownComponent
  ],
  templateUrl: './workflow-approval-detail.component.html',
  styleUrls: ['./workflow-approval-detail.component.css']
})
export class WorkflowApprovalDetailComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly FileText = FileText;
  readonly Eye = Eye;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  private readonly destroy$ = new Subject<void>();

  
  private readonly SUPPLY_REVIEW_PERMISSION = 'UpdateRequestAndSuggestLots';
  private readonly UPDATE_REQUEST_AND_SUPPLY_PERMISSION = 'UpdateRequestAndSupply';
  private readonly CANNOT_REJECT_PERMISSION = 'CannotRejectRequest';
  private readonly SET_SUPPLY_PICKUP_DATE_PERMISSION = 'SetSupplyPickupDate';
  private readonly CONFIRM_SUPPLY_PICKUP_DATE_PERMISSION = 'ConfirmSupplyPickupDate';
  private readonly SUBMIT_SUPPLY_PERMISSION = 'SubmitSupply'; 

  requestId: number = 0;
  requestDetail: RequestDetail | null = null;
  loading: boolean = true;
  error: string | null = null;
  
  // Collapsible sections state
  isApprovalWorkflowExpanded: boolean = true;
  
  // Approval/Rejection form
  comments: string = '';
  sendToHigherApproval: string = 'no'; // 'yes' = yes, 'no' = no (default is 'no')
  processing: boolean = false;
  
  // Higher approval dropdown options
  higherApprovalOptions: { value: string; label: string }[] = [];

  // Pickup date management
  pickupDate: string = '';
  pickupDateProcessing: boolean = false;
  confirmPickupDateProcessing: boolean = false;
  isPickupDateAlreadySet: boolean = false; // Track if date was already set (from backend or after setting)

  // Receiver information for supply submission
  receiverInfo = {
    recieverName: "",
    receiverRankId: 0,
    recieverMilitaryId: "",
    notes: ""
  };
  supplyId: number | null = null;
  supplyData: SupplyDto | null = null;
  ranks: LookupItem[] = [];
  isLoadingRanks: boolean = false;
  isSubmittingSupply: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: BackendAuthService,
    private toastService: ToastService,
    private supplyService: SupplyService,
    private lookupService: LookupService,
    public translationService: TranslationService,
    private translateService: TranslateService,
    private requestStatusUpdateService: RequestStatusUpdateService
  ) {}

  ngOnInit(): void {
    // Use route params observable instead of snapshot for better reactivity
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = parseInt(params['id'], 10);
        if (isNaN(id)) {
          // Error will be translated in template
          this.error = 'INVALID_REQUEST_ID';
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
    // Reset higher approval selection to default 'no'
    this.sendToHigherApproval = 'no';
    
    // Initialize higher approval options with translations if not already set
    if (this.higherApprovalOptions.length === 0) {
      this.translateService.get(['common.yes', 'common.no']).subscribe(translations => {
        this.higherApprovalOptions = [
          { value: 'yes', label: translations['common.yes'] || 'Yes' },
          { value: 'no', label: translations['common.no'] || 'No' }
        ];
      });
    }

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
          this.translateService.get('workflowApprovalDetail.errors.requestNotFound').subscribe(translation => {
            this.error = translation || 'Request not found';
          });
          this.loading = false;
          return;
        }

        this.loadRequestItems(baseRequest).then(() => {
          this.requestDetail = mapToRequestDetail(baseRequest);
          if (this.requestDetail.requestType === 'Order') {
            this.loadSupplyData();
          }
          this.loading = false;
        }).catch(() => {
          this.requestDetail = mapToRequestDetail(baseRequest);
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
      
      const requestTypeValue: any = baseRequest.requestType;
      
      if (typeof requestTypeValue === 'number') {
        switch (requestTypeValue) {
          case RequestTypeEnum.Order:
            endpoint = API_ENDPOINTS.ORDERS.BY_ID(this.requestId);
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
      } else if (typeof requestTypeValue === 'string') {
        const requestTypeLower = requestTypeValue.toLowerCase();
        switch (requestTypeLower) {
          case 'order':
            endpoint = API_ENDPOINTS.ORDERS.BY_ID(this.requestId);
            break;
          case 'return':
            endpoint = API_ENDPOINTS.RETURNS.BY_ID(this.requestId);
            break;
          case 'discard':
            endpoint = API_ENDPOINTS.DISCARDS.BY_ID(this.requestId);
            break;
          default:
            resolve();
            return;
        }
      } else {
        resolve();
        return;
      }

      this.apiService.getWithAuth<any>(endpoint)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            const detailData = response?.data || response;
            
            if (detailData?.requestItems && Array.isArray(detailData.requestItems)) {
              baseRequest.requestItems = detailData.requestItems;
            }
            
            resolve();
          },
          error: () => {
            resolve();
          }
        });
    });
  }

  /**
   * Load supply data for the order and populate pickup date and receiver info if available
   */
  private loadSupplyData(): void {
    this.supplyService.getByOrderId(this.requestId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (supply: SupplyDto) => {
        this.supplyData = supply;
        this.supplyId = supply.id;
        
        // If supply exists and has a supply date, populate the pickup date field
        if (supply.supplyDate) {
          const supplyDate = new Date(supply.supplyDate);
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

        // Populate receiver information if already exists
        if (supply.recieverName) {
          this.receiverInfo.recieverName = supply.recieverName;
        }
        if (supply.receiverRankId) {
          this.receiverInfo.receiverRankId = supply.receiverRankId;
        }
        if (supply.recieverMilitaryId) {
          this.receiverInfo.recieverMilitaryId = supply.recieverMilitaryId;
        }
        if (supply.notes) {
          this.receiverInfo.notes = supply.notes;
        }

        // Load ranks for dropdown if user can submit supply
        if (this.canSubmitSupply()) {
          this.loadRanks();
        }
      },
      error: () => {
        // Supply might not exist yet, which is fine
      }
    });
  }

  /**
   * Load ranks for dropdown
   */
  private loadRanks(): void {
    this.isLoadingRanks = true;
    this.lookupService.getLookupItems('Rank')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items: LookupItem[]) => {
          this.ranks = items ?? [];
          this.isLoadingRanks = false;
        },
        error: () => {
          this.ranks = [];
          this.isLoadingRanks = false;
          this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.failedToLoadRanks']).subscribe(translations => {
            this.toastService.error(
              translations['workflowApprovalDetail.errors.failedToLoadRanks'] || 'Failed to load ranks',
              translations['toast.error']
            );
          });
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
      this.requestDetail.status = 'Approved';
    }
    
    const payload = {
      baseRequestID: this.requestId,
      isApproved: true,
      comments: this.comments || undefined,
      sendToHigherApproval: this.sendToHigherApproval === 'yes',
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
        this.sendToHigherApproval = 'no';
        // Notify other components about the status update
        this.requestStatusUpdateService.notifyRequestStatusUpdated(this.requestId);
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
      sendToHigherApproval: this.sendToHigherApproval === 'yes',
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
        this.sendToHigherApproval = 'no';
        // Notify other components about the status update
        this.requestStatusUpdateService.notifyRequestStatusUpdated(this.requestId);
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
  
  /**
   * Get label for higher approval dropdown option
   */
  higherApprovalOptionLabel = (option: DropdownOption<{value: string, label: string}> | {value: string, label: string} | null): string => {
    if (!option) return '';
    let item: {value: string, label: string} | null = null;
    
    if (typeof option === 'object' && option !== null) {
      if ('value' in option) {
        item = option.value as {value: string, label: string};
      } else if ('value' in option && 'label' in option) {
        item = option as {value: string, label: string};
      }
    }
    
    if (!item || !item.value) return '';
    return this.translateService.instant(item.value === 'yes' ? 'common.yes' : 'common.no');
  };

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

  /**
   * Get formatted error message for display
   */
  get errorMessage(): string {
    if (!this.error) return '';
    if (this.error === 'INVALID_REQUEST_ID') {
      return 'workflowApprovalDetail.invalidRequestId';
    }
    return this.error;
  }

  /**
   * Get error title for display
   */
  get errorTitle(): string {
    return 'workflowApprovalDetail.errorLoadingRequest';
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
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.invalidRequestData']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.invalidRequestData'] || 'Invalid request data',
          translations['toast.error']
        );
      });
      return;
    }

    // Navigate with query param to indicate this is an orderId, not a supplyId
    this.router.navigate(['/supply-order', this.requestId], { queryParams: { byOrder: true } });
  }

  /**
   * Navigate to item detail page to view item details (same view as new issue request)
   */
  navigateToItemDetails(itemId: number): void {
    if (itemId && itemId > 0) {
      // Pass requestId as query parameter so we can navigate back
      this.router.navigate(['/item-detail', itemId], { 
        queryParams: { requestId: this.requestId } 
      });
    }
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
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.selectPickupDate']).subscribe(translations => {
          this.toastService.error(
            translations['workflowApprovalDetail.errors.selectPickupDate'] || 'Please select a pickup date',
            translations['toast.error']
          );
        });
      }
      return;
    }

    // Prevent changes if date already set
    if (this.isPickupDateAlreadySet) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.pickupDateAlreadySet']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.pickupDateAlreadySet'] || 'Pickup date has already been set and cannot be modified',
          translations['toast.error']
        );
      });
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
        this.translateService.get(['toast.success', 'workflowApprovalDetail.success.pickupDateSet']).subscribe(translations => {
          this.toastService.success(
            translations['workflowApprovalDetail.success.pickupDateSet'] || 'Pickup date set successfully and locked for confirmation',
            translations['toast.success']
          );
        });
        // Mark the date as set and lock the input
        this.isPickupDateAlreadySet = true;
        this.pickupDateProcessing = false;
        // Don't clear pickupDate - keep it to show in both sections
        this.loadRequestDetail();
      },
      error: (error) => {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.failedToSetPickupDate']).subscribe(translations => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.failedToSetPickupDate'] || 'Failed to set pickup date');
          this.toastService.error(errorMessage, translations['toast.error']);
        });
        this.pickupDateProcessing = false;
      }
    });
  }

  confirmSupplyPickupDate(): void {
    if (this.confirmPickupDateProcessing || !this.requestDetail || !this.pickupDate) {
      if (!this.pickupDate) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.selectPickupDate']).subscribe(translations => {
          this.toastService.error(
            translations['workflowApprovalDetail.errors.selectPickupDate'] || 'Please select a pickup date',
            translations['toast.error']
          );
        });
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
          this.translateService.get(['toast.success', 'workflowApprovalDetail.success.pickupDateConfirmed']).subscribe(translations => {
            this.toastService.success(
              translations['workflowApprovalDetail.success.pickupDateConfirmed'] || 'Pickup date confirmed successfully',
              translations['toast.success']
            );
          });
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

  /**
   * Check if user can submit supply (requires SubmitSupply permission)
   */
  canSubmitSupply(): boolean {
    if (!this.requestDetail || this.requestDetail.requestType !== 'Order') {
      return false;
    }

    try {
      return this.authService.hasPermission(this.SUBMIT_SUPPLY_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if supply exists and is ready for submission
   */
  isSupplyReadyForSubmission(): boolean {
    // Supply must exist
    if (!this.supplyId || !this.supplyData) {
      return false;
    }

    // Check if already submitted (SupplySubmissionStatus: Draft = 1, Submitted = 2)
    if (this.supplyData.submissionStatus === 2) {
      return false;
    }

    return true;
  }

  /**
   * Submit supply with receiver information
   */
  submitSupply(): void {
    if (this.isSubmittingSupply || !this.supplyId) {
      return;
    }

    // Validate required fields
    if (!this.receiverInfo.recieverName || !this.receiverInfo.recieverName.trim()) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.receiverNameRequired']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.receiverNameRequired'] || 'Receiver name is required',
          translations['toast.error']
        );
      });
      return;
    }

    if (!this.receiverInfo.receiverRankId || this.receiverInfo.receiverRankId <= 0) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.receiverRankRequired']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.receiverRankRequired'] || 'Receiver rank is required',
          translations['toast.error']
        );
      });
      return;
    }

    if (!this.receiverInfo.recieverMilitaryId || !this.receiverInfo.recieverMilitaryId.trim()) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.militaryIdRequired']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.militaryIdRequired'] || 'Military ID is required',
          translations['toast.error']
        );
      });
      return;
    }

    this.isSubmittingSupply = true;

    const submitDto: SubmitSupplyDto = {
      recieverName: this.receiverInfo.recieverName.trim(),
      receiverRankId: this.receiverInfo.receiverRankId,
      recieverMilitaryId: this.receiverInfo.recieverMilitaryId.trim(),
      notes: this.receiverInfo.notes?.trim() || undefined
    };

    this.supplyService.submit(this.supplyId, submitDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.translateService.get(['toast.success', 'workflowApprovalDetail.success.supplySubmitted']).subscribe(translations => {
            this.toastService.success(
              translations['workflowApprovalDetail.success.supplySubmitted'] || 'Supply submitted successfully',
              translations['toast.success']
            );
          });
          this.isSubmittingSupply = false;
          // Reload to refresh supply status
          this.loadRequestDetail();
        },
        error: (error) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to submit supply');
          this.toastService.error(errorMessage);
          this.isSubmittingSupply = false;
        }
      });
  }

  /**
   * Get rank name by ID
   */
  // Helper method for template - get rank name from rank object
  getRankDisplayName(rank: any): string {
    if (!rank) return '';
    return getLocalizedName(rank, getCurrentLang(this.translateService)) || rank.nameEn || '';
  }

  getRankName(rankId: number | null | undefined): string {
    if (rankId === null || rankId === undefined) return '';
    const rank = this.ranks.find(r => r.id === rankId);
    return rank ? getLocalizedName(rank, getCurrentLang(this.translateService)) : `Rank #${rankId}`;
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Clock, User, Package, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-angular';
import { Subject, takeUntil, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ToastService } from '@services/toast.service';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { SupplyService, SubmitSupplyDto, SupplyDto } from '@services/supply.service';
import { LookupService, LookupItem } from '@services/lookup.service';
import { RequestDetail, BaseRequestDto, WorkflowApprovalStep, FileUploadDto } from '@models/workflow-approval.model';
import { mapToRequestDetail, RequestTypeEnum, RequestStatusEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getRequestStatusBadgeClass, getPriorityBadgeClass, getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { TranslationService } from '@services/translation.service';
import { ConfigService } from '@services/config.service';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { APIOperationResponse } from '@models/api-response.model';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';
import { getFileSizeFromFile, removeFile, validateFileSize, MAX_FILE_SIZE_MB } from '@utils/file.utils';
import { ConfirmationDialogComponent, ConfirmationType } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';

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
    DropdownComponent,
    ConfirmationDialogComponent
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
  orderFiles: FileUploadDto[] = []; // Files attached to the request (Order, Return, Discard)

  // Collapsible sections state
  isApprovalWorkflowExpanded: boolean = true;

  // Approval/Rejection form
  comments: string = '';
  sendToHigherApproval: string = 'no'; // 'yes' = yes, 'no' = no (default is 'no')
  processing: boolean = false;


  // File upload for approval/rejection
  approvalFiles: File[] = [];
  approvalFileInput: HTMLInputElement | null = null;

  // Higher approval dropdown options
  higherApprovalOptions: { value: string; label: string }[] = [];

  // Return for review
  showReturnForReview: boolean = false;
  returnToStepId: number | null = null;
  previousWorkflowSteps: any[] = [];
  loadingPreviousSteps: boolean = false;

  // Confirmation dialog state
  confirmationDialog = {
    isOpen: false,
    title: '',
    message: '',
    type: 'warning' as ConfirmationType,
    confirmText: '',
    cancelText: '',
    onConfirm: () => { }
  };


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

  // File upload for supply submission
  selectedFiles: File[] = [];
  fileInputElement: HTMLInputElement | null = null;
  existingFiles: Array<{ id: number; fileName: string; originalName: string }> = [];

  // Additional file upload after submission
  additionalFiles: File[] = [];
  additionalFileInputElement: HTMLInputElement | null = null;
  isUploadingAdditionalFiles: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private http: HttpClient,
    private config: ConfigService,
    private authService: BackendAuthService,
    private toastService: ToastService,
    private supplyService: SupplyService,
    private lookupService: LookupService,
    public translationService: TranslationService,
    private translateService: TranslateService,
    private requestStatusUpdateService: RequestStatusUpdateService,
    private fileUploadService: FileUploadService
  ) { }

  // Bound functions for dropdown label generation to preserve 'this' context
  getRankDisplayNameFn = (rank: any) => this.getRankDisplayName(rank);
  getWorkflowStepDisplayNameFn = (step: any) => this.getWorkflowStepDisplayName(step);

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

          // Store request files if available (for Order, Return, Discard)
          this.orderFiles = baseRequest.files || [];

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

            // Merge full details (including usage info) into baseRequest
            if (detailData) {
              Object.assign(baseRequest, detailData);
            }

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

          // Load existing files if available
          if (supply.files && supply.files.length > 0) {
            this.existingFiles = supply.files.map(f => ({
              id: f.id,
              fileName: f.fileName,
              originalName: f.originalName
            }));
          } else {
            this.existingFiles = [];
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
            const errorMsg = translations['workflowApprovalDetail.errors.failedToLoadRanks'] || translations['toast.failedToLoadRoles'];
            this.toastService.error(errorMsg, translations['toast.error']);
          });
        }
      });
  }

  /**
   * Get approval history with requester as the first step
   */
  get displayApprovalHistory(): WorkflowApprovalStep[] {
    if (!this.requestDetail) {
      return [];
    }

    const requesterStep: WorkflowApprovalStep = {
      id: 0,
      approverName: this.requestDetail.requesterName || 'Unknown Requester',
      status: 'Approved',
      applicationRoleName: 'Requester (Order Requesting Entity)',
      approvedDateTime: this.requestDetail.requestDate,
      isPending: false,
      comments: this.requestDetail.notes
    };

    return [requesterStep, ...(this.requestDetail.approvalHistory || [])];
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

    // Show confirmation dialog
    this.translateService.get([
      'workflowApprovalDetail.confirmApprove',
      'workflowApprovalDetail.confirmApproveMessage',
      'common.yes',
      'common.cancel'
    ]).subscribe(translations => {
      this.showConfirmationDialog(
        translations['workflowApprovalDetail.confirmApprove'] || 'Confirm Approval',
        translations['workflowApprovalDetail.confirmApproveMessage'] || 'Are you sure you want to approve this request?',
        'success',
        translations['common.yes'] || 'Yes',
        translations['common.cancel'] || 'Cancel',
        () => {
          this.processing = true;

          const formData = this.createApprovalFormData(true);

          this.apiService.postWithAuth(
            API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
            formData
          )
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.comments = '';
                this.sendToHigherApproval = 'no';
                this.approvalFiles = [];
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
      );
    });
  }

  rejectRequest(): void {
    if (this.processing || !this.requestDetail) return;

    // Show confirmation dialog
    this.translateService.get([
      'workflowApprovalDetail.confirmReject',
      'workflowApprovalDetail.confirmRejectMessage',
      'common.yes',
      'common.cancel'
    ]).subscribe(translations => {
      this.showConfirmationDialog(
        translations['workflowApprovalDetail.confirmReject'] || 'Confirm Rejection',
        translations['workflowApprovalDetail.confirmRejectMessage'] || 'Are you sure you want to reject this request?',
        'danger',
        translations['common.yes'] || 'Yes',
        translations['common.cancel'] || 'Cancel',
        () => {
          this.processing = true;

          const formData = this.createApprovalFormData(false);

          this.apiService.postWithAuth(
            API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
            formData
          )
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.comments = '';
                this.sendToHigherApproval = 'no';
                this.approvalFiles = [];
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
      );
    });
  }

  /**
   * Load previous workflow steps that the request can be returned to
   */
  loadPreviousWorkflowSteps(): void {
    if (!this.requestId) return;

    this.loadingPreviousSteps = true;
    this.apiService.getWithAuth<any[]>(
      `${API_ENDPOINTS.WORKFLOW_APPROVAL.BASE}/previous-steps/${this.requestId}`
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const data = Array.isArray(response) ? response : (response?.data || []);
          this.previousWorkflowSteps = data;
          this.loadingPreviousSteps = false;
        },
        error: (error) => {
          this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load previous workflow steps');
          this.loadingPreviousSteps = false;
        }
      });
  }

  /**
   * Return request for review to a previous workflow step
   */
  returnForReview(): void {
    if (this.processing || !this.requestDetail || !this.returnToStepId) {
      if (!this.returnToStepId) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.selectStepToReturn']).subscribe(translations => {
          this.toastService.error(
            translations['workflowApprovalDetail.errors.selectStepToReturn'] || 'Please select a step to return to',
            translations['toast.error']
          );
        });
      }
      return;
    }

    // Show confirmation dialog
    this.translateService.get([
      'workflowApprovalDetail.confirmReturnForReview',
      'workflowApprovalDetail.confirmReturnForReviewMessage',
      'common.yes',
      'common.cancel'
    ]).subscribe(translations => {
      this.showConfirmationDialog(
        translations['workflowApprovalDetail.confirmReturnForReview'] || 'Confirm Return for Review',
        translations['workflowApprovalDetail.confirmReturnForReviewMessage'] || 'Are you sure you want to return this request for review?',
        'warning',
        translations['common.yes'] || 'Yes',
        translations['common.cancel'] || 'Cancel',
        () => {
          this.processing = true;

          const formData = new FormData();

          // Add DTO fields
          formData.append('BaseRequestID', this.requestId.toString());
          formData.append('IsApproved', 'false');
          formData.append('Action', '6'); // RequestStatus.ReturnedForReview = 6
          formData.append('ReturnToWorkflowStepId', this.returnToStepId!.toString());

          if (this.comments) {
            formData.append('Comments', this.comments);
          }

          // Add files if any
          if (this.approvalFiles && this.approvalFiles.length > 0) {
            this.approvalFiles.forEach((file) => {
              formData.append('files', file);
            });
          }

          this.apiService.postWithAuth(
            API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
            formData
          )
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.comments = '';
                this.returnToStepId = null;
                this.showReturnForReview = false;
                this.approvalFiles = [];
                // Notify other components about the status update
                this.requestStatusUpdateService.notifyRequestStatusUpdated(this.requestId);
                // Reload to get updated status and approval history
                this.loadRequestDetail();
              },
              error: (error) => {
                this.error = ErrorHandler.extractErrorMessage(error, 'Failed to return request for review');
                this.processing = false;
                // Revert status on error
                if (this.requestDetail) {
                  this.loadRequestDetail();
                }
              }
            });
        }
      );
    });
  }

  /**
   * Toggle return for review section
   */
  toggleReturnForReview(): void {
    this.showReturnForReview = !this.showReturnForReview;
    if (this.showReturnForReview && this.previousWorkflowSteps.length === 0) {
      this.loadPreviousWorkflowSteps();
    }
  }

  /**
   * Check if return for review is available
   */
  canReturnForReview(): boolean {
    if (!this.requestDetail || this.processing) {
      return false;
    }

    // Allow return for review when status is Pending or ReturnedForReview
    if (this.requestDetail.status !== 'Pending' && this.requestDetail.status !== 'ReturnedForReview' && this.requestDetail.status !== 'Returned') {
      return false;
    }

    // User must be able to approve/reject to return
    return this.canApproveOrReject();
  }

  /**
   * Get workflow step display name
   */
  getWorkflowStepDisplayName(step: any): string {
    if (!step) return '';
    return `Step ${step.stepOrder}: ${step.applicationRoleName || 'Unknown Role'}`;
  }

  /**
   * Create FormData for approval/rejection request with optional files
   */
  private createApprovalFormData(isApproved: boolean): FormData {
    const formData = new FormData();


    // Add DTO fields (using PascalCase to match backend DTO)
    formData.append('BaseRequestID', this.requestId.toString());
    formData.append('IsApproved', isApproved.toString());
    formData.append('Action', isApproved ? RequestStatusEnum.Approved.toString() : RequestStatusEnum.Rejected.toString());


    if (this.comments) {
      formData.append('Comments', this.comments);
    }


    if (this.sendToHigherApproval === 'yes') {
      formData.append('SendToHigherApproval', 'true');
    }


    // Add files if any (backend expects 'files' parameter)
    if (this.approvalFiles && this.approvalFiles.length > 0) {
      this.approvalFiles.forEach((file) => {
        formData.append('files', file);
      });
    }


    return formData;
  }

  /**
   * Handle file selection for approval/rejection
   */
  onApprovalFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];

      // Validate file sizes
      newFiles.forEach(file => {
        const validation = validateFileSize(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        }
      });

      // Show error message if any files exceed the limit
      if (invalidFiles.length > 0) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileSizeExceeded']).subscribe(translations => {
          const errorMessage = translations['workflowApprovalDetail.errors.fileSizeExceeded']
            ? `${translations['workflowApprovalDetail.errors.fileSizeExceeded']} ${MAX_FILE_SIZE_MB} MB`
            : invalidFiles.join('\n');
          this.toastService.error(errorMessage, translations['toast.error'] || 'Error');
        });
        // Reset input
        if (input) {
          input.value = '';
        }
        return;
      }

      // Add valid files
      this.approvalFiles = [...this.approvalFiles, ...newFiles];
      // Reset input to allow selecting the same file again
      if (input) {
        input.value = '';
      }
    }
  }

  /**
   * Remove a file from the approval files list
   */
  removeApprovalFile(index: number): void {
    if (index >= 0 && index < this.approvalFiles.length) {
      this.approvalFiles.splice(index, 1);
    }
  }

  /**
   * Download a file from approval history
   */
  downloadApprovalFile(file: any): void {
    if (!file || !file.id) {
      return;
    }
    console.log(file);
    const downloadUrl = this.fileUploadService.getFileDownloadUrl(file.id);
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }


    const fileName = file.originalName || file.fileName || 'download';


    this.http.get(downloadUrl, {
      headers: headers,
      responseType: 'blob'
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: any) => {
          console.error('Failed to download file:', error);
          this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDownloadFailed']).subscribe(translations => {
            this.toastService.error(
              ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.fileDownloadFailed'] || 'Failed to download file'),
              translations['toast.error']
            );
          });
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (blob: Blob) => {
          // Create blob URL and trigger download
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        },
        error: () => {
          // Error already handled in catchError
        }
      });
  }

  /**
   * Get label for higher approval dropdown option
   */
  higherApprovalOptionLabel = (option: DropdownOption<{ value: string, label: string }> | { value: string, label: string } | null): string => {
    if (!option) return '';
    let item: { value: string, label: string } | null = null;

    if (typeof option === 'object' && option !== null) {
      if ('value' in option) {
        item = option.value as { value: string, label: string };
      } else if ('value' in option && 'label' in option) {
        item = option as { value: string, label: string };
      }
    }

    if (!item || !item.value) return '';
    return this.translateService.instant(item.value === 'yes' ? 'common.yes' : 'common.no');
  };

  canApproveOrReject(): boolean {
    if (!this.requestDetail || this.processing) {
      return false;
    }

    // Allow action buttons for both Pending and ReturnedForReview statuses
    if (this.requestDetail.status !== 'Pending' && this.requestDetail.status !== 'ReturnedForReview' && this.requestDetail.status !== 'Returned') {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    // If the current user is the requester, don't show approve/reject buttons
    if (this.requestDetail.requesterId && currentUser.id) {
      const requesterId = this.requestDetail.requesterId.toLowerCase().trim();
      const currentUserId = currentUser.id.toLowerCase().trim();
      if (requesterId === currentUserId) {
        return false;
      }
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


    if (currentPendingStep.isCurrentUserApprover !== undefined) {


      if (isAdministrator) {
        return true;
      }
      return currentPendingStep.isCurrentUserApprover;
    }

    // Check if user has already acted in the current workflow step
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

    // Additional check: if this is not a pending step for the current user, don't show buttons
    // This prevents buttons from showing after the request has been approved/rejected by this user
    const hasAnyApprovedOrRejectedByCurrentUser = this.requestDetail.approvalHistory?.some(step => {
      if (step.status === 'Approved' || step.status === 'Rejected') {
        const changedBy = step.changedBy?.toLowerCase() || '';
        const approverName = step.approverName?.toLowerCase() || '';

        const matchesUserId = currentUserId && changedBy.includes(currentUserId);
        const matchesUserName = currentUserName && (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
        const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);

        return matchesUserId || matchesUserName || matchesUserEmail;
      }
      return false;
    });

    if (hasAnyApprovedOrRejectedByCurrentUser) {
      // If user has acted before, check if they are authorized for the CURRENT pending step
      // This handles the case where a user appears multiple times in the workflow


      const currentUserRoles = this.authService.getCurrentUser()?.roles || [];


      // Helper to normalize strings for comparison
      const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';


      const pendingRoleName = normalize(currentPendingStep.applicationRoleName || '');
      const pendingRoleId = normalize(currentPendingStep.applicationRoleId || '');


      // Check if user has a role that matches the pending step
      const hasMatchingRole = currentUserRoles.some(userRole => {
        const normalizedUserRole = normalize(userRole);
        if (!normalizedUserRole) return false;


        // 1. Check against Role ID (if available)
        if (pendingRoleId) {
          if (normalizedUserRole === pendingRoleId) return true;
          // Handle cases where ID might be a subset or superset
          if (normalizedUserRole.includes(pendingRoleId) || pendingRoleId.includes(normalizedUserRole)) return true;
        }

        // 2. Check against Role Name
        if (pendingRoleName) {
          // Exact match
          if (normalizedUserRole === pendingRoleName) return true;


          // Prefix match (e.g. "Director" matches "Director (Department)")
          if (pendingRoleName.startsWith(normalizedUserRole)) return true;


          // Substring match for sufficiently long roles (avoids false positives like "User" matching "SuperUser")
          // If the role string is long enough (>10 chars), assume it's specific enough to be safe
          if (normalizedUserRole.length > 10 && pendingRoleName.includes(normalizedUserRole)) return true;


          // Reverse check: if pending role name is inside user role (unlikely but possible)
          if (pendingRoleName.length > 10 && normalizedUserRole.includes(pendingRoleName)) return true;
        }


        return false;
      });

      if (!hasMatchingRole) {
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
          this.translateService.get(['toast.error', 'toast.failedToConfirmPickupDate']).subscribe(translations => {
            const errorMessage = ErrorHandler.extractErrorMessage(error, translations['toast.failedToConfirmPickupDate']);
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
   * Check if supply exists and is already submitted
   */
  isSupplySubmitted(): boolean {
    return !!(this.supplyId && this.supplyData && this.supplyData.submissionStatus === 2);
  }

  /**
   * Submit supply with receiver information
   */
  submitSupply(): void {
    if (this.isSubmittingSupply || !this.supplyId) {
      return;
    }

    // Prevent submission if already submitted
    if (this.supplyData?.submissionStatus === 2) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.alreadySubmitted']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.alreadySubmittedMessage'] || 'Supply is already submitted',
          translations['toast.error']
        );
      });
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

    // Validate that at least one file is selected
    if (!this.selectedFiles || this.selectedFiles.length === 0) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.filesRequired']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.filesRequired'] || 'At least one file attachment is required',
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

    this.supplyService.submit(this.supplyId, submitDto, this.selectedFiles)
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
          // Clear selected files after successful submission
          this.selectedFiles = [];
          if (this.fileInputElement) {
            this.fileInputElement.value = '';
          }
          // Reload to refresh supply status and show newly uploaded files
          this.loadRequestDetail();
        },
        error: (error) => {
          // Extract error message from API response
          let errorMessage = 'Failed to submit supply';

          if (error?.error?.message) {
            errorMessage = error.error.message;
          } else if (error?.message) {
            errorMessage = error.message;
          } else {
            errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to submit supply');
          }

          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(
              errorMessage,
              translations['toast.error'] || 'Error'
            );
          });
          this.isSubmittingSupply = false;
        }
      });
  }

  /**
   * Handle file selection - adds files to existing selection
   */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      // Validate file sizes and separate valid/invalid files
      newFiles.forEach(file => {
        const validation = validateFileSize(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        } else {
          validFiles.push(file);
        }
      });

      // Show error message if any files exceed the limit
      if (invalidFiles.length > 0) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileSizeExceeded']).subscribe(translations => {
          const errorMessage = translations['workflowApprovalDetail.errors.fileSizeExceeded']
            ? `${translations['workflowApprovalDetail.errors.fileSizeExceeded']} ${MAX_FILE_SIZE_MB} MB`
            : invalidFiles.join('\n');
          this.toastService.error(errorMessage, translations['toast.error'] || 'Error');
        });
      }

      // Add only valid files to existing selection (avoid duplicates by name)
      validFiles.forEach(newFile => {
        const isDuplicate = this.selectedFiles.some(existingFile =>
          existingFile.name === newFile.name && existingFile.size === newFile.size
        );
        if (!isDuplicate) {
          this.selectedFiles.push(newFile);
        }
      });

      this.fileInputElement = input;
      // Reset input to allow selecting the same files again if needed
      input.value = '';
    }
  }

  /**
   * Remove a file from the selection
   */
  removeFile(index: number): void {
    removeFile(this.selectedFiles, index, this.fileInputElement);
  }

  /**
   * Get file size in readable format
   */
  getFileSize = getFileSizeFromFile;
  MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;

  /**
   * Handle additional file selection after submission
   */
  onAdditionalFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      // Validate file sizes and separate valid/invalid files
      newFiles.forEach(file => {
        const validation = validateFileSize(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        } else {
          validFiles.push(file);
        }
      });

      // Show error message if any files exceed the limit
      if (invalidFiles.length > 0) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileSizeExceeded']).subscribe(translations => {
          const errorMessage = translations['workflowApprovalDetail.errors.fileSizeExceeded']
            ? `${translations['workflowApprovalDetail.errors.fileSizeExceeded']} ${MAX_FILE_SIZE_MB} MB`
            : invalidFiles.join('\n');
          this.toastService.error(errorMessage, translations['toast.error'] || 'Error');
        });
      }

      // Add only valid files to existing selection (avoid duplicates by name)
      validFiles.forEach(newFile => {
        const isDuplicate = this.additionalFiles.some(existingFile =>
          existingFile.name === newFile.name && existingFile.size === newFile.size
        );
        if (!isDuplicate) {
          this.additionalFiles.push(newFile);
        }
      });

      this.additionalFileInputElement = input;
      // Reset input to allow selecting the same files again if needed
      input.value = '';
    }
  }

  /**
   * Remove an additional file from the selection
   */
  removeAdditionalFile(index: number): void {
    this.additionalFiles.splice(index, 1);
    // Update the file input if needed
    if (this.additionalFileInputElement && this.additionalFiles.length === 0) {
      this.additionalFileInputElement.value = '';
    }
  }

  /**
   * Upload additional files to an already-submitted supply
   */
  uploadAdditionalFiles(): void {
    if (this.isUploadingAdditionalFiles || !this.supplyId || this.additionalFiles.length === 0) {
      return;
    }

    this.isUploadingAdditionalFiles = true;

    // Create FormData for multipart/form-data request
    const formData = new FormData();

    // Append files
    this.additionalFiles.forEach((file) => {
      formData.append('files', file);
    });

    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    // Remove Content-Type header for FormData
    headers = headers.delete('Content-Type');

    this.http.post<APIOperationResponse<number[]>>(
      `${this.config.apiUrl}/FileUpload/upload-for-entity?entity=5&entityId=${this.supplyId}`,
      formData,
      { headers }
    )
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: any) => {
          console.error('Failed to upload additional files:', error);
          this.isUploadingAdditionalFiles = false;
          this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileUploadFailed']).subscribe(translations => {
            this.toastService.error(
              ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.fileUploadFailed'] || 'Failed to upload files'),
              translations['toast.error']
            );
          });
          return throwError(() => error);
        })
      )
      .subscribe((response: APIOperationResponse<number[]>) => {
        if (response.succeeded) {
          // Clear selected files
          this.additionalFiles = [];
          if (this.additionalFileInputElement) {
            this.additionalFileInputElement.value = '';
          }

          // Reload supply data to refresh the file list
          this.loadSupplyData();

          this.translateService.get(['toast.success', 'workflowApprovalDetail.success.filesUploaded']).subscribe(translations => {
            this.toastService.success(
              translations['workflowApprovalDetail.success.filesUploaded'] || 'Files uploaded successfully',
              translations['toast.success']
            );
          });
        } else {
          this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileUploadFailed']).subscribe(translations => {
            this.toastService.error(
              response.message || translations['workflowApprovalDetail.errors.fileUploadFailed'] || 'Failed to upload files',
              translations['toast.error']
            );
          });
        }
        this.isUploadingAdditionalFiles = false;
      });
  }

  /**
   * Download an existing file
   */
  downloadFile(fileId: number, fileName: string): void {
    const downloadUrl = this.fileUploadService.getFileDownloadUrl(fileId);
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    this.http.get(`${this.config.apiUrl}/FileUpload/serve/${fileId}`, {
      headers: headers,
      responseType: 'blob'
    })
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: any) => {
          console.error('Failed to download file:', error);
          this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDownloadFailed']).subscribe(translations => {
            this.toastService.error(
              ErrorHandler.extractErrorMessage(error, translations['workflowApprovalDetail.errors.fileDownloadFailed'] || 'Failed to download file'),
              translations['toast.error']
            );
          });
          return throwError(() => error);
        })
      )
      .subscribe((blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });
  }

  /**
   * Delete an existing file
   */
  deleteFile(fileId: number, fileName: string, index: number): void {
    // Confirm deletion
    this.translateService.get([
      'workflowApprovalDetail.confirmDeleteFile',
      'workflowApprovalDetail.confirmDeleteFileMessage',
      'common.delete',
      'common.cancel'
    ]).subscribe(translations => {
      const confirmed = confirm(
        `${translations['workflowApprovalDetail.confirmDeleteFileMessage'] || 'Are you sure you want to delete'} "${fileName}"?`
      );

      if (!confirmed) {
        return;
      }

      const token = localStorage.getItem('auth_token');
      let headers = new HttpHeaders();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }

      this.http.delete<APIOperationResponse<boolean>>(`${this.config.apiUrl}/FileUpload/${fileId}`, {
        headers: headers
      })
        .pipe(
          takeUntil(this.destroy$),
          catchError((error: any) => {
            console.error('Failed to delete file:', error);
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDeleteFailed']).subscribe(errTranslations => {
              this.toastService.error(
                ErrorHandler.extractErrorMessage(error, errTranslations['workflowApprovalDetail.errors.fileDeleteFailed'] || 'Failed to delete file'),
                errTranslations['toast.error']
              );
            });
            return throwError(() => error);
          })
        )
        .subscribe((response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            // Remove file from the list
            this.existingFiles.splice(index, 1);

            // Reload supply data to refresh the file list
            if (this.supplyId) {
              this.loadSupplyData();
            }

            this.translateService.get(['toast.success', 'workflowApprovalDetail.success.fileDeleted']).subscribe(successTranslations => {
              this.toastService.success(
                successTranslations['workflowApprovalDetail.success.fileDeleted'] || 'File deleted successfully',
                successTranslations['toast.success']
              );
            });
          } else {
            this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.fileDeleteFailed']).subscribe(errTranslations => {
              this.toastService.error(
                response.message || errTranslations['workflowApprovalDetail.errors.fileDeleteFailed'] || 'Failed to delete file',
                errTranslations['toast.error']
              );
            });
          }
        });
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

  getLocalizedValue(en: string | undefined, ar: string | undefined): string {
    const lang = this.translateService.currentLang;
    if (lang === 'ar') {
      return ar || en || '';
    }
    return en || ar || '';
  }

  formatTime(time: string | undefined): string {
    if (!time) return '';
    if (time.length === 4 && !time.includes(':')) {
      return `${time.substring(0, 2)}:${time.substring(2, 4)}`;
    }
    return time;
  }

  /**
   * Show confirmation dialog
   */
  showConfirmationDialog(title: string, message: string, type: ConfirmationType, confirmText: string, cancelText: string, onConfirm: () => void): void {
    this.confirmationDialog = {
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      onConfirm
    };
  }

  /**
   * Close confirmation dialog
   */
  closeConfirmationDialog(): void {
    this.confirmationDialog.isOpen = false;
  }

  /**
   * Handle confirmation dialog confirm action
   */
  onConfirmationConfirmed(): void {
    this.confirmationDialog.onConfirm();
    this.closeConfirmationDialog();
  }

  /**
   * Handle confirmation dialog cancel action
   */
  onConfirmationCancelled(): void {
    this.closeConfirmationDialog();
  }
}

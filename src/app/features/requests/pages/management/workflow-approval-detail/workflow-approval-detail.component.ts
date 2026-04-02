import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle, Clock, User, Package, FileText, Eye, ChevronDown, ChevronUp, RotateCcw, X, Check, XCircle, History as HistoryIcon } from 'lucide-angular';
import { Subject, takeUntil, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BackendAuthService } from '@services/backend-auth.service';
import { ToastService } from '@services/toast.service';
import { SupplyService, SupplyDto, SubmitSupplyDto } from '@services/supply.service';
import { AssetSupplyService } from '@services/asset-supply.service';
import { LookupItem } from '@services/lookup.service';
import { RequestDetail, BaseRequestDto, WorkflowApprovalStep, FileUploadDto } from '@models/workflow-approval.model';
import { mapToRequestDetail } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getRequestStatusBadgeClass, getPriorityBadgeClass, getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { TranslationService } from '@services/translation.service';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { validateFile, showFileValidationErrors } from '@utils/file.utils';
import { ConfirmationDialogComponent, ConfirmationType } from '@shared/components/confirmation-dialog/confirmation-dialog.component';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { UserDelegationService } from '@services/user-delegation.service';
// Import extracted services
import { WorkflowApprovalDataService } from './services/workflow-approval-data.service';
import { WorkflowApprovalPermissionsService } from './services/workflow-approval-permissions.service';
import { WorkflowApprovalActionsService } from './services/workflow-approval-actions.service';
import { WorkflowApprovalSupplyService } from './services/workflow-approval-supply.service';
import { WorkflowApprovalNavigationService } from './services/workflow-approval-navigation.service';
import { WorkflowApprovalConfirmationService } from './services/workflow-approval-confirmation.service';
import { WorkflowApprovalStateService } from './services/workflow-approval-state.service';
import {
  getDisplayApprovalHistory,
  formatApprovalDateTime,
  getWorkflowStepDisplayName,
  getTransitionDisplayName,
  getLocalizedValue as getLocalizedValueHelper,
  getApproverName as getApproverNameHelper,
  resolveUsagePurpose,
  hasPendingStep as hasPendingStepHelper,
  isLastApprovalCompleted,
  hasHigherApproval,
  getCurrentStepTransitions,
  getRankDisplayName as getRankDisplayNameHelper
} from './utils/workflow-approval-helpers';
import { WorkflowSupplySubmissionComponent } from './components/workflow-supply-submission/workflow-supply-submission.component';
import { WorkflowApprovalActionsComponent } from './components/workflow-approval-actions/workflow-approval-actions.component';
import { WorkflowPickupDateComponent } from './components/workflow-pickup-date/workflow-pickup-date.component';
import { WorkflowApprovalTimelineComponent } from './components/workflow-approval-timeline/workflow-approval-timeline.component';
import { WorkflowRequestInformationComponent } from './components/workflow-request-information/workflow-request-information.component';
import { WorkflowRequestItemsComponent } from './components/workflow-request-items/workflow-request-items.component';
import { WorkflowSupplySummaryComponent } from './components/workflow-supply-summary/workflow-supply-summary.component';
import { WeaponReviewItemsModalComponent } from './components/weapon-review-items-modal/weapon-review-items-modal.component';
import { OrderItemTrackingModalComponent } from './components/order-item-tracking-modal/order-item-tracking-modal.component';
import { WorkflowReturnDepotComponent } from './components/workflow-return-depot/workflow-return-depot.component';
import { WorkflowReturnDeliveryDateComponent } from './components/workflow-return-delivery-date/workflow-return-delivery-date.component';

@Component({
  selector: 'app-workflow-approval-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent,
    ConfirmationDialogComponent,
    AppDateTimePipe,
    WorkflowSupplySubmissionComponent,
    WorkflowApprovalActionsComponent,
    WorkflowPickupDateComponent,
    WorkflowApprovalTimelineComponent,
    WorkflowRequestInformationComponent,
    WorkflowRequestItemsComponent,
    WorkflowSupplySummaryComponent,
    WeaponReviewItemsModalComponent,
    OrderItemTrackingModalComponent,
    WorkflowReturnDepotComponent,
    WorkflowReturnDeliveryDateComponent
  ],
  templateUrl: './workflow-approval-detail.component.html',
  styleUrls: ['./workflow-approval-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  readonly RotateCcw = RotateCcw;
  readonly X = X;
  readonly Check = Check;
  readonly XCircle = XCircle;
  readonly HistoryIcon = HistoryIcon; // Add History Icon

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  /** Arrow for “go forward” CTAs (e.g. Review Return Items). */
  get forwardNavIcon() {
    return this.isRTL ? ArrowLeft : ArrowRight;
  }

  readonly destroy$ = new Subject<void>();


  private readonly SUPPLY_REVIEW_PERMISSION = 'UpdateRequestAndSuggestLots';
  private readonly UPDATE_REQUEST_AND_SUPPLY_PERMISSION = 'UpdateRequestAndSupply';
  private readonly CANNOT_REJECT_PERMISSION = 'CannotRejectRequest';
  private readonly SET_SUPPLY_PICKUP_DATE_PERMISSION = 'SetSupplyPickupDate';
  private readonly CONFIRM_SUPPLY_PICKUP_DATE_PERMISSION = 'ConfirmSupplyPickupDate';
  private readonly SUBMIT_SUPPLY_PERMISSION = 'SubmitSupply';
  private readonly REVIEW_WEAPON_SUPPLY_PERMISSION = 'ReviewWeaponSupply';

  requestId: number = 0;
  requestDetail: RequestDetail | null = null;
  loading: boolean = true;
  error: string | null = null;
  orderFiles: FileUploadDto[] = []; // Files attached to the request (Order, Return, Discard)


  // Approval/Rejection form
  processing: boolean = false;

  // Return for review (needed for loading previous steps)
  previousWorkflowSteps: any[] = [];
  loadingPreviousSteps: boolean = false;

  // Confirmation dialog state (from service)
  confirmationDialog$ = this.confirmationService.confirmationDialog$;


  // Pickup date management
  pickupDate: string = '';
  isPickupDateAlreadySet: boolean = false; // Track if date was already set (from backend or after setting)
  orderSupplyDate: string | Date | null = null; // Store SupplyDate from OrderDto for weapon orders

  // Weapon item detection
  isWeaponOrder: boolean = false; // Track if this order contains weapon items

  supplyId: number | null = null;
  supplyData: SupplyDto | null = null;
  /** True once a Supply exists (ammo/explosives) or AssetSupply exists (weapon-only orders). Drives visibility of the workflow supply summary card. */
  hasInitialSupplyForSummary = false;
  /** Incremented to tell {@link WorkflowSupplySummaryComponent} to re-fetch after supply/pickup updates. */
  workflowSupplySummaryRefreshTick = 0;
  ranks: LookupItem[] = [];
  isLoadingRanks: boolean = false;
  isUserRestricted: boolean = false;

  // Weapon Review Items Modal
  isWeaponReviewItemsModalOpen: boolean = false;

  // Tracking Modal
  isTrackingModalOpen: boolean = false;
  trackingItemId: number | null = null;
  trackingItemName: string | null = null;

  // Use state service for supply submission check
  isSupplySubmitted(): boolean {
    return this.stateService.isSupplySubmitted();
  }

  constructor(
    private route: ActivatedRoute,
    private authService: BackendAuthService,
    private toastService: ToastService,
    private supplyService: SupplyService,
    public translationService: TranslationService,
    private translateService: TranslateService,
    private userDelegationService: UserDelegationService,
    // Extracted services
    private dataService: WorkflowApprovalDataService,
    private permissionsService: WorkflowApprovalPermissionsService,
    private actionsService: WorkflowApprovalActionsService,
    private supplyServiceHelper: WorkflowApprovalSupplyService,
    private navigationService: WorkflowApprovalNavigationService,
    private confirmationService: WorkflowApprovalConfirmationService,
    private stateService: WorkflowApprovalStateService,
    private assetSupplyService: AssetSupplyService,
    private cdr: ChangeDetectorRef
  ) { }

  // Permission check methods - delegate to service
  canApproveOrReject(): boolean {
    return this.permissionsService.canApproveOrReject(this.requestDetail, this.processing);
  }

  canRejectRequest(): boolean {
    return this.permissionsService.canRejectRequest();
  }

  canReturnForReview(): boolean {
    return this.permissionsService.canReturnForReview(this.requestDetail, this.processing);
  }


  canSetSupplyPickupDate(): boolean {
    return this.permissionsService.canSetSupplyPickupDate(this.requestDetail);
  }

  canConfirmSupplyPickupDate(): boolean {
    return this.permissionsService.canConfirmSupplyPickupDate(this.requestDetail);
  }

  isPickupDateEditable(): boolean {
    return this.permissionsService.isPickupDateEditable(this.requestDetail);
  }

  canSubmitSupply(): boolean {
    // Use local values to ensure template reactivity works correctly
    // The state service might not be updated at the exact moment the template checks
    return this.permissionsService.canSubmitSupply(this.requestDetail, this.isWeaponOrder);
  }

  canViewWorkflowSupplySummarySection(): boolean {
    return this.permissionsService.canViewWorkflowSupplySummarySection(this.requestDetail);
  }

  /** Supply summary is shown only when the user may view it and an initial supply record exists. */
  showWorkflowSupplySummarySection(): boolean {
    return this.canViewWorkflowSupplySummarySection() && this.hasInitialSupplyForSummary;
  }

  private bumpWorkflowSupplySummaryRefresh(): void {
    this.workflowSupplySummaryRefreshTick++;
  }

  hasHigherApproval(): boolean {
    return hasHigherApproval(this.requestDetail);
  }

  getCurrentStepTransitions(): any[] {
    return getCurrentStepTransitions(this.requestDetail);
  }

  getTransitionDisplayName = (option: any): string => {
    return getTransitionDisplayName(option, this.translateService);
  }

  hasTransitions(): boolean {
    const transitions = this.getCurrentStepTransitions();
    return transitions.length > 0;
  }

  hasPendingStep(): boolean {
    return hasPendingStepHelper(this.requestDetail);
  }

  canProcessReturnItems(): boolean {
    return this.permissionsService.canProcessReturnItems(this.requestDetail);
  }

  /**
   * Show the Review Return Items card when the return workflow is pending and
   * depot + delivery are set (same prerequisites as approving the return).
   * The navigation button is shown only if {@link canProcessReturnItems} is true.
   */
  showReviewReturnItemsSection(): boolean {
    if (!this.requestDetail || this.requestDetail.requestType !== 'Return' || !this.hasPendingStep()) {
      return false;
    }
    return !!this.requestDetail.returnToDepotId && !!this.requestDetail.deliveryDate;
  }

  navigateToProcessReturnItems(): void {
    this.navigationService.navigateToProcessReturnItems(this.requestId);
  }

  isLastApprovalCompleted(): boolean {
    return isLastApprovalCompleted(this.requestDetail);
  }

  resolveUsagePurpose(): string {
    return resolveUsagePurpose(this.requestDetail, this.translateService);
  }

  getLocalizedValue(en: string | undefined, ar: string | undefined): string {
    return getLocalizedValueHelper(en, ar, this.translateService);
  }

  // Bound functions for dropdown label generation to preserve 'this' context
  getWorkflowStepDisplayNameFn = (step: any) => getWorkflowStepDisplayName(step, this.translateService);

  /**
   * Get rank display name for dropdown (using helper)
   */
  getRankDisplayNameFn = (rank: any) => getRankDisplayNameHelper(rank, this.translateService);



  ngOnInit(): void {
    // Check delegation restriction status
    this.userDelegationService.checkUserRestriction()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isRestricted) => {
          this.isUserRestricted = isRestricted;
          this.cdr.markForCheck();
        }
      });

    // Initialize isSuperAdmin in state service
    const isSuperAdmin = this.authService.isSuperAdmin();
    this.stateService.updateState({ isSuperAdmin });

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
    this.orderSupplyDate = null;
    // Reset weapon order detection
    this.isWeaponOrder = false;

    this.loadRequestDetailInternal(true);
  }


  /**
   * Load depot selection status for weapon orders and update state.
   * Used to validate that depot is selected before approve when user has SelectDepots permission.
   */
  private loadDepotSelectionStatus(): void {
    this.dataService.loadDepotSelectionStatus(this.requestId, this.destroy$)
      .subscribe({
        next: (isSelected: boolean) => {
          this.stateService.updateState({ isDepotSelected: isSelected });
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Load supply data for the order and populate pickup date and receiver info if available
   */
  loadSupplyData(): void {
    this.dataService.loadSupplyData(this.requestId, this.destroy$)
      .subscribe({
        next: (supply: SupplyDto | null) => {
          if (supply) {
            this.supplyData = supply;
            this.supplyId = supply.id;
            this.hasInitialSupplyForSummary = true;

            // If supply exists and has a supply date, populate the pickup date field
            if (supply.supplyDate) {
              this.pickupDate = this.supplyServiceHelper.formatDateForInput(supply.supplyDate);
              // Mark that the date has already been set to lock the "Set Supply Pickup Date" section
              // The "Update Supply Pickup Date" section remains editable via isPickupDateEditable()
              // This applies to both weapon orders and ammunitions/explosives
              this.isPickupDateAlreadySet = true;
            }

            // Update state service with supply data
            this.stateService.updateState({
              supplyData: this.supplyData,
              isPickupDateAlreadySet: this.isPickupDateAlreadySet
            });

            // Load ranks for dropdown if user can submit supply
            if (this.canSubmitSupply()) {
              this.loadRanks();
            }

            this.bumpWorkflowSupplySummaryRefresh();
            this.cdr.markForCheck();
            return;
          }

          this.supplyData = null;
          this.supplyId = null;
          if (this.isWeaponOrder) {
            this.resolveWeaponInitialSupplyForSummary();
          } else {
            this.hasInitialSupplyForSummary = false;
            this.bumpWorkflowSupplySummaryRefresh();
            this.cdr.markForCheck();
          }
        }
      });
  }

  private resolveWeaponInitialSupplyForSummary(): void {
    this.assetSupplyService.getByOrderId(this.requestId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null))
      )
      .subscribe(assetSupply => {
        if (assetSupply) {
          this.hasInitialSupplyForSummary = true;
          this.bumpWorkflowSupplySummaryRefresh();
          this.cdr.markForCheck();
          return;
        }
        // No asset supply yet — check if depot/batch selections exist
        this.assetSupplyService.getWeaponSupplySelection(this.requestId)
          .pipe(
            takeUntil(this.destroy$),
            catchError(() => of([]))
          )
          .subscribe(selections => {
            this.hasInitialSupplyForSummary = Array.isArray(selections) && selections.length > 0;
            this.bumpWorkflowSupplySummaryRefresh();
            this.cdr.markForCheck();
          });
      });
  }

  /**
   * Load ranks for dropdown
   */
  private loadRanks(): void {
    this.isLoadingRanks = true;
    this.cdr.markForCheck(); // Update loading state immediately
    this.dataService.loadRanks(this.destroy$)
      .subscribe({
        next: (items: LookupItem[]) => {
          this.ranks = items;
          this.isLoadingRanks = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.ranks = [];
          this.isLoadingRanks = false;
          this.cdr.markForCheck();
        }
      });
  }

  getStatusClass(status: string): string {
    return getRequestStatusBadgeClass(status);
  }

  getPriorityClass(priority: string): string {
    return getPriorityBadgeClass(priority);
  }


  /**
   * Load previous workflow steps that the request can be returned to
   */
  loadPreviousWorkflowSteps(): void {
    if (!this.requestId) return;

    this.loadingPreviousSteps = true;
    this.cdr.markForCheck(); // Update loading state immediately
    this.dataService.loadPreviousWorkflowSteps(this.requestId, this.destroy$)
      .subscribe({
        next: (data: any[]) => {
          this.previousWorkflowSteps = data;
          this.loadingPreviousSteps = false;
          // Update state service
          this.stateService.updateState({
            previousWorkflowSteps: this.previousWorkflowSteps,
            loadingPreviousSteps: this.loadingPreviousSteps
          });
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load previous workflow steps');
          this.loadingPreviousSteps = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Handle action completion from approval actions component
   * Silently refresh data without showing full page loading
   * Best practice: Update data seamlessly so user doesn't feel like they took an action
   */
  onActionCompleted(): void {
    // Silently refresh request detail without showing full page loading
    // This ensures approval history updates correctly while maintaining smooth UX
    this.processing = false;
    this.loadRequestDetailInternal(false);
  }

  // Weapon Review Items Modal
  openWeaponReviewItemsModal(): void {
    this.isWeaponReviewItemsModalOpen = true;
  }

  closeWeaponReviewItemsModal(): void {
    this.isWeaponReviewItemsModalOpen = false;
  }

  onWeaponItemChanged(): void {
    // Reload request detail after weapon item add/edit/delete
    this.loadRequestDetailInternal(false);
  }

  // Tracking Modal
  openOrderHistory(): void {
    this.trackingItemId = null;
    this.trackingItemName = null;
    this.isTrackingModalOpen = true;
    this.cdr.markForCheck();
  }

  openItemTracking(item: any): void {
    this.trackingItemId = item.itemId || item.id;
    this.trackingItemName = item.itemName;
    this.isTrackingModalOpen = true;
    this.cdr.markForCheck();
  }

  closeTrackingModal(): void {
    this.isTrackingModalOpen = false;
    this.trackingItemId = null;
    this.trackingItemName = null;
    this.cdr.markForCheck();
  }

  /**
   * Internal method to load request detail
   * Shared by both loadRequestDetail() and refreshRequestDetail()
   * @param showLoading - Whether to show full page loading state
   */
  private loadRequestDetailInternal(showLoading: boolean): void {
    if (showLoading) {
      this.error = null;
      // Reset pickup date and depot selection state when loading new request
      this.isPickupDateAlreadySet = false;
      this.orderSupplyDate = null;
      this.isWeaponOrder = false;
      this.supplyData = null;
      this.supplyId = null;
      this.hasInitialSupplyForSummary = false;
      this.stateService.updateState({ isDepotSelected: false });
    } else {
      // For silent refresh, only reset processing state
      this.processing = false;
    }

    // Use data service to load base request
    this.dataService.loadBaseRequest(this.requestId, this.destroy$)
      .subscribe({
        next: (response: any) => {
          // Handle API response format: { succeeded: true, data: {...} } or direct BaseRequestDto
          const baseRequest: BaseRequestDto = response?.succeeded && response?.data
            ? response.data
            : (response?.id ? response : null);

          if (!baseRequest) {
            if (showLoading) {
              this.translateService.get('workflowApprovalDetail.errors.requestNotFound').subscribe(translation => {
                this.error = translation || 'Request not found';
                this.loading = false;
                this.cdr.markForCheck();
              });
            }
            return; // Silently fail if refreshing
          }

          // Store request files if available (for Order, Return, Discard)
          this.orderFiles = baseRequest.files || [];

          this.dataService.loadRequestItems(baseRequest, this.requestId, this.destroy$).then(() => {
            // Check if weapon order
            if (baseRequest.requestItems && baseRequest.requestType === 'Order') {
              this.isWeaponOrder = this.dataService.checkIfWeaponOrder(baseRequest.requestItems);
              this.orderSupplyDate = this.dataService.extractSupplyDate(baseRequest as any);

              // Format pickup date if available
              if (this.isWeaponOrder && this.orderSupplyDate) {
                this.pickupDate = this.supplyServiceHelper.formatDateForInput(this.orderSupplyDate);
                this.isPickupDateAlreadySet = true;
              }
            }

            // Update requestDetail - this triggers change detection for timeline component
            // The timeline component uses @Input() requestDetail and will automatically update
            this.requestDetail = mapToRequestDetail(baseRequest);

            // Update state service to ensure all child components get updated data
            this.stateService.updateState({
              requestId: this.requestId,
              requestDetail: this.requestDetail,
              processing: this.processing,
              isWeaponOrder: this.isWeaponOrder,
              isPickupDateAlreadySet: this.isPickupDateAlreadySet
            });

            // Load supply data if needed (for Order requests)
            if (this.requestDetail.requestType === 'Order') {
              this.loadSupplyData();
              // Load depot selection status for weapon orders (for depot validation on approve)
              if (this.isWeaponOrder) {
                this.loadDepotSelectionStatus();
              }
            }

            // Update return-specific state
            if (this.requestDetail.requestType === 'Return') {
              this.stateService.updateState({
                isReturnDepotSet: !!this.requestDetail.returnToDepotId,
                isReturnDeliveryDateSet: !!this.requestDetail.deliveryDate
              });
            }

            if (showLoading) {
              this.loading = false;
            }

            // Trigger change detection for OnPush strategy
            this.cdr.markForCheck();
          }).catch(() => {
            // Even on error, update with what we have
            this.requestDetail = mapToRequestDetail(baseRequest);
            // Update state service with request detail
            this.stateService.updateState({
              requestId: this.requestId,
              requestDetail: this.requestDetail,
              processing: this.processing,
              isWeaponOrder: this.isWeaponOrder,
              isPickupDateAlreadySet: this.isPickupDateAlreadySet
            });
            // Load supply data if needed
            if (this.requestDetail.requestType === 'Order') {
              this.loadSupplyData();
              if (this.isWeaponOrder) {
                this.loadDepotSelectionStatus();
              }
            }

            // Update return-specific state on error path as well
            if (this.requestDetail.requestType === 'Return') {
              this.stateService.updateState({
                isReturnDepotSet: !!this.requestDetail.returnToDepotId,
                isReturnDeliveryDateSet: !!this.requestDetail.deliveryDate
              });
            }

            if (showLoading) {
              this.loading = false;
            }

            // Trigger change detection for OnPush strategy
            this.cdr.markForCheck();
          });
        },
        error: (error) => {
          if (showLoading) {
            this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load request details');
            this.loading = false;
            this.cdr.markForCheck();
          } else {
            // Silently handle error for refresh - log for debugging but don't disrupt UX
            console.error('Failed to refresh request details:', error);
          }
        }
      });
  }



  goBack(): void {
    this.navigationService.goBack();
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


  /**
   * Handle pickup date set event from child component
   */
  onPickupDateSet(): void {
    // Mark that the date has been set
    this.isPickupDateAlreadySet = true;
    // Update state service
    this.stateService.updateState({
      isPickupDateAlreadySet: this.isPickupDateAlreadySet
    });
    this.bumpWorkflowSupplySummaryRefresh();
    // OnPush children (e.g. approval actions) read this from state; refresh immediately
    this.cdr.markForCheck();
  }

  /**
   * Handle pickup date confirmed event from child component
   */
  onPickupDateConfirmed(): void {
    // Confirm path does not emit pickupDateSet; still required for approve validation / UI
    this.isPickupDateAlreadySet = true;
    this.stateService.updateState({
      isPickupDateAlreadySet: true
    });
    this.bumpWorkflowSupplySummaryRefresh();
    this.cdr.markForCheck();
  }

  /**
   * Handle pickup date changed event from child component
   * Silent refresh to sync data without full-page loading (same as approve/supply)
   */
  onPickupDateChanged(): void {
    this.loadRequestDetailInternal(false);
  }

  /**
   * Handle return depot set event from child component
   */
  onReturnDepotSet(): void {
    this.stateService.updateState({ isReturnDepotSet: true });
    this.loadRequestDetailInternal(false);
  }

  /**
   * Handle return delivery date set event from child component
   */
  onReturnDeliveryDateSet(): void {
    this.stateService.updateState({ isReturnDeliveryDateSet: true });
    this.loadRequestDetailInternal(false);
  }

  /**
   * Handle supply submission event from child component
   */
  onSupplySubmitted(): void {
    this.loadRequestDetailInternal(false);
  }



  /**
   * Show confirmation dialog
   */
  showConfirmationDialog(
    title: string,
    message: string,
    type: ConfirmationType,
    confirmText: string,
    cancelText: string,
    onConfirm: (comment?: string) => void,
    requireComment: boolean = false,
    commentLabel: string = '',
    commentPlaceholder: string = ''
  ): void {
    this.confirmationService.showConfirmationDialog(
      title,
      message,
      type,
      confirmText,
      cancelText,
      onConfirm,
      requireComment,
      commentLabel,
      commentPlaceholder
    );
  }

  /**
   * Close confirmation dialog
   */
  closeConfirmationDialog(): void {
    this.confirmationService.closeConfirmationDialog();
  }

  /**
   * Handle confirmation dialog confirm action
   */
  onConfirmationConfirmed(comment?: string): void {
    this.confirmationService.onConfirmationConfirmed(comment);
  }

  /**
   * Handle confirmation dialog cancel action
   */
  onConfirmationCancelled(): void {
    this.confirmationService.onConfirmationCancelled();
  }

}

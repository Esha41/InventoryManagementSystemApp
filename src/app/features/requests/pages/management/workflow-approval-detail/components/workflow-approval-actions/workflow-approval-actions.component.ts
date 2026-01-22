import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, CheckCircle, XCircle, RotateCcw, ChevronDown } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { RequestDetail } from '@models/workflow-approval.model';
import { WorkflowApprovalActionsService } from '../../services/workflow-approval-actions.service';
import { WorkflowApprovalDataService } from '../../services/workflow-approval-data.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { validateFile, showFileValidationErrors, getFileSizeFromFile, MAX_FILE_SIZE_MB } from '@utils/file.utils';
import { ToastService } from '@services/toast.service';
import { takeUntil } from 'rxjs/operators';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getTransitionDisplayName, getWorkflowStepDisplayName } from '../../utils/workflow-approval-helpers';
import { ConfirmationDialogComponent, ConfirmationType } from '@shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-workflow-approval-actions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './workflow-approval-actions.component.html',
  styleUrls: ['./workflow-approval-actions.component.css']
})
export class WorkflowApprovalActionsComponent implements OnInit, OnDestroy {
  readonly CheckCircle = CheckCircle;
  readonly XCircle = XCircle;
  readonly RotateCcw = RotateCcw;
  readonly ChevronDown = ChevronDown;

  @Input() requestId!: number;
  @Input() requestDetail: RequestDetail | null = null;
  @Input() processing: boolean = false;
  @Input() previousWorkflowSteps: any[] = [];
  @Input() loadingPreviousSteps: boolean = false;
  @Input() destroy$!: Subject<void>;
  
  @Output() loadPreviousSteps = new EventEmitter<void>();

  @Output() approved = new EventEmitter<void>();
  @Output() rejected = new EventEmitter<void>();
  @Output() returnedForReview = new EventEmitter<void>();
  @Output() actionCompleted = new EventEmitter<void>();

  // Approval/Rejection form state
  comments: string = '';
  sendToHigherApproval: string = 'no';
  isProcessingAction: boolean = false; // Local processing state for this component's actions
  
  // File upload for approval/rejection
  approvalFiles: File[] = [];
  
  // Higher approval dropdown options
  higherApprovalOptions: { value: string; label: string }[] = [];
  
  // Return for review
  showReturnForReview: boolean = false;
  returnToStepId: number | null = null;
  
  // Transitions (skip-to steps) for current step
  selectedNextStepId: number | null = null;

  // Confirmation dialog state
  confirmationDialog = {
    isOpen: false,
    title: '',
    message: '',
    type: 'warning' as ConfirmationType,
    confirmText: '',
    cancelText: '',
    requireComment: false,
    commentLabel: '',
    commentPlaceholder: '',
    onConfirm: (comment?: string) => { }
  };

  // File size utility
  getFileSize = getFileSizeFromFile;
  MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;

  // State from service
  isPickupDateAlreadySet$ = this.stateService.isPickupDateAlreadySet$;
  isSuperAdmin$ = this.stateService.isSuperAdmin$;
  canRejectRequest$ = this.stateService.canRejectRequest$;
  canReturnForReview$ = this.stateService.canReturnForReview$;
  canSetSupplyPickupDate$ = this.stateService.canSetSupplyPickupDate$;
  canSubmitSupply$ = this.stateService.canSubmitSupply$;
  hasHigherApproval$ = this.stateService.hasHigherApproval$;
  hasTransitions$ = this.stateService.hasTransitions$;

  constructor(
    private actionsService: WorkflowApprovalActionsService,
    private dataService: WorkflowApprovalDataService,
    private stateService: WorkflowApprovalStateService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Initialize higher approval options with translations
    if (this.higherApprovalOptions.length === 0) {
      this.translateService.get(['common.yes', 'common.no']).subscribe(translations => {
        this.higherApprovalOptions = [
          { value: 'yes', label: translations['common.yes'] || 'Yes' },
          { value: 'no', label: translations['common.no'] || 'No' }
        ];
      });
    }

    // Subscribe to state changes
    this.stateService.isPickupDateAlreadySet$
      .pipe(takeUntil(this.destroy$))
      .subscribe();

    this.stateService.isSuperAdmin$
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    // Component cleanup if needed
  }

  /**
   * Check if dropdown should be shown (only if multiple transitions exist)
   */
  shouldShowTransitionsDropdown(): boolean {
    const transitions = this.stateService.getCurrentStepTransitions();
    return transitions.length > 1;
  }

  // Permission check methods using state service
  canRejectRequest(): boolean {
    return this.stateService.canRejectRequest();
  }

  canReturnForReview(): boolean {
    return this.stateService.canReturnForReview();
  }

  canSetSupplyPickupDate(): boolean {
    return this.stateService.canSetSupplyPickupDate();
  }

  canSubmitSupply(): boolean {
    return this.stateService.canSubmitSupply();
  }

  isSupplySubmitted(): boolean {
    return this.stateService.isSupplySubmitted();
  }

  hasHigherApproval(): boolean {
    return this.stateService.hasHigherApproval();
  }

  hasTransitions(): boolean {
    return this.stateService.hasTransitions();
  }

  getCurrentStepTransitions(): any[] {
    return this.stateService.getCurrentStepTransitions();
  }

  getWorkflowStepDisplayNameFn = (step: any): string => {
    return this.stateService.getWorkflowStepDisplayName(step);
  };

  get isPickupDateAlreadySet(): boolean {
    return this.stateService.getState().isPickupDateAlreadySet;
  }

  get isSuperAdmin(): boolean {
    return this.stateService.getState().isSuperAdmin;
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

  getTransitionDisplayNameFn = (option: any): string => {
    return getTransitionDisplayName(option, this.translateService);
  };

  /**
   * Load previous workflow steps that the request can be returned to
   */
  loadPreviousWorkflowSteps(): void {
    if (!this.requestId) return;
    this.loadPreviousSteps.emit();
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
   * Handle file selection for approval/rejection
   */
  onApprovalFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];

      // Validate file types and sizes
      newFiles.forEach(file => {
        const validation = validateFile(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        }
      });

      // Show error message if any files are invalid
      if (invalidFiles.length > 0) {
        showFileValidationErrors(this.translateService, this.toastService, invalidFiles, 'workflowApprovalDetail');
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
   * Approve request
   */
  approveRequest(): void {
    if (this.processing || this.isProcessingAction || !this.requestDetail) return;

    // Validate: Pickup date must be set if user has permission
    // EXCEPTION: Super Admin can bypass this requirement
    if (!this.isSuperAdmin && this.canSetSupplyPickupDate() && !this.isPickupDateAlreadySet) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.pickupDateRequired']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.pickupDateRequired'] || 'Please set the supply pickup date before approving.',
          translations['toast.error']
        );
      });
      return;
    }

    // Validate: Supply must be submitted if user has permission
    // EXCEPTION: Super Admin can bypass this requirement
    if (!this.isSuperAdmin && this.canSubmitSupply() && !this.isSupplySubmitted()) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.supplySubmissionRequired']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.supplySubmissionRequired'] || 'Please submit the supply information before approving.',
          translations['toast.error']
        );
      });
      return;
    }

    // Validate: If there are multiple skip-to step options, user must select one
    const transitions = this.getCurrentStepTransitions();
    if (transitions.length > 1 && !this.selectedNextStepId) {
      this.translateService.get([
        'toast.error',
        'workflowApprovalDetail.selectSkipToStepRequired',
        'workflowApprovalDetail.skipToStep'
      ]).subscribe(translations => {
        const skipToStepLabel = translations['workflowApprovalDetail.skipToStep'] || 'Go To Step';
        const errorMsg = translations['workflowApprovalDetail.selectSkipToStepRequired'] ||
          `Please select a step to go to from the "${skipToStepLabel}" dropdown before approving this request.`;
        const errorTitle = translations['toast.error'] || 'Action Required';
        this.toastService.error(errorMsg, errorTitle);
      });
      return;
    }

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
          this.isProcessingAction = true;

          this.actionsService.approveRequest({
            requestId: this.requestId,
            isApproved: true,
            comments: this.comments,
            sendToHigherApproval: this.sendToHigherApproval === 'yes',
            nextStepId: this.selectedNextStepId,
            files: this.approvalFiles
          }, this.destroy$)
            .subscribe({
              next: () => {
                this.resetForm();
                this.isProcessingAction = false;
                this.approved.emit();
                this.actionCompleted.emit();
              },
              error: () => {
                this.isProcessingAction = false;
                this.actionCompleted.emit();
              }
            });
        }
      );
    });
  }

  /**
   * Reject request
   */
  rejectRequest(): void {
    if (this.processing || this.isProcessingAction || !this.requestDetail) return;

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
          this.isProcessingAction = true;

          this.actionsService.rejectRequest({
            requestId: this.requestId,
            isApproved: false,
            comments: this.comments,
            sendToHigherApproval: this.sendToHigherApproval === 'yes',
            files: this.approvalFiles
          }, this.destroy$)
            .subscribe({
              next: () => {
                this.resetForm();
                this.isProcessingAction = false;
                this.rejected.emit();
                this.actionCompleted.emit();
              },
              error: () => {
                this.isProcessingAction = false;
                this.actionCompleted.emit();
              }
            });
        }
      );
    });
  }

  /**
   * Return request for review to a previous workflow step
   */
  returnForReview(): void {
    if (this.processing || this.isProcessingAction || !this.requestDetail || !this.returnToStepId) {
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

    // Show confirmation dialog with required comment
    this.translateService.get([
      'workflowApprovalDetail.confirmReturnForReview',
      'workflowApprovalDetail.confirmReturnForReviewMessage',
      'workflowApprovalDetail.returnComment',
      'workflowApprovalDetail.enterReturnComment',
      'common.yes',
      'common.cancel'
    ]).subscribe(translations => {
      this.showConfirmationDialog(
        translations['workflowApprovalDetail.confirmReturnForReview'] || 'Confirm Return for Review',
        translations['workflowApprovalDetail.confirmReturnForReviewMessage'] || 'Are you sure you want to return this request for review?',
        'warning',
        translations['common.yes'] || 'Yes',
        translations['common.cancel'] || 'Cancel',
        (returnComment?: string) => {
          if (!returnComment) {
            this.isProcessingAction = false;
            return;
          }

          this.isProcessingAction = true;

          this.actionsService.returnForReview({
            requestId: this.requestId,
            returnToStepId: this.returnToStepId!,
            comments: returnComment,
            files: this.approvalFiles
          }, this.destroy$)
            .subscribe({
              next: () => {
                this.resetForm();
                this.showReturnForReview = false;
                this.isProcessingAction = false;
                this.returnedForReview.emit();
                this.actionCompleted.emit();
              },
              error: () => {
                this.isProcessingAction = false;
                this.actionCompleted.emit();
              }
            });
        },
        true, // requireComment
        translations['workflowApprovalDetail.returnComment'] || 'Return Comment',
        translations['workflowApprovalDetail.enterReturnComment'] || 'Enter reason for returning...'
      );
    });
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
    this.confirmationDialog = {
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      requireComment,
      commentLabel,
      commentPlaceholder,
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
  onConfirmationConfirmed(comment?: string): void {
    this.confirmationDialog.onConfirm(comment);
    this.closeConfirmationDialog();
  }

  /**
   * Handle confirmation dialog cancel action
   */
  onConfirmationCancelled(): void {
    this.closeConfirmationDialog();
  }

  /**
   * Reset form after action
   */
  private resetForm(): void {
    this.comments = '';
    this.sendToHigherApproval = 'no';
    this.approvalFiles = [];
    this.selectedNextStepId = null;
    this.returnToStepId = null;
  }
}

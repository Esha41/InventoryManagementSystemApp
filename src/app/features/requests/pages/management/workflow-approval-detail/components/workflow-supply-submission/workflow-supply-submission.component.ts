import { Component, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, User, AlertTriangle } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { SupplyDto } from '@services/supply.service';
import { LookupItem } from '@services/lookup.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { getFileSizeFromFile, removeFile, MAX_FILE_SIZE_MB, validateFile, showFileValidationErrors } from '@utils/file.utils';
import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';
import { WorkflowApprovalDataService } from '../../services/workflow-approval-data.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { WorkflowApprovalNavigationService } from '../../services/workflow-approval-navigation.service';
import { ToastService } from '@services/toast.service';
import { getRankDisplayName as getRankDisplayNameHelper } from '../../utils/workflow-approval-helpers';

@Component({
  selector: 'app-workflow-supply-submission',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent
  ],
  templateUrl: './workflow-supply-submission.component.html',
  styleUrls: ['./workflow-supply-submission.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowSupplySubmissionComponent implements OnDestroy, OnChanges {
  @Input() supplyId: number | null = null;
  @Input() supplyData: SupplyDto | null = null;
  @Input() ranks: LookupItem[] = [];
  @Input() isLoadingRanks: boolean = false;
  @Input() destroy$!: Subject<void>;

  @Output() supplySubmitted = new EventEmitter<void>();
  @Output() supplyDataChanged = new EventEmitter<void>();

  readonly User = User;
  readonly AlertTriangle = AlertTriangle;

  // State from service
  get isLastApprovalCompleted(): boolean {
    return this.stateService.isLastApprovalCompleted();
  }

  get canUpdateRequestAndSupply(): boolean {
    return this.stateService.canUpdateRequestAndSupply();
  }

  navigateToSupplyOrder(): void {
    const state = this.stateService.getState();
    if (state.requestId) {
      this.navigationService.navigateToSupplyOrder(state.requestId);
    }
  }

  // Receiver information for supply submission
  receiverInfo: {
    recieverName: string;
    receiverRankId: number | null;
    recieverMilitaryId: string;
    notes: string;
  } = {
    recieverName: "",
    receiverRankId: null,
    recieverMilitaryId: "",
    notes: ""
  };

  isSubmittingSupply: boolean = false;

  // File upload for supply submission
  selectedFiles: File[] = [];
  fileInputElement: HTMLInputElement | null = null;
  existingFiles: Array<{ id: number; fileName: string; originalName: string }> = [];

  // Additional file upload after submission
  additionalFiles: File[] = [];
  additionalFileInputElement: HTMLInputElement | null = null;
  isUploadingAdditionalFiles: boolean = false;

  // Helper properties
  getFileSize = getFileSizeFromFile;
  MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;

  constructor(
    private translateService: TranslateService,
    private toastService: ToastService,
    private supplyServiceHelper: WorkflowApprovalSupplyService,
    private dataService: WorkflowApprovalDataService,
    private stateService: WorkflowApprovalStateService,
    private navigationService: WorkflowApprovalNavigationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Update receiver info when supplyData changes
    if (changes['supplyData'] && this.supplyData) {
      this.initializeReceiverInfo();
      this.loadExistingFiles();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeReceiverInfo(): void {
    if (this.supplyData) {
      this.receiverInfo.recieverName = this.supplyData.recieverName || "";
      this.receiverInfo.receiverRankId = this.supplyData.receiverRankId || null;
      this.receiverInfo.recieverMilitaryId = this.supplyData.recieverMilitaryId || "";
      this.receiverInfo.notes = this.supplyData.notes || "";
    }
  }

  private loadExistingFiles(): void {
    if (this.supplyData?.files && this.supplyData.files.length > 0) {
      this.existingFiles = this.supplyData.files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        originalName: f.originalName
      }));
    } else {
      this.existingFiles = [];
    }
  }

  isSupplySubmitted(): boolean {
    if (!this.supplyData) {
      return false;
    }

    // Check for submitted (2) or completed/approved (3+) status
    const status = this.supplyData.submissionStatus;
    if (status != null && status >= 2) {
      return true;
    }

    // Backward compatibility: For old orders that may have receiver info filled
    // but submissionStatus is still 1 (Draft), check if essential receiver fields are present
    const hasReceiverInfo = !!(
      this.supplyData.recieverName &&
      this.supplyData.recieverName.trim() !== '' &&
      this.supplyData.receiverRankId &&
      this.supplyData.recieverMilitaryId &&
      this.supplyData.recieverMilitaryId.trim() !== ''
    );

    return hasReceiverInfo;
  }

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

    this.supplyServiceHelper.submitSupply(this.supplyId, this.receiverInfo, this.selectedFiles, this.destroy$)
      .subscribe({
        next: () => {
          this.isSubmittingSupply = false;
          // Clear selected files after successful submission
          this.selectedFiles = [];
          if (this.fileInputElement) {
            this.fileInputElement.value = '';
          }
          if (this.supplyData) {
            this.supplyData.submissionStatus = 2; // Submitted
          }
          // Emit event to parent
          this.supplySubmitted.emit();
        },
        error: (error: any) => {
          this.isSubmittingSupply = false;
        }
      });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      // Validate file types and sizes, separate valid/invalid files
      newFiles.forEach(file => {
        const validation = validateFile(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        } else {
          validFiles.push(file);
        }
      });

      // Show error message if any files are invalid
      if (invalidFiles.length > 0) {
        showFileValidationErrors(this.translateService, this.toastService, invalidFiles, 'workflowApprovalDetail');
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

  removeFile(index: number): void {
    removeFile(this.selectedFiles, index, this.fileInputElement);
  }

  onAdditionalFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      // Validate file types and sizes, separate valid/invalid files
      newFiles.forEach(file => {
        const validation = validateFile(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        } else {
          validFiles.push(file);
        }
      });

      // Show error message if any files are invalid
      if (invalidFiles.length > 0) {
        showFileValidationErrors(this.translateService, this.toastService, invalidFiles, 'workflowApprovalDetail');
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

  removeAdditionalFile(index: number): void {
    this.additionalFiles.splice(index, 1);
    // Update the file input if needed
    if (this.additionalFileInputElement && this.additionalFiles.length === 0) {
      this.additionalFileInputElement.value = '';
    }
  }

  uploadAdditionalFiles(): void {
    if (this.isUploadingAdditionalFiles || !this.supplyId || this.additionalFiles.length === 0) {
      return;
    }

    this.isUploadingAdditionalFiles = true;

    this.supplyServiceHelper.uploadAdditionalFiles(this.supplyId, this.additionalFiles, this.destroy$)
      .subscribe({
        next: () => {
          // Clear selected files
          this.additionalFiles = [];
          if (this.additionalFileInputElement) {
            this.additionalFileInputElement.value = '';
          }
          // Emit event to reload supply data
          this.supplyDataChanged.emit();
          this.isUploadingAdditionalFiles = false;
        },
        error: (error: any) => {
          this.isUploadingAdditionalFiles = false;
        }
      });
  }

  downloadFile(fileId: number, fileName: string): void {
    this.supplyServiceHelper.downloadFile(fileId, fileName, this.destroy$)
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          // Error already handled in service
        }
      });
  }

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

      this.supplyServiceHelper.deleteFile(fileId, fileName, this.destroy$)
        .subscribe({
          next: () => {
            // Remove file from the list
            this.existingFiles.splice(index, 1);
            // Emit event to reload supply data
            this.supplyDataChanged.emit();
          },
          error: () => {
            // Error already handled in service
          }
        });
    });
  }

  getRankDisplayNameFn = (rank: any) => getRankDisplayNameHelper(rank, this.translateService);
}

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { Cartridge } from '@models/cartridge.model';
import { ToastService } from '@services/toast.service';
import { validateFile, showFileValidationErrors } from '@utils/file.utils';
import {
  AttachmentRequirementDto,
  AttachmentUploadsState,
  createInitialAttachmentUploadsState,
  RequestPurpose
} from '../../return-request.state';

@Component({
  selector: 'app-return-details-step',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, DropdownComponent],
  templateUrl: './return-details-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnDetailsStepComponent {
  constructor(
    private readonly translate: TranslateService,
    private readonly toastService: ToastService
  ) {}

  get isArabic(): boolean {
    return (this.translate.currentLang || 'en') === 'ar';
  }

  @Input() requestPurposeId: number | null = null;
  @Input() requestPurposeNotes = '';
  @Input() notes = '';
  @Input() reason = '';
  @Input() priority = 1;
  @Input() selectedFiles: File[] = [];
  @Input() attachmentRequirements: AttachmentRequirementDto[] = [];
  @Input() attachmentUploads: AttachmentUploadsState = createInitialAttachmentUploadsState();
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() requestPurposes: RequestPurpose[] = [];
  @Input() priorityOptions: { value: number; labelKey: string }[] = [];
  @Input() isLoadingRequestPurposes = false;
  @Input() isLoading = false;
  @Input() hasAttemptedSubmit = false;
  @Input() hasError!: (field: string) => boolean;
  @Input() getError!: (field: string) => string;
  @Input() requestPurposeOptionLabel!: (option: DropdownOption<RequestPurpose> | RequestPurpose | null) => string;
  @Input() getFileSize!: (file: File) => string;

  @Output() requestPurposeIdChange = new EventEmitter<number | null>();
  @Output() requestPurposeNotesChange = new EventEmitter<string>();
  @Output() notesChange = new EventEmitter<string>();
  @Output() reasonChange = new EventEmitter<string>();
  @Output() priorityChange = new EventEmitter<number>();
  @Output() filesSelected = new EventEmitter<Event>();
  @Output() fileRemoved = new EventEmitter<{ index: number; fileInput: HTMLInputElement | null }>();
  @Output() attachmentUploadsChange = new EventEmitter<AttachmentUploadsState>();
  @Output() removeItem = new EventEmitter<number>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  fileInputElement: HTMLInputElement | null = null;

  trackRequirementById = (_: number, req: AttachmentRequirementDto): number => req.id;

  get hasAttachmentRequirementSlots(): boolean {
    return (this.attachmentRequirements?.length ?? 0) > 0;
  }

  getRequirementLabel(req: AttachmentRequirementDto): string {
    if (this.isArabic) {
      return req.nameAr || req.nameEn || '';
    }
    return req.nameEn || req.nameAr || '';
  }

  getFilesForRequirement(requirementId: number): File[] {
    return this.attachmentUploads?.filesByRequirementId?.get(requirementId) ?? [];
  }

  onRemoveCartridge(id: number): void {
    this.removeItem.emit(id);
  }

  onFilesSelected(event: Event): void {
    this.fileInputElement = event.target as HTMLInputElement;
    this.filesSelected.emit(event);
  }

  onRemoveFile(index: number): void {
    this.fileRemoved.emit({ index, fileInput: this.fileInputElement });
  }

  onRequirementFileSelected(event: Event, requirement: AttachmentRequirementDto): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const incoming = Array.from(input.files);
    const invalid: string[] = [];
    const valid: File[] = [];

    incoming.forEach(file => {
      const v = validateFile(file);
      if (!v.isValid) {
        invalid.push(v.errorMessage);
      } else {
        valid.push(file);
      }
    });

    if (invalid.length > 0) {
      showFileValidationErrors(this.translate, this.toastService, invalid, 'newIssueRequest');
    }

    if (valid.length > 0) {
      const max = requirement.maxCount;
      let capped: File[];
      if (max === 1) {
        capped = [valid[0]];
      } else {
        const current = this.getFilesForRequirement(requirement.id);
        const merged = [...current, ...valid];
        capped = max > 0 ? merged.slice(0, max) : merged;
      }
      this.commitRequirementFiles(requirement.id, capped);
    }

    input.value = '';
  }

  removeRequirementFile(requirementId: number, index: number): void {
    const current = this.getFilesForRequirement(requirementId);
    if (index < 0 || index >= current.length) return;
    const next = [...current.slice(0, index), ...current.slice(index + 1)];
    this.commitRequirementFiles(requirementId, next);
  }

  private commitRequirementFiles(requirementId: number, files: File[]): void {
    const nextMap = new Map(this.attachmentUploads?.filesByRequirementId ?? new Map<number, File[]>());
    if (files.length === 0) {
      nextMap.delete(requirementId);
    } else {
      nextMap.set(requirementId, files);
    }
    const next: AttachmentUploadsState = {
      filesByRequirementId: nextMap,
      otherFiles: this.attachmentUploads?.otherFiles ?? []
    };
    this.attachmentUploads = next;
    this.attachmentUploadsChange.emit(next);
  }
}

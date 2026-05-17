import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '@models/cartridge.model';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getFileSizeFromFile, removeFile, validateFile, showFileValidationErrors } from '@utils/file.utils';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { formatDateForInput, formatDateShort } from '@core/utils/format.utils';
import {
  AttachmentRequirementDto,
  AttachmentUploadsState,
  createInitialAttachmentUploadsState
} from '../../new-issue-request.state';
@Component({
  selector: 'app-usage-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, DropdownComponent],
  templateUrl: './usage-form.component.html',
  styleUrls: ['./usage-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsageFormComponent {
  constructor(
    public translateService: TranslateService,
    private toastService: ToastService,
    private translationService: TranslationService
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get currentLang(): string {
    return this.translateService.currentLang || 'en';
  }

  /** Format date for input type="date" (YYYY-MM-DD) - for native picker */
  get usageDateFromForInput(): string {
    return formatDateForInput(this.usageDateFrom) || this.usageDateFrom || '';
  }

  /** Format date for input type="date" (YYYY-MM-DD) - for native picker */
  get usageDateToForInput(): string {
    return formatDateForInput(this.usageDateTo) || this.usageDateTo || '';
  }

  /** Minimum date for pickers - today in YYYY-MM-DD (prevents selecting past dates) */
  get minDateForPicker(): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Display date in DD/MM/YYYY format (app standard) */
  get usageDateFromDisplay(): string {
    const val = formatDateForInput(this.usageDateFrom) || this.usageDateFrom;
    if (!val || !val.trim()) return '';
    const formatted = formatDateShort(val);
    return formatted === 'N/A' ? '' : formatted;
  }

  /** Display date in DD/MM/YYYY format (app standard) */
  get usageDateToDisplay(): string {
    const val = formatDateForInput(this.usageDateTo) || this.usageDateTo;
    if (!val || !val.trim()) return '';
    const formatted = formatDateShort(val);
    return formatted === 'N/A' ? '' : formatted;
  }

  @ViewChild('dateFromPicker') dateFromPickerRef?: ElementRef<HTMLInputElement>;
  @ViewChild('dateToPicker') dateToPickerRef?: ElementRef<HTMLInputElement>;

  openDateFromPicker(): void {
    const el = this.dateFromPickerRef?.nativeElement;
    if (el?.showPicker) {
      el.showPicker();
    } else {
      el?.focus();
    }
  }

  openDateToPicker(): void {
    const el = this.dateToPickerRef?.nativeElement;
    if (el?.showPicker) {
      el.showPicker();
    } else {
      el?.focus();
    }
  }

  get isArabic(): boolean {
    return this.currentLang === 'ar';
  }
  @Input() usePurpose: string = '';
  @Input() selectedUsePurposeId: number | null = null;
  @Input() requestPurposeNotes: string = '';
  @Input() usePurposeOptions: DropdownOption<number>[] = [];
  @Input() usageLocation: string = '';
  @Input() numberOfOfficers: number | null = null;
  @Input() numberOfOtherRanks: number | null = null;
  @Input() usageDateFrom: string = '';
  @Input() usageTimeFrom: string = '';
  @Input() usageDateTo: string = '';
  @Input() usageTimeTo: string = '';
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() requesterComments: string = '';
  /**
   * Legacy flat file list still used as the "Other files" picker on screen.
   * The component routes this into the new `otherFiles` bucket on the
   * facade via `filesChange`. New per-requirement slot uploads live on
   * `attachmentUploads`.
   */
  @Input() selectedFiles: File[] = [];
  @Input() attachmentRequirements: AttachmentRequirementDto[] = [];
  @Input() attachmentUploads: AttachmentUploadsState = createInitialAttachmentUploadsState();
  @Output() removeCartridge = new EventEmitter<number>();
  onRemoveCartridge(id: number): void {
    this.removeCartridge.emit(id);
  }

  @Output() filesChange = new EventEmitter<File[]>();
  @Output() attachmentUploadsChange = new EventEmitter<AttachmentUploadsState>();
  @Output() usePurposeChange = new EventEmitter<string>();
  @Output() selectedUsePurposeIdChange = new EventEmitter<number | null>();
  @Output() usageLocationChange = new EventEmitter<string>();
  @Output() numberOfOfficersChange = new EventEmitter<number | null>();
  @Output() numberOfOtherRanksChange = new EventEmitter<number | null>();
  @Output() usageDateFromChange = new EventEmitter<string>();
  @Output() usageTimeFromChange = new EventEmitter<string>();
  @Output() usageDateToChange = new EventEmitter<string>();
  @Output() usageTimeToChange = new EventEmitter<string>();
  @Output() requestPurposeNotesChange = new EventEmitter<string>();
  @Output() requesterCommentsChange = new EventEmitter<string>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  private readonly defaultErrors: UsageFormErrors = {
    usePurpose: null,
    usageLocation: null,
    usageDateFrom: null,
    usageTimeFrom: null,
    usageDateTo: null,
    usageTimeTo: null,
    requestPurposeNotes: null,
    requesterComments: null,
    selectedFiles: null,
    attachmentRequirements: null
  };

  formErrors: UsageFormErrors = { ...this.defaultErrors };

  /** Files chosen per AttachmentRequirementId, mirrored from `attachmentUploads`. */
  getFilesForRequirement(requirementId: number): File[] {
    return this.attachmentUploads?.filesByRequirementId?.get(requirementId) ?? [];
  }

  /** True when the chosen purpose declares at least one attachment-requirement slot. */
  get hasAttachmentRequirementSlots(): boolean {
    return (this.attachmentRequirements?.length ?? 0) > 0;
  }

  /** Localized label resolution for a requirement (Ar/En fallback). */
  getRequirementLabel(req: AttachmentRequirementDto): string {
    if (this.isArabic) {
      return req.nameAr || req.nameEn || '';
    }
    return req.nameEn || req.nameAr || '';
  }

  trackRequirementById = (_: number, req: AttachmentRequirementDto): number => req.id;
  hasAttemptedSubmit = false;

  // Generate military time options (every 15 minutes: 0000, 0015, 0030, ... 2345)
  readonly timeOptions: string[] = (() => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        options.push(hourStr + minuteStr);
      }
    }
    return options;
  })();

  clearError(field: keyof UsageFormErrors): void {
    if (this.formErrors[field]) {
      this.formErrors[field] = null;
    }
  }

  onUsePurposeChange(value: number | null): void {
    this.selectedUsePurposeId = value;
    this.selectedUsePurposeIdChange.emit(value);
    const label = this.resolveUsePurposeLabel(value);
    this.usePurposeChange.emit(label);

    this.clearError('usePurpose');

    if (this.hasAttemptedSubmit) {
      if (value === null || value === undefined) {
        this.formErrors.usePurpose = 'newIssueRequest.validation.usePurposeRequired';
        this.formErrors.requestPurposeNotes = null;
      } else {
        this.clearError('usePurpose');
        if (!this.requestPurposeNotes || this.requestPurposeNotes.trim().length === 0) {
          this.formErrors.requestPurposeNotes = 'newIssueRequest.validation.requestPurposeNotesRequired';
        }
      }
    }
  }

  onRequestPurposeNotesChange(value: string): void {
    this.requestPurposeNotesChange.emit(value);
    this.clearError('requestPurposeNotes');
    if (this.hasAttemptedSubmit && this.selectedUsePurposeId !== null) {
      if (!value || value.trim().length === 0) {
        this.formErrors.requestPurposeNotes = 'newIssueRequest.validation.requestPurposeNotesRequired';
      }
    }
  }

  onUsageLocationChange(value: string): void {
    this.usageLocationChange.emit(value);

    this.clearError('usageLocation');

    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageLocation = 'newIssueRequest.validation.usageLocationRequired';
      } else {
        this.clearError('usageLocation');
      }
    }
  }

  onNumberOfOfficersChange(value: number | null): void {
    this.numberOfOfficersChange.emit(value);
  }

  onNumberOfOtherRanksChange(value: number | null): void {
    this.numberOfOtherRanksChange.emit(value);
  }

  onUsageDateFromChange(value: string): void {
    this.usageDateFromChange.emit(value);

    this.clearError('usageDateFrom');

    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateRequired';
      } else if (!this.isDateOnOrAfterToday(value)) {
        this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateFromMustBeTodayOrFuture';
      } else {
        this.clearError('usageDateFrom');
      }
    }
  }

  onUsageTimeFromChange(value: string): void {
    // Dropdown will only return valid military time format (HHMM)
    this.usageTimeFromChange.emit(value || '');
    this.clearError('usageTimeFrom');

    if (this.hasAttemptedSubmit) {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
        this.formErrors.usageTimeFrom = 'newIssueRequest.validation.usageTimeRequired';
      } else {
        this.clearError('usageTimeFrom');
      }
    }
  }

  onUsageDateToChange(value: string): void {
    this.usageDateToChange.emit(value);

    this.clearError('usageDateTo');

    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageDateTo = 'newIssueRequest.validation.usageDateRequired';
      } else if (!this.isDateOnOrAfterToday(value)) {
        this.formErrors.usageDateTo = 'newIssueRequest.validation.usageDateToMustBeTodayOrFuture';
      } else {
        this.clearError('usageDateTo');
      }
    }
  }

  onUsageTimeToChange(value: string): void {
    // Dropdown will only return valid military time format (HHMM)
    this.usageTimeToChange.emit(value || '');
    this.clearError('usageTimeTo');

    if (this.hasAttemptedSubmit) {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
        this.formErrors.usageTimeTo = 'newIssueRequest.validation.usageTimeRequired';
      } else {
        this.clearError('usageTimeTo');
      }
    }
  }

  onRequesterCommentsChange(value: string): void {
    this.requesterCommentsChange.emit(value);

    this.clearError('requesterComments');
  }

  onFileSelected(event: Event): void {
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
        showFileValidationErrors(this.translateService, this.toastService, invalidFiles, 'newIssueRequest');
      }

      // Add only valid files to the selection
      if (validFiles.length > 0) {
        this.selectedFiles = [...this.selectedFiles, ...validFiles];
        this.filesChange.emit(this.selectedFiles);
        this.clearError('selectedFiles');
      }

      // Reset input to allow selecting the same files again if needed
      input.value = '';
    }
  }

  removeFile(index: number): void {
    removeFile(this.selectedFiles, index);
    this.filesChange.emit(this.selectedFiles);
    if (this.selectedFiles.length > 0) {
      this.clearError('selectedFiles');
    }
  }

  /** File picker handler bound to a specific AttachmentRequirement slot. */
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
      showFileValidationErrors(this.translateService, this.toastService, invalid, 'newIssueRequest');
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
      this.clearError('attachmentRequirements');
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

  getFileSize = getFileSizeFromFile;

  onPrevious(): void {
    this.previous.emit();
  }

  onNext(): void {
    this.hasAttemptedSubmit = true;
    if (this.validateForm()) {
      this.next.emit();
    }
  }

  hasError(field: keyof UsageFormErrors): boolean {
    return this.hasAttemptedSubmit && !!this.formErrors[field];
  }

  hasAnyError(): boolean {
    return Object.values(this.formErrors).some(error => !!error);
  }

  private validateForm(): boolean {
    this.formErrors = { ...this.defaultErrors };
    let isValid = true;

    if (this.selectedUsePurposeId === null || this.selectedUsePurposeId === undefined) {
      this.formErrors.usePurpose = 'newIssueRequest.validation.usePurposeRequired';
      isValid = false;
    }
    if (this.selectedUsePurposeId !== null && this.selectedUsePurposeId !== undefined
      && (!this.requestPurposeNotes || this.requestPurposeNotes.trim().length === 0)) {
      this.formErrors.requestPurposeNotes = 'newIssueRequest.validation.requestPurposeNotesRequired';
      isValid = false;
    }

    if (!this.usageLocation || this.usageLocation.trim().length === 0) {
      this.formErrors.usageLocation = 'newIssueRequest.validation.usageLocationRequired';
      isValid = false;
    }

    if (!this.usageDateFrom || this.usageDateFrom.trim().length === 0) {
      this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateRequired';
      isValid = false;
    } else if (!this.isDateOnOrAfterToday(this.usageDateFrom)) {
      this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateFromMustBeTodayOrFuture';
      isValid = false;
    }

    // Validate usageTimeFrom - explicitly check for null/undefined/empty string (not falsy values)
    // "0000" is a valid military time and should pass validation
    if (this.usageTimeFrom === null || this.usageTimeFrom === undefined ||
      (typeof this.usageTimeFrom === 'string' && this.usageTimeFrom.trim().length === 0)) {
      this.formErrors.usageTimeFrom = 'newIssueRequest.validation.usageTimeRequired';
      isValid = false;
    }

    if (!this.usageDateTo || this.usageDateTo.trim().length === 0) {
      this.formErrors.usageDateTo = 'newIssueRequest.validation.usageDateRequired';
      isValid = false;
    } else if (!this.isDateOnOrAfterToday(this.usageDateTo)) {
      this.formErrors.usageDateTo = 'newIssueRequest.validation.usageDateToMustBeTodayOrFuture';
      isValid = false;
    }

    // Validate usageTimeTo - explicitly check for null/undefined/empty string (not falsy values)
    // "0000" is a valid military time and should pass validation
    if (this.usageTimeTo === null || this.usageTimeTo === undefined ||
      (typeof this.usageTimeTo === 'string' && this.usageTimeTo.trim().length === 0)) {
      this.formErrors.usageTimeTo = 'newIssueRequest.validation.usageTimeRequired';
      isValid = false;
    }

    if (this.hasAttachmentRequirementSlots) {
      // When the purpose declares slots, the legacy flat picker becomes the
      // optional "Other files" bucket; per-slot validation drives the gate.
      const slotErrors: string[] = [];
      for (const req of this.attachmentRequirements) {
        const files = this.getFilesForRequirement(req.id).filter(f => f instanceof File && f.size > 0);
        if (req.isRequired && files.length < req.minCount) {
          slotErrors.push(this.getRequirementLabel(req));
        } else if (files.length > req.maxCount) {
          slotErrors.push(this.getRequirementLabel(req));
        }
      }
      if (slotErrors.length > 0) {
        this.formErrors.attachmentRequirements = 'newIssueRequest.validation.attachmentRequirementsInvalid';
        isValid = false;
      }
    } else if (!this.selectedFiles || this.selectedFiles.length === 0) {
      this.formErrors.selectedFiles = 'newIssueRequest.validation.attachmentsRequired';
      isValid = false;
    }

    return isValid;
  }

  /**
   * Checks if a date string is today or in the future (date part only, local timezone).
   * Uses YYYY-MM-DD directly when present to avoid timezone shift from new Date() parsing.
   */
  private isDateOnOrAfterToday(dateStr: string): boolean {
    if (!dateStr?.trim()) return false;
    // Date input returns YYYY-MM-DD - use directly to avoid timezone shift (new Date("YYYY-MM-DD") = UTC midnight)
    const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const normalized = ymdMatch ? ymdMatch[0] : (formatDateForInput(dateStr) || dateStr.trim());
    if (!normalized) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return normalized >= todayStr;
  }

  private resolveUsePurposeLabel(value: number | null): string {
    if (value === null || value === undefined) {
      return '';
    }
    const match = this.usePurposeOptions.find(option => option.value === value);
    return match?.label ?? '';
  }
}

type UsageFormErrors = {
  usePurpose: string | null;
  requestPurposeNotes: string | null;
  usageLocation: string | null;
  usageDateFrom: string | null;
  usageTimeFrom: string | null;
  usageDateTo: string | null;
  usageTimeTo: string | null;
  requesterComments: string | null;
  selectedFiles: string | null;
  attachmentRequirements: string | null;
};

import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '../cartridge-list/cartridge-list.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getFileSizeFromFile, removeFile, validateFile, MAX_FILE_SIZE_MB, showFileValidationErrors } from '@utils/file.utils';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { formatDateForInput, formatDateShort } from '@core/utils/format.utils';

// Export MAX_FILE_SIZE_MB for template use
export const MAX_FILE_SIZE_MB_EXPORT = MAX_FILE_SIZE_MB;

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
  @Input() fromReserve: string = 'Yes';
  @Input() usePurpose: string = '';
  @Input() selectedUsePurposeId: number | null = null;
  @Input() usePurposeOptions: DropdownOption<number>[] = [];
  @Input() usageLocation: string = '';
  @Input() numberOfOfficers: number | null = null;
  @Input() numberOfOtherRanks: number | null = null;
  @Input() usageDateFrom: string = '';
  @Input() usageTimeFrom: string = '';
  @Input() usageDateTo: string = '';
  @Input() usageTimeTo: string = '';
  @Input() totalReserve: number = 0;
  @Input() availableReserve: number = 0;
  @Input() orderedQuantity: number = 0;
  @Input() usedQuantity: number = 0;
  @Input() reserveDetailsByItem: any[] = [];
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() orderPriority: string = '';
  @Input() orderPriorities: any[] = ['newIssueRequest.normalPriority', 'newIssueRequest.urgentPriority', 'newIssueRequest.veryUrgentPriority'];
  @Input() requesterComments: string = '';
  @Input() selectedFiles: File[] = [];
  @Output() removeCartridge = new EventEmitter<number>();
  onRemoveCartridge(id: number): void {
    this.removeCartridge.emit(id);
  }

  @Output() filesChange = new EventEmitter<File[]>();
  @Output() usePurposeChange = new EventEmitter<string>();
  @Output() selectedUsePurposeIdChange = new EventEmitter<number | null>();
  @Output() usageLocationChange = new EventEmitter<string>();
  @Output() numberOfOfficersChange = new EventEmitter<number | null>();
  @Output() numberOfOtherRanksChange = new EventEmitter<number | null>();
  @Output() usageDateFromChange = new EventEmitter<string>();
  @Output() usageTimeFromChange = new EventEmitter<string>();
  @Output() usageDateToChange = new EventEmitter<string>();
  @Output() usageTimeToChange = new EventEmitter<string>();
  @Output() orderPriorityChange = new EventEmitter<string>();
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
    orderPriority: null,
    requesterComments: null
  };

  formErrors: UsageFormErrors = { ...this.defaultErrors };
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
      } else {
        this.clearError('usePurpose');
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

  onOrderPriorityChange(value: string): void {
    this.orderPriorityChange.emit(value);

    this.clearError('orderPriority');

    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.orderPriority = 'newIssueRequest.validation.orderPriorityRequired';
      } else {
        this.clearError('orderPriority');
      }
    }
  }

  onRequesterCommentsChange(value: string): void {
    this.requesterCommentsChange.emit(value);

    this.clearError('requesterComments');

    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.requesterComments = 'newIssueRequest.validation.commentsRequired';
      } else {
        this.clearError('requesterComments');
      }
    }
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
      }

      // Reset input to allow selecting the same files again if needed
      input.value = '';
    }
  }

  removeFile(index: number): void {
    removeFile(this.selectedFiles, index);
    this.filesChange.emit(this.selectedFiles);
  }

  getFileSize = getFileSizeFromFile;
  MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB_EXPORT;

  onPrevious(): void {
    this.previous.emit();
  }

  onNext(): void {
    this.hasAttemptedSubmit = true;
    if (this.validateForm()) {
      this.next.emit();
    }
  }

  isItemSelected(itemId: number): boolean {
    return this.selectedCartridges.some(cartridge => cartridge.id === itemId);
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

    if (!this.usageLocation || this.usageLocation.trim().length === 0) {
      this.formErrors.usageLocation = 'newIssueRequest.validation.usageLocationRequired';
      isValid = false;
    }

    if (!this.usageDateFrom || this.usageDateFrom.trim().length === 0) {
      this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateRequired';
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
    }

    // Validate usageTimeTo - explicitly check for null/undefined/empty string (not falsy values)
    // "0000" is a valid military time and should pass validation
    if (this.usageTimeTo === null || this.usageTimeTo === undefined ||
      (typeof this.usageTimeTo === 'string' && this.usageTimeTo.trim().length === 0)) {
      this.formErrors.usageTimeTo = 'newIssueRequest.validation.usageTimeRequired';
      isValid = false;
    }

    if (!this.orderPriority || this.orderPriority.trim().length === 0) {
      this.formErrors.orderPriority = 'newIssueRequest.validation.orderPriorityRequired';
      isValid = false;
    }

    if (!this.requesterComments || this.requesterComments.trim().length === 0) {
      this.formErrors.requesterComments = 'newIssueRequest.validation.commentsRequired';
      isValid = false;
    }

    return isValid;
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
  usageLocation: string | null;
  usageDateFrom: string | null;
  usageTimeFrom: string | null;
  usageDateTo: string | null;
  usageTimeTo: string | null;
  orderPriority: string | null;
  requesterComments: string | null;
};

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectionStrategy, ViewChild, ElementRef, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LucideAngularModule, Clock, CheckCircle } from 'lucide-angular';
import { RequestDetail } from '@models/workflow-approval.model';
import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { ToastService } from '@services/toast.service';
import { formatDateForInput, formatDateShort } from '@core/utils/format.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-workflow-pickup-date',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './workflow-pickup-date.component.html',
  styleUrls: ['./workflow-pickup-date.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowPickupDateComponent implements OnChanges {
  readonly Clock = Clock;
  readonly CheckCircle = CheckCircle;

  @Input() requestId!: number;
  @Input() requestDetail: RequestDetail | null = null;
  @Input() pickupDate: string = '';
  @Input() destroy$!: Subject<void>;

  @Output() pickupDateChange = new EventEmitter<string>();
  @Output() pickupDateSet = new EventEmitter<void>();
  @Output() pickupDateConfirmed = new EventEmitter<void>();
  @Output() pickupDateChanged = new EventEmitter<void>(); // Emit when data needs to be reloaded

  // Local state
  localPickupDate: string = '';
  pickupDateProcessing: boolean = false;
  confirmPickupDateProcessing: boolean = false;

  @ViewChild('pickupDatePicker') pickupDatePickerRef?: ElementRef<HTMLInputElement>;
  @ViewChild('confirmPickupDatePicker') confirmPickupDatePickerRef?: ElementRef<HTMLInputElement>;

  // State from service
  get isPickupDateAlreadySet(): boolean {
    return this.stateService.getState().isPickupDateAlreadySet;
  }

  get isWeaponOrder(): boolean {
    return this.stateService.getState().isWeaponOrder;
  }

  /**
   * Format pickup date for the native datetime-local input (YYYY-MM-DDTHH:mm).
   * Falls back to the raw value if already in a compatible format.
   */
  get pickupDateForInput(): string {
    if (!this.localPickupDate) return '';
    // If it's already datetime-local compatible, return as-is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(this.localPickupDate)) {
      return this.localPickupDate;
    }
    // Try to normalize date part
    const datePart = formatDateForInput(this.localPickupDate) || this.localPickupDate;
    if (!datePart) return '';
    return `${datePart}T00:00`;
  }

  /**
   * Display pickup date in DD/MM/YYYY HH:mm (app standard for date, native for time).
   */
  get pickupDateDisplay(): string {
    if (!this.localPickupDate?.trim()) return '';

    const dateMatch = this.localPickupDate.match(/^(\d{4}-\d{2}-\d{2})/);
    const datePart = dateMatch ? dateMatch[1] : (formatDateForInput(this.localPickupDate) || this.localPickupDate);
    if (!datePart) return '';

    const formattedDate = formatDateShort(datePart);
    if (formattedDate === 'N/A') return '';

    // Extract time (HH:mm) from datetime-local or other ISO-like strings
    let timePart = '';
    const timeMatch = this.localPickupDate.match(/T(\d{2}:\d{2})/);
    if (timeMatch) {
      timePart = timeMatch[1];
    }

    return timePart ? `${formattedDate} ${timePart}` : formattedDate;
  }

  /**
   * Minimum allowed pickup date-time for the native datetime-local picker.
   * This mirrors the usage date behaviour by preventing past dates, while
   * still allowing any time on today or future days.
   */
  get minPickupDateForPicker(): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    // datetime-local expects a full date-time string; we constrain only the date part
    return `${y}-${m}-${d}T00:00`;
  }

  canSet(): boolean {
    return this.stateService.canSetSupplyPickupDate();
  }

  canConfirm(): boolean {
    return this.stateService.canConfirmSupplyPickupDate();
  }

  isPickupDateEditable(): boolean {
    return this.stateService.isPickupDateEditable();
  }

  hasPendingStep(): boolean {
    return this.stateService.hasPendingStep();
  }

  /**
   * When false, the host is hidden so the parent sidebar flex `gap` does not reserve
   * space above the next section (e.g. Return Depot on return requests with no supply pickup UI).
   */
  get hasVisiblePickupContent(): boolean {
    if (!this.hasPendingStep()) return false;
    return this.canSet() || this.canConfirm();
  }

  @HostBinding('class')
  get hostLayoutClass(): string {
    return this.hasVisiblePickupContent ? 'block' : 'hidden';
  }

  /** Opens the native picker for the Set section (only that block has #pickupDatePicker). */
  openSetPickupDatePicker(): void {
    this.openNativeDatetimePicker(this.pickupDatePickerRef);
  }

  /** Opens the native picker for Update/Confirm section — required when Set section is hidden (e.g. user only has Confirm permission). */
  openConfirmPickupDatePicker(): void {
    this.openNativeDatetimePicker(this.confirmPickupDatePickerRef);
  }

  private openNativeDatetimePicker(ref?: ElementRef<HTMLInputElement>): void {
    const el = ref?.nativeElement;
    if (el?.showPicker) {
      el.showPicker();
    } else {
      el?.focus();
    }
  }

  constructor(
    private supplyServiceHelper: WorkflowApprovalSupplyService,
    private stateService: WorkflowApprovalStateService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Sync local pickupDate when parent updates it
    if (changes['pickupDate'] && changes['pickupDate'].currentValue !== this.localPickupDate) {
      this.localPickupDate = changes['pickupDate'].currentValue || '';
    }
  }

  /**
   * Update pickup date and emit to parent
   */
  onPickupDateChange(value: string): void {
    this.localPickupDate = value;
    this.pickupDateChange.emit(value);
  }

  /**
   * Set supply pickup date
   */
  setSupplyPickupDate(): void {
    if (this.pickupDateProcessing || !this.requestDetail || !this.localPickupDate) {
      if (!this.localPickupDate) {
        this.showErrorToastKeys(
          'workflowApprovalDetail.errors.selectPickupDate',
          'toast.error',
          'Please select a pickup date'
        );
      }
      return;
    }

    // Prevent selecting past dates (date part) – mirrors usage date validation
    if (!this.isPickupDateOnOrAfterToday(this.localPickupDate)) {
      this.showErrorToastKeys(
        'workflowApprovalDetail.errors.pickupDateMustBeTodayOrFuture',
        'toast.error',
        'Pickup date must be today or a future date'
      );
      return;
    }

    // Prevent changes if date already set
    if (this.isPickupDateAlreadySet) {
      this.showErrorToastKeys(
        'workflowApprovalDetail.errors.pickupDateAlreadySet',
        'toast.error',
        'Pickup date has already been set and cannot be modified'
      );
      return;
    }

    this.pickupDateProcessing = true;

    this.supplyServiceHelper.setSupplyPickupDate({
      requestId: this.requestId,
      pickupDate: this.localPickupDate,
      isWeaponOrder: this.isWeaponOrder
    }, this.destroy$)
      .subscribe({
        next: () => {
          this.pickupDateProcessing = false;
          this.pickupDateSet.emit();
          this.pickupDateChanged.emit();
        },
        error: (error: unknown) => {
          this.pickupDateProcessing = false;
          this.showErrorToast(error, 'Failed to set pickup date');
        }
      });
  }

  /**
   * Confirm supply pickup date
   */
  confirmSupplyPickupDate(): void {
    if (this.confirmPickupDateProcessing || !this.requestDetail || !this.localPickupDate) {
      if (!this.localPickupDate) {
        this.showErrorToastKeys(
          'workflowApprovalDetail.errors.selectPickupDate',
          'toast.error',
          'Please select a pickup date'
        );
      }
      return;
    }

    // Prevent selecting past dates (date part) – mirrors usage date validation
    if (!this.isPickupDateOnOrAfterToday(this.localPickupDate)) {
      this.showErrorToastKeys(
        'workflowApprovalDetail.errors.pickupDateMustBeTodayOrFuture',
        'toast.error',
        'Pickup date must be today or a future date'
      );
      return;
    }

    this.confirmPickupDateProcessing = true;

    this.supplyServiceHelper.confirmSupplyPickupDate({
      requestId: this.requestId,
      pickupDate: this.localPickupDate,
      isWeaponOrder: this.isWeaponOrder
    }, this.destroy$)
      .subscribe({
        next: () => {
          this.confirmPickupDateProcessing = false;
          this.pickupDateConfirmed.emit();
          this.pickupDateChanged.emit();
        },
        error: (error: unknown) => {
          this.confirmPickupDateProcessing = false;
          this.showErrorToast(error, 'Failed to confirm pickup date');
        }
      });
  }

  /**
   * Checks if the date part of a datetime-local string is today or in the future.
   * Follows the same approach as usage date validation, comparing normalized YYYY-MM-DD
   * strings to avoid timezone-related issues.
   */
  private isPickupDateOnOrAfterToday(dateTimeStr: string): boolean {
    if (!dateTimeStr?.trim()) return false;

    // Extract YYYY-MM-DD from the datetime-local value
    const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return false;

    const normalized = match[0]; // YYYY-MM-DD

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return normalized >= todayStr;
  }

  private showSuccessToast(messageKey: string, titleKey: string = 'toast.success'): void {
    this.translateService
      .get([titleKey, messageKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.success(translations[messageKey], translations[titleKey]);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translateService);
    this.translateService
      .get('toast.error')
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(msg, translations['toast.error']);
      });
  }

  private showErrorToastKeys(bodyKey: string, titleKey: string, fallbackBody: string): void {
    this.translateService
      .get([titleKey, bodyKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(translations[bodyKey] || fallbackBody, translations[titleKey]);
      });
  }

  private showWarningToast(messageKey: string, titleKey: string = 'toast.warning'): void {
    this.translateService
      .get([titleKey, messageKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.warning(translations[messageKey], translations[titleKey]);
      });
  }
}

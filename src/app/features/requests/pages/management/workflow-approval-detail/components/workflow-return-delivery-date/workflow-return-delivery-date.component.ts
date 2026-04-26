import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Calendar, Edit3 } from 'lucide-angular';
import { RequestDetail } from '@models/workflow-approval.model';
import { ReturnService } from '@requests/services/return.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { WorkflowApprovalPermissionsService } from '../../services/workflow-approval-permissions.service';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { formatDateForInput, formatDateTimeExtended } from '@core/utils/format.utils';
import { hasPendingStep } from '../../utils/workflow-approval-helpers';

@Component({
  selector: 'app-workflow-return-delivery-date',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './workflow-return-delivery-date.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowReturnDeliveryDateComponent implements OnChanges {
  readonly Calendar = Calendar;
  readonly Edit3 = Edit3;

  @Input() requestId!: number;
  @Input() requestDetail: RequestDetail | null = null;
  @Input() destroy$!: Subject<void>;

  @Output() deliveryDateSet = new EventEmitter<void>();

  @ViewChild('deliveryDatePicker') deliveryDatePickerRef?: ElementRef<HTMLInputElement>;

  localDeliveryDate = '';
  processing = false;
  isEditMode = false;

  get isAlreadySet(): boolean {
    return !!this.requestDetail?.deliveryDate;
  }

  get canShow(): boolean {
    if (!this.requestDetail || this.requestDetail.requestType !== 'Return') return false;
    if (this.stateService.canSetReturnDeliveryDate()) return true;
    return this.isAlreadySet;
  }

  get isApproved(): boolean {
    return !hasPendingStep(this.requestDetail);
  }

  get canEdit(): boolean {
    return !this.isApproved && this.stateService.canSetReturnDeliveryDate();
  }

  get canChangeReturnDeliveryDate(): boolean {
    if (!this.requestDetail) return false;
    if (!this.canEdit) return false;
    return this.permissionsService.canUpdateReturnWorkflowFields(this.requestDetail);
  }

  get deliveryDateForInput(): string {
    if (!this.localDeliveryDate) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(this.localDeliveryDate)) {
      return this.localDeliveryDate;
    }
    const datePart = formatDateForInput(this.localDeliveryDate) || this.localDeliveryDate;
    if (!datePart) return '';
    return `${datePart}T00:00`;
  }

  get deliveryDateDisplay(): string {
    if (!this.localDeliveryDate?.trim()) return '';
    const raw = this.localDeliveryDate.trim();
    return formatDateTimeExtended(raw) || '';
  }

  get minDeliveryDateForPicker(): string {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}T00:00`;
  }

  constructor(
    private returnService: ReturnService,
    private stateService: WorkflowApprovalStateService,
    private permissionsService: WorkflowApprovalPermissionsService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestDetail'] && this.requestDetail) {
      if (this.requestDetail.deliveryDate) {
        const raw = this.requestDetail.deliveryDate;
        if (typeof raw === 'string') {
          this.localDeliveryDate = raw.includes('T') ? raw.substring(0, 16) : raw;
        } else if (raw instanceof Date) {
          this.localDeliveryDate = raw.toISOString().substring(0, 16);
        }
      }
      if (!this.canChangeReturnDeliveryDate) {
        this.isEditMode = false;
      }
    }
  }

  openDatePicker(): void {
    const el = this.deliveryDatePickerRef?.nativeElement;
    if (el?.showPicker) {
      el.showPicker();
    } else {
      el?.focus();
    }
  }

  onDateChange(value: string): void {
    this.localDeliveryDate = value;
  }

  enableEdit(): void {
    if (!this.canChangeReturnDeliveryDate) return;
    this.isEditMode = true;
    this.cdr.markForCheck();
  }

  setDeliveryDate(): void {
    if (this.processing || !this.localDeliveryDate) return;

    this.processing = true;
    this.returnService.setDeliveryDate(this.requestId, this.localDeliveryDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processing = false;
          this.isEditMode = false;
          this.deliveryDateSet.emit();
          this.translateService.get(['toast.success', 'workflowApprovalDetail.success.returnDeliveryDateSet'])
            .pipe(takeUntil(this.destroy$))
            .subscribe(t => {
              this.toastService.success(
                t['workflowApprovalDetail.success.returnDeliveryDateSet'] || 'Delivery date set successfully',
                t['toast.success'] || 'Success'
              );
            });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.processing = false;
          const msg = ErrorHandler.extractErrorMessage(error, 'Failed to set delivery date');
          this.translateService.get('toast.error')
            .pipe(takeUntil(this.destroy$))
            .subscribe(title => {
              this.toastService.error(msg, title);
            });
          this.cdr.markForCheck();
        }
      });
  }
}

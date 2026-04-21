import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { formatTimeToMilitary, formatDateTimeExtended } from '@utils/format.utils';
import { localizedBilingualLabel } from '@utils/localization.utils';

export interface OrderItem {
  orderId: string;
  requestDate: string;
  /** Preferred: bilingual fields; UI resolves via localizedBilingualLabel */
  departmentNameEn?: string;
  departmentNameAr?: string;
  requesterNameEn?: string;
  requesterNameAr?: string;
  /** Legacy single string (e.g. search); prefer En/Ar for display */
  departmentName?: string;
  requesterName?: string;
  items?: ReturnItem[];
  /** Numeric backend id for opening details */
  requestId?: number;
}

export interface ReturnItem {
  itemName: string;
  itemNo: string;
  quantity: number;
  notes?: string;
}

export type StatusType = 'new-issue' | 'on-progress' | 'completed' | 'new' | 'declined' | 'returned' | 'action-required';

@Component({
  selector: 'app-status-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './status-card.component.html',
  styleUrls: ['./status-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusCardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @Input() title: string = '';
  @Input() status: StatusType = 'new-issue';
  @Input() orders: OrderItem[] = [];
  @Input() orderRequestId: number | null = null;
  @Input() returnRequestId: number | null = null;
  @Input() discardRequestId: number | null = null;
  @Input() isMyTurn: boolean = false;
  @Output() viewOrderDetails = new EventEmitter<number>();
  @Output() viewDetails = new EventEmitter<number>();
  @Output() viewDiscardDetails = new EventEmitter<number>();

  constructor(
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayDepartment(order: OrderItem): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return localizedBilingualLabel(order.departmentNameEn, order.departmentNameAr, order.departmentName, lang);
  }

  displayRequester(order: OrderItem): string {
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return localizedBilingualLabel(order.requesterNameEn, order.requesterNameAr, order.requesterName, lang);
  }

  onViewDetails(): void {
    if (this.orderRequestId) {
      this.viewOrderDetails.emit(this.orderRequestId);
      return;
    }

    const firstOrderId = this.orders?.[0]?.requestId;
    if (firstOrderId != null) {
      this.viewOrderDetails.emit(firstOrderId);
      return;
    }

    if (this.returnRequestId) {
      this.viewDetails.emit(this.returnRequestId);
      return;
    }

    if (this.discardRequestId) {
      this.viewDiscardDetails.emit(this.discardRequestId);
      return;
    }
  }

  emitOrderDetails(orderRequestId?: number | null): void {
    if (orderRequestId != null) {
      this.viewOrderDetails.emit(orderRequestId);
      return;
    }
    this.onViewDetails();
  }

  hasDetailsButton(): boolean {
    return !!(
      this.orderRequestId ||
      this.returnRequestId ||
      this.discardRequestId ||
      (this.orders && this.orders.length > 0 && this.orders[0]?.requestId != null)
    );
  }

  /** Status dot fill (matches previous BEM color tokens). */
  getDotBg(): string {
    switch (this.status) {
      case 'new-issue':
      case 'new':
        return 'bg-[#e5e7eb]';
      case 'on-progress':
        return 'bg-[#f59e0b]';
      case 'completed':
        return 'bg-[#10b981]';
      case 'declined':
        return 'bg-[#ef4444]';
      case 'returned':
        return 'bg-[#a855f7]';
      default:
        return 'bg-[#e9ebf0]';
    }
  }

  /** Accent bar under header (matches previous divider tokens). */
  getDividerBg(): string {
    switch (this.status) {
      case 'new-issue':
      case 'new':
        return 'bg-[#7c5afe]';
      case 'on-progress':
        return 'bg-[#f59e0b]';
      case 'completed':
        return 'bg-[#10b981]';
      case 'declined':
        return 'bg-[#ef4444]';
      case 'returned':
        return 'bg-[#a855f7]';
      default:
        return 'bg-[#e5e7eb]';
    }
  }

  getStatusTranslationKey(): string {
    switch (this.status) {
      case 'new-issue':
      case 'new':
        return 'dashboard.statusLabels.new';
      case 'on-progress':
        return 'dashboard.onProgress';
      case 'completed':
        return 'dashboard.completed';
      case 'declined':
        return 'dashboard.statusLabels.rejected';
      case 'returned':
        return 'dashboard.statusLabels.returnedForReview';
      default:
        return 'dashboard.statusLabels.new';
    }
  }

  getNumberLabelKey(): string {
    // Check if this card is for returns
    if (this.returnRequestId) {
      return 'dashboard.returnNumber';
    }
    // Check if this card is for discards
    if (this.discardRequestId) {
      return 'dashboard.discardNumber';
    }
    // Default to order number
    return 'dashboard.orderNumber';
  }

  isOrderCard(): boolean {
    return !!this.orderRequestId && !this.returnRequestId && !this.discardRequestId;
  }

  /**
   * Format approval date-time for display
   * Formats date as dd/MM/yyyy and time as HHmm (military format)
   * Handles both Date objects and string formats
   * Matches the format used in workflow-approval-detail component
   */
  formatApprovalDateTime(dateTime: string | Date | undefined): string {
    return formatDateTimeExtended(dateTime);
  }
}


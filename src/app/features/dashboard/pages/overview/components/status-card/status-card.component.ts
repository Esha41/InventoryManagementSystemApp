import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { formatTimeToMilitary, formatDate } from '@utils/format.utils';
import { localizedBilingualLabel } from '@utils/localization.utils';
import { AutoRejectCountdownComponent } from '@requests/components/auto-reject-countdown/auto-reject-countdown.component';
import { OrderAutoRejectCountdownDto } from '@requests/services/auto-reject-countdown.service';
import { getRequestStatusTranslationKey } from '@utils/status.utils';

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
  imports: [CommonModule, TranslateModule, AutoRejectCountdownComponent],
  templateUrl: './status-card.component.html',
  styleUrls: ['./status-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusCardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @Input() title: string = '';
  @Input() status: StatusType = 'new-issue';
  /** Raw backend request status (number/string) for accurate label translation. */
  @Input() requestStatus: number | string | null | undefined;
  @Input() orders: OrderItem[] = [];
  @Input() orderRequestId: number | null = null;
  @Input() returnRequestId: number | null = null;
  @Input() discardRequestId: number | null = null;
  @Input() isMyTurn: boolean = false;
  /** Auto-reject countdown for order cards (null/undefined = not applicable) */
  @Input() countdown: OrderAutoRejectCountdownDto | null | undefined;
  /** Numeric priority: 1=Normal, 2=Urgent, 3=VeryUrgent */
  @Input() priority: number | undefined;
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
    if (this.isAutoRejected()) {
      return 'bg-[#ef4444]';
    }
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
    if (this.isAutoRejected()) {
      return 'bg-[#ef4444]';
    }
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
    // Prefer raw backend status to distinguish AutoRejected (7) from Rejected (4).
    if (this.requestStatus !== null && this.requestStatus !== undefined) {
      return getRequestStatusTranslationKey(this.requestStatus);
    }

    // Fallback (legacy): derive label from card status.
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

  private isAutoRejected(): boolean {
    const s = this.requestStatus;
    if (s === null || s === undefined) return false;
    if (typeof s === 'number') return s === 7;
    const lower = String(s).toLowerCase().trim();
    return lower === '7' || lower === 'autorejected' || lower === 'auto rejected' || lower === 'auto-rejected';
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

  isVeryUrgent(): boolean {
    return this.priority === 3;
  }

  getPriorityBadgeClass(): string {
    switch (this.priority) {
      case 3: return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300';
      case 2: return 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300';
      case 1: return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300';
      default: return '';
    }
  }

  getPriorityTranslationKey(): string {
    switch (this.priority) {
      case 3: return 'dashboard.priorityLabels.veryUrgent';
      case 2: return 'dashboard.priorityLabels.urgent';
      case 1: return 'dashboard.priorityLabels.normal';
      default: return '';
    }
  }

  /**
   * Format request date for display (date only).
   */
  formatApprovalDateTime(dateTime: string | Date | undefined): string {
    return formatDate(dateTime);
  }
}


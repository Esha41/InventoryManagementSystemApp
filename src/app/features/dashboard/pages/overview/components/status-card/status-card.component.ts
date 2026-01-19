import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, MoreVertical, Eye } from 'lucide-angular';
import { formatTimeToMilitary } from '@utils/format.utils';

export interface OrderItem {
  orderId: string;
  requestDate: string;
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
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './status-card.component.html',
  styleUrls: ['./status-card.component.css']
})
export class StatusCardComponent {
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

  readonly MoreVertical = MoreVertical;
  readonly Eye = Eye;

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

  getDotColor(): string {
    switch (this.status) {
      case 'new-issue':
      case 'new':
        return 'status-card__dot--new';
      case 'on-progress':
        return 'status-card__dot--progress';
      case 'completed':
        return 'status-card__dot--done';
      case 'declined':
        return 'status-card__dot--declined';
      case 'returned':
        return 'status-card__dot--returned';
      default:
        return 'status-card__dot--muted';
    }
  }

  getDividerClass(): string {
    switch (this.status) {
      case 'new-issue':
      case 'new':
        return 'status-card__divider--new';
      case 'on-progress':
        return 'status-card__divider--progress';
      case 'completed':
        return 'status-card__divider--done';
      case 'declined':
        return 'status-card__divider--declined';
      case 'returned':
        return 'status-card__divider--returned';
      default:
        return 'status-card__divider--muted';
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
    if (!dateTime) return '';

    try {
      const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
      if (isNaN(date.getTime())) return '';

      // Format date as dd/MM/yyyy
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      // Format time as HHmm
      const formattedTime = formatTimeToMilitary(date);

      return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
    } catch {
      return '';
    }
  }
}


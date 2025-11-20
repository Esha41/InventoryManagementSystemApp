import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, MoreVertical, Eye } from 'lucide-angular';

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

export type StatusType = 'new-issue' | 'on-progress' | 'completed' | 'new';

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
}


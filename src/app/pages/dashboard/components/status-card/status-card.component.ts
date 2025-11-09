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
    } else if (this.returnRequestId) {
      this.viewDetails.emit(this.returnRequestId);
    } else if (this.discardRequestId) {
      this.viewDiscardDetails.emit(this.discardRequestId);
    }
  }

  hasDetailsButton(): boolean {
    return !!(this.orderRequestId || this.returnRequestId || this.discardRequestId);
  }

  getStatusColor(): string {
    switch (this.status) {
      case 'new-issue': return 'border-b-[#6366F1]';
      case 'on-progress': return 'border-b-[#F59E0B]';
      case 'completed': return 'border-b-[#10B981]';
      case 'new': return 'border-b-[#6366F1]';
      default: return 'border-b-gray-300';
    }
  }

  getBackgroundColor(): string {
    return 'bg-[#f5f5f5]';
  }

  getDotColor(): string {
    switch (this.status) {
      case 'new-issue': return 'bg-[#6366F1]';
      case 'on-progress': return 'bg-[#F59E0B]';
      case 'completed': return 'bg-[#10B981]';
      case 'new': return 'bg-[#6366F1]';
      default: return 'bg-gray-300';
    }
  }

  getStatusTranslationKey(): string {
    switch (this.status) {
      case 'new-issue':
        return 'dashboard.newIssue';
      case 'on-progress':
        return 'dashboard.onProgress';
      case 'completed':
        return 'dashboard.completed';
      case 'new':
        return 'dashboard.statusLabels.new';
      default:
        return 'dashboard.statusLabels.new';
    }
  }
}


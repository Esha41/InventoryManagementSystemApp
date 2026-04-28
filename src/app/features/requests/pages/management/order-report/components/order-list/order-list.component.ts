import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, X } from 'lucide-angular';
import { OrderDto } from '@models/order.model';
import { mapOrderStatusFromApi } from '@utils/status.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { TranslateService } from '@ngx-translate/core';

/**
 * Component for displaying and filtering the order list sidebar
 */
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderListComponent implements OnChanges, OnInit {
  @Input() orders: OrderDto[] = [];
  @Input() filteredOrders: OrderDto[] = [];
  @Input() selectedOrderId: number | null = null;
  @Input() loading: boolean = false;
  @Input() error: string | null = null;
  @Input() searchTerm: string = '';
  localSearchTerm: string = '';

  @Output() orderSelected = new EventEmitter<OrderDto>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() searchChanged = new EventEmitter<string>();

  readonly Search = Search;
  readonly X = X;

  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    this.localSearchTerm = this.searchTerm;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchTerm'] && changes['searchTerm'].currentValue !== this.localSearchTerm) {
      this.localSearchTerm = this.searchTerm;
    }
  }

  onSearchChange(): void {
    this.searchChanged.emit(this.localSearchTerm);
  }

  clearSearch(): void {
    this.localSearchTerm = '';
    this.searchChanged.emit('');
  }

  selectOrder(order: OrderDto): void {
    if (!order || !order.id) {
      return;
    }
    this.orderSelected.emit(order);
  }

  refresh(): void {
    this.refreshRequested.emit();
  }

  trackByOrderId(_: number, order: OrderDto): number | undefined {
    return order.id;
  }

  /**
   * i18n key for the status badge (dashboard labels + order-report "completed" for approved).
   */
  getOrderListStatusTranslationKey(status: number | string): string {
    const label = mapOrderStatusFromApi(status);
    switch (label) {
      case 'Approved':
        return 'requestsManagement.orderReport.workflowStatus.completed';
      case 'New':
        return 'dashboard.statusLabels.new';
      case 'In Progress':
        return 'dashboard.statusLabels.underProcess';
      case 'Auto-Rejected':
        return 'dashboard.statusLabels.autoRejected';
      case 'Rejected':
        return 'dashboard.statusLabels.rejected';
      case 'Cancelled':
        return 'dashboard.statusLabels.cancelled';
      case 'Returned for Review':
        return 'dashboard.statusLabels.returnedForReview';
      default:
        return 'dashboard.statusLabels.new';
    }
  }

  getOrderListStatusClass(status: number | string): string {
    const label = mapOrderStatusFromApi(status);
    switch (label) {
      case 'Approved':
        return 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300';
      case 'New':
        return 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'Auto-Rejected':
        return 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-900/20 dark:text-gray-300';
      case 'Returned for Review':
        return 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300';
      default:
        return 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border-[var(--color-border)]';
    }
  }

  getPriorityLabel(priority: number | string): string {
    return mapOrderPriorityToString(priority);
  }

  getPriorityColorClass(priority: number | string): string {
    const priorityLabel = this.getPriorityLabel(priority).toLowerCase();
    if (priorityLabel === 'normal') {
      return 'priority-normal';
    } else if (priorityLabel === 'urgent') {
      return 'priority-urgent';
    } else if (priorityLabel === 'veryurgent') {
      return 'priority-veryurgent';
    }
    return 'priority-normal'; // default
  }

  getDepartmentName(order: OrderDto): string {
    if (!order) return this.translate.instant('requestsManagement.orderReport.list.unknown');
    const currentLang = getCurrentLang(this.translate);

    if (order.department) {
      const localized = getLocalizedName(order.department, currentLang);
      if (localized) return localized;
    }

    if (order.departmentNameEn || order.departmentNameAr) {
      const localized = getLocalizedName(
        { nameEn: order.departmentNameEn, nameAr: order.departmentNameAr },
        currentLang
      );
      if (localized) return localized;
    }

    return this.translate.instant('requestsManagement.orderReport.list.unknown');
  }
}

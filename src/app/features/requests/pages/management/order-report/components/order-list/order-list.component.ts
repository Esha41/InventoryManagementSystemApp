import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, X } from 'lucide-angular';
import { OrderDto } from '@models/order.model';
import { mapOrderStatusFromApi } from '@utils/status.utils';
import { getRequestStatusBadgeClass } from '@utils/status-class.utils';
import { getPriorityText, getPriorityClass, getPriorityKey } from '@utils/priority.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { defaultPageSize } from '@constants/app.constants';

/**
 * Component for displaying and filtering the order list sidebar
 */
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent],
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
  /** Total requests matching filters (all pages). */
  @Input() totalCount = 0;
  @Input() currentPage = 1;
  @Input() totalPages = 0;
  @Input() rowsPerPage = defaultPageSize;
  localSearchTerm: string = '';

  @Output() orderSelected = new EventEmitter<OrderDto>();
  @Output() refreshRequested = new EventEmitter<void>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() rowsPerPageChange = new EventEmitter<number>();

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

  onPaginationPageChange(page: number): void {
    this.pageChange.emit(page);
  }

  onRowsPerPageSelected(rows: number): void {
    this.rowsPerPageChange.emit(rows);
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
        return `${getRequestStatusBadgeClass('Approved')} border`;
      case 'New':
        return `${getRequestStatusBadgeClass('Pending')} border`;
      case 'In Progress':
        return `${getRequestStatusBadgeClass('Pending')} border`;
      case 'Auto-Rejected':
        return `${getRequestStatusBadgeClass('AutoRejected')} border`;
      case 'Rejected':
        return `${getRequestStatusBadgeClass('Rejected')} border`;
      case 'Cancelled':
        return `${getRequestStatusBadgeClass('Cancelled')} border`;
      case 'Returned for Review':
        return `${getRequestStatusBadgeClass('ReturnedForReview')} border`;
      default:
        return 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border border-[var(--color-border)]';
    }
  }

  getPriorityLabel(priority: number | string): string {
    return getPriorityText(priority);
  }

  /** Suffix for `common.priorityLevels.<key>` — must be Normal | Urgent | VeryUrgent, not display text. */
  getPriorityI18nSuffix(priority: number | string): string {
    return getPriorityKey(priority);
  }

  getPriorityColorClass(priority: number | string): string {
    return getPriorityClass(priority);
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

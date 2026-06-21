import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown, Inbox, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import {
  RequestFilterBarComponent,
  StatusFilter,
  PriorityFilter
} from '@requests/components/request-filter-bar/request-filter-bar.component';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { RequestsManagementService } from './services/requests-management.service';
import { getRequestStatusClass } from './utils/ui-helpers.utils';
import { Request } from './models/requests-management.model';
import { Subject, takeUntil } from 'rxjs';
import { filter } from 'rxjs/operators';
import { RequestStatusUpdateService } from '@requests/services/request-status-update.service';
import { defaultPageSize } from '@constants/app.constants';
import { AutoRejectCountdownService } from '@requests/services/auto-reject-countdown.service';
import { RequestAutoRejectCountdownDto } from '@models/workflow.model';
import { AutoRejectCountdownComponent } from '@requests/components/auto-reject-countdown/auto-reject-countdown.component';


@Component({
  selector: 'app-requests-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent, RequestFilterBarComponent, AppDatePipe, AutoRejectCountdownComponent],
  templateUrl: './requests-management.component.html',
  styleUrls: ['./requests-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestsManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly Math = Math;

  readonly ChevronDown = ChevronDown;
  readonly Inbox = Inbox;
  readonly Eye = Eye;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;

  readonly requestListSortColumns: { key: string; translationKey: string }[] = [
    { key: 'orderNumber', translationKey: 'requestsManagement.orderId' },
    { key: 'usageDate', translationKey: 'requestsManagement.requestDate' },
    { key: 'priority', translationKey: 'requestsManagement.priority' },
    { key: 'requestType', translationKey: 'requestsManagement.requestType' },
    { key: 'status', translationKey: 'requestsManagement.status' }
  ];

  requests: Request[] = [];
  loading = false;
  countdownByRequestId: Record<number, RequestAutoRejectCountdownDto> = {};

  // Filter state (managed by shared component)
  searchQuery: string = '';
  selectedStatusFilter: StatusFilter = 'all';
  selectedPriorityFilter: PriorityFilter = 'all';

  currentPage: number = 1;
  rowsPerPage: number = defaultPageSize;
  totalItems: number = 0;

  sortState: { column: string | null; direction: 'asc' | 'desc' } = {
    column: null,
    direction: 'asc'
  };

  constructor(
    private requestsManagementService: RequestsManagementService,
    private router: Router,
    private requestStatusUpdateService: RequestStatusUpdateService,
    private cdr: ChangeDetectorRef,
    private autoRejectCountdownService: AutoRejectCountdownService
  ) { }

  ngOnInit(): void {
    // Initial load
    this.loadRequests();

    this.requestStatusUpdateService.onRequestStatusUpdated$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadRequests();
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        filter(() => {
          const path = this.router.url.split(/[?#]/)[0];
          return path === '/requests/requests-management' || path.startsWith('/requests/requests-management/');
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadRequests();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRequests(): void {
    this.loading = true;
    this.countdownByRequestId = {};
    this.cdr.markForCheck();

    this.requestsManagementService.getRequests(
      this.currentPage,
      this.rowsPerPage,
      this.searchQuery,
      this.selectedStatusFilter,
      this.selectedPriorityFilter,
      this.sortState
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.requests = response.items;
          this.loadAutoRejectCountdowns();
          this.totalItems = response.totalCount;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.requests = [];
          this.totalItems = 0;
          this.cdr.markForCheck();
        }
      });
  }

  applyFilters(): void {
    // With server-side pagination, applyFilters just reloads
    this.currentPage = 1;
    this.loadRequests();
  }

  onStatusFilterChange(status: StatusFilter): void {
    this.selectedStatusFilter = status;
    this.applyFilters();
  }

  onPriorityFilterChange(priority: PriorityFilter): void {
    this.selectedPriorityFilter = priority;
    this.applyFilters();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  onFiltersCleared(): void {
    this.selectedStatusFilter = 'all';
    this.selectedPriorityFilter = 'all';
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadRequests();
  }

  sortByColumn(column: string): void {
    if (this.sortState.column === column) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.column = column;
      this.sortState.direction =
        column === 'priority' || column === 'usageDate' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    this.loadRequests();
  }

  get paginatedRequests(): Request[] {
    return this.requests;
  }

  get filteredRequestsCount(): number {
    return this.totalItems;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    if (this.currentPage !== page) {
      this.currentPage = page;
      this.loadRequests();
    }
  }

  onRowsPerPageChange(rows: number): void {
    if (this.rowsPerPage !== rows) {
      this.rowsPerPage = rows;
      this.currentPage = 1;
      this.loadRequests();
    }
  }

  getStatusClass(status: string): string {
    return getRequestStatusClass(status);
  }

  getPriorityClass(priority: string): string {
    const priorityLower = priority?.toLowerCase().trim().replace(/\s+/g, '') ?? '';
    switch (priorityLower) {
      case 'normal':
        return 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/50';
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/50';
      case 'veryurgent':
        return 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50';
      default:
        return 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)] border border-[var(--color-border)]';
    }
  }

  /**
   * Get priority translation key
   */
  getPriorityText(priority: string): string {
    const priorityLower = priority?.toLowerCase().trim().replace(/\s+/g, '') || '';
    switch (priorityLower) {
      case 'normal':
        return 'dashboard.priorityLabels.normal';
      case 'urgent':
        return 'dashboard.priorityLabels.urgent';
      case 'veryurgent':
        return 'dashboard.priorityLabels.veryUrgent';
      default:
        return 'dashboard.priorityLabels.urgent';
    }
  }

  /**
   * Get status translation key (aligned with order report: approved → Completed, same dashboard keys as elsewhere).
   */
  getStatusText(status: string): string {
    const statusLower = status?.toLowerCase().trim() || '';
    switch (statusLower) {
      case 'new':
        return 'dashboard.statusLabels.new';
      case 'pending':
        return 'dashboard.statusLabels.underProcess';
      case 'confirmed':
        return 'requestsManagement.orderReport.workflowStatus.completed';
      case 'rejected':
        return 'dashboard.statusLabels.rejected';
      case 'autorejected':
      case 'auto-rejected':
        return 'dashboard.statusLabels.autoRejected';
      case 'returned':
      case 'returnedforreview':
        return 'dashboard.statusLabels.returnedForReview';
      default:
        return 'dashboard.statusLabels.new';
    }
  }

  /**
   * Get request type translation key
   */
  getRequestTypeText(requestType: string): string {
    const typeLower = requestType?.toLowerCase().trim() || '';
    switch (typeLower) {
      case 'order':
        return 'requestsManagement.order';
      case 'return':
        return 'requestsManagement.return';
      case 'discard':
        return 'requestsManagement.discard';
      default:
        return 'requestsManagement.order';
    }
  }

  openOrderDetails(order: Request): void {
    this.router.navigate(['/requests/requests-management', order.id, 'workflow-approval']);
  }

  private loadAutoRejectCountdowns(): void {
    const orderIds = this.requests
      .filter(r => r.requestType === 'Order')
      .map(r => r.id);
    if (orderIds.length === 0) {
      this.countdownByRequestId = {};
      this.cdr.markForCheck();
      return;
    }
    this.autoRejectCountdownService
      .getBulk(orderIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe(rows => {
        this.countdownByRequestId =
          this.autoRejectCountdownService.mapByRequestId(rows);
        this.cdr.markForCheck();
      });
  }

  getAutoRejectCountdown(request: Request): RequestAutoRejectCountdownDto | null {
    if (request.requestType !== 'Order') return null;
    return this.countdownByRequestId[request.id] ?? null;
  }
}

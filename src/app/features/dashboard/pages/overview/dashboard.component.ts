import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, merge } from 'rxjs';
import {  debounceTime, filter, map } from 'rxjs/operators';
import { LucideAngularModule, ShieldAlert, Grid, List, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { StatusCardComponent, OrderItem } from './components/status-card/status-card.component';
import { RequestDetailsModalComponent, UnifiedRequestDto } from './components/request-details-modal/request-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { UnifiedRequestService } from '@requests/services/unified-request.service';
import { ReturnService } from '@requests/services/return.service';
import { ReturnDto } from '@models/return.model';
import { DiscardService } from '@requests/services/discard.service';
import { DiscardDto } from '@models/discard.model';
import { OrderService } from '@requests/services/order.service';
import { OrderDto } from '@models/order.model';
import { UserContextService } from '@services/user-context.service';
import { RequestStatusUpdateService } from '@requests/services/request-status-update.service';
import { DashboardDataService } from '@dashboard/services/dashboard-data.service';
import { DashboardFilterService } from '@dashboard/services/dashboard-filter.service';
import { DashboardCard } from '@models/dashboard.model';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { RequestFilterBarComponent, StatusFilter, PriorityFilter, AutoRejectFilter } from '@requests/components/request-filter-bar/request-filter-bar.component';
import { AutoRejectCountdownService, OrderAutoRejectCountdownDto } from '@requests/services/auto-reject-countdown.service';
import { AutoRejectCountdownComponent } from '@requests/components/auto-reject-countdown/auto-reject-countdown.component';
import {  formatDateTimeExtended } from '@utils/format.utils';
import { defaultPageSize } from '@constants/app.constants';
import { localizedBilingualLabel } from '@utils/localization.utils';
import { getRequestStatusTranslationKey } from '@utils/status.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    StatusCardComponent,
    RequestDetailsModalComponent,
    PaginationComponent,
    RowsPerPageComponent,
    RequestFilterBarComponent,
    AutoRejectCountdownComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // View state
  viewMode: 'grid' | 'table' = 'grid';
  currentPage = 1;
  /** Same page size for grid and list/table views (server-side pagination). */
  rowsPerPage = defaultPageSize;

  // Icons
  readonly Grid = Grid;
  readonly List = List;
  readonly Eye = Eye;
  readonly ShieldAlert = ShieldAlert;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;

  // Filter state (managed by shared component)
  searchQuery: string = '';
  selectedStatusFilter: StatusFilter = 'all';
  selectedPriorityFilter: PriorityFilter = 'all';
  selectedAutoRejectFilter: AutoRejectFilter = 'all';

  // Auto-reject countdowns keyed by order request id
  countdownByRequestId: Record<number, OrderAutoRejectCountdownDto> = {};

  // Sort state
  sortState: { column: string | null; direction: 'asc' | 'desc' } = {
    column: null,
    direction: 'asc'
  };


  // Filtered cards based on user permissions and roles
  visibleCards: DashboardCard[] = [];
  totalItems = 0;
  isLoading = false;


  private rawVisibleCards: DashboardCard[] = [];
  private rawTotalItems = 0;



  // Modal state (unified)
  isRequestModalOpen = false;
  selectedRequest: UnifiedRequestDto | null = null;
  private readonly orderRequestsMap = new Map<number, OrderDto>();
  private readonly returnRequestsMap = new Map<number, ReturnDto>();
  private readonly discardRequestsMap = new Map<number, DiscardDto>();

  showContactAdminNotice = false;

  /** TrackBy for dashboard cards - uses request id for stable identity */
  trackByCard(_: number, card: DashboardCard): number | string {
    return card.orderRequestId ?? card.returnRequestId ?? card.discardRequestId ?? _;
  }

  // Helper for status badges in table view
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'new-issue':
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'on-progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'declined':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'returned':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      default:
        return 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)]';
    }
  }

  /** Returns only the background colour class for the status dot (no text classes). */
  getStatusDotClass(status: string): string {
    switch (status) {
      case 'new-issue':
      case 'new':
        return 'bg-blue-500';
      case 'on-progress':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'declined':
        return 'bg-red-500';
      case 'returned':
        return 'bg-purple-500';
      default:
        return 'bg-[var(--color-text-muted)]';
    }
  }

  // Helper for status translation in table view
  displayDepartment(order: OrderItem | undefined): string {
    if (!order) return 'N/A';
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return localizedBilingualLabel(order.departmentNameEn, order.departmentNameAr, order.departmentName, lang);
  }

  displayRequester(order: OrderItem | undefined): string {
    if (!order) return 'N/A';
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    return localizedBilingualLabel(order.requesterNameEn, order.requesterNameAr, order.requesterName, lang);
  }

  getStatusTranslationKey(status: string): string {
    switch (status) {
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

  getRequestStatusTranslationKey(card: DashboardCard): string {
    // Prefer raw backend status to distinguish AutoRejected (7) from Rejected (4).
    const raw = card.requestStatus ?? card.status;
    return getRequestStatusTranslationKey(raw);
  }

  // Helper for handling view details click in table
  onTableAction(card: DashboardCard): void {
    if (card.orderRequestId) {
      this.onViewOrderDetails(card.orderRequestId);
    } else if (card.returnRequestId) {
      this.onViewDetails(card.returnRequestId);
    } else if (card.discardRequestId) {
      this.onViewDiscardDetails(card.discardRequestId);
    }
  }

  constructor(
    private readonly authService: BackendAuthService,
    private readonly unifiedRequestService: UnifiedRequestService,
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly userContextService: UserContextService,
    private readonly requestStatusUpdateService: RequestStatusUpdateService,
    private readonly dashboardDataService: DashboardDataService,
    private readonly dashboardFilterService: DashboardFilterService,
    private readonly autoRejectCountdownService: AutoRejectCountdownService
  ) { }

  get paginatedCards(): DashboardCard[] {
    return this.visibleCards;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadAllRequests();
    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.loadAllRequests();
  }

  toggleViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
    // Keep rowsPerPage unchanged so grid and table use the same page size (including user selection).
    this.currentPage = 1;
    this.loadAllRequests();
  }

  ngOnInit(): void {
    // Combine all triggers that should reload data into a single stream
    // This is more efficient than multiple separate subscriptions
    const userChanges$ = this.authService.currentUser$.pipe(
      filter(user => !!user),
      map(() => 'user-change')
    );

    const statusUpdates$ = this.requestStatusUpdateService.onRequestStatusUpdated$.pipe(
      map(() => 'status-update')
    );

    const navigationChanges$ = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      filter(() => this.router.url === '/dashboard' || this.router.url.startsWith('/dashboard')),
      map(() => 'navigation')
    );

    // Merge all triggers and use distinctUntilChanged with a time window
    // to prevent duplicate calls within a short time frame
    merge(userChanges$, statusUpdates$, navigationChanges$)
      .pipe(
        debounceTime(100), // Small debounce to handle rapid successive events
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadAllRequests();
      });

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  /**
   * Load all requests using DashboardDataService
   * Business logic has been extracted to service following Angular best practices
   */
  private loadAllRequests(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.dashboardDataService.getDashboardRequests(
      this.currentPage,
      this.rowsPerPage,
      this.searchQuery,
      this.selectedStatusFilter,
      this.selectedPriorityFilter,
      this.sortState,
      'all'
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.rawVisibleCards = response.items;
          this.rawTotalItems = response.totalCount;
          // Apply client-side auto-reject filter after countdowns load (or immediately if none).
          this.visibleCards = response.items;
          this.totalItems = response.totalCount;
          this.isLoading = false;
          this.cdr.markForCheck();
          this.loadAutoRejectCountdowns();
        },
        error: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadAutoRejectCountdowns(): void {
    const orderIds = this.visibleCards
      .filter(c => !!c.orderRequestId)
      .map(c => c.orderRequestId as number);
    if (orderIds.length === 0) {
      this.countdownByRequestId = {};
      this.applyAutoRejectFilter();
      this.cdr.markForCheck();
      return;
    }
    this.autoRejectCountdownService.getBulk(orderIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe(rows => {
        this.countdownByRequestId = this.autoRejectCountdownService.mapByRequestId(rows);
        this.applyAutoRejectFilter();
        this.cdr.markForCheck();
      });
  }

  private applyAutoRejectFilter(): void {
    if (this.selectedAutoRejectFilter === 'all') {
      this.visibleCards = this.rawVisibleCards;
      this.totalItems = this.rawTotalItems;
      return;
    }

    const maxDays =
      this.selectedAutoRejectFilter === 'expiring-1day' ? 1 :
      this.selectedAutoRejectFilter === 'expiring-3days' ? 3 :
      this.selectedAutoRejectFilter === 'expiring-7days' ? 7 :
      undefined;

    const filtered = this.rawVisibleCards.filter(card => {
      if (!card.orderRequestId) return false; // auto-reject applies to orders only
      const cd = this.countdownByRequestId[card.orderRequestId];
      if (!cd || cd.state === 'none') return false;

      if (maxDays != null) {
        // "Expiring within N days" — include warning/running; exclude expired.
        return cd.state !== 'expired' && cd.daysRemaining <= maxDays;
      }

      return true;
    });

    this.visibleCards = filtered;
    // Note: server-side pagination/counts won't match; show filtered count for UX.
    this.totalItems = filtered.length;
  }

  getAutoRejectCountdown(card: DashboardCard): OrderAutoRejectCountdownDto | null {
    if (!card.orderRequestId) return null;
    return this.countdownByRequestId[card.orderRequestId] ?? null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onStatusFilterChange(status: StatusFilter): void {
    this.selectedStatusFilter = status;
    this.currentPage = 1;
    this.loadAllRequests();
  }

  onPriorityFilterChange(priority: PriorityFilter): void {
    this.selectedPriorityFilter = priority;
    this.currentPage = 1;
    this.loadAllRequests();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.currentPage = 1;
    this.loadAllRequests();
  }

  onAutoRejectFilterChange(filter: AutoRejectFilter): void {
    this.selectedAutoRejectFilter = filter;
    this.currentPage = 1;
    this.loadAllRequests();
  }

  onFiltersCleared(): void {
    this.selectedStatusFilter = 'all';
    this.selectedPriorityFilter = 'all';
    this.selectedAutoRejectFilter = 'all';
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadAllRequests();
  }

  getPriorityBadgeClass(priority: number | undefined): string {
    switch (priority) {
      case 3: return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300';
      case 2: return 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300';
      case 1: return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)]';
    }
  }

  getPriorityTranslationKey(priority: number | undefined): string {
    switch (priority) {
      case 3: return 'dashboard.priorityLabels.veryUrgent';
      case 2: return 'dashboard.priorityLabels.urgent';
      case 1: return 'dashboard.priorityLabels.normal';
      default: return '';
    }
  }

  sortByColumn(column: string): void {
    if (this.sortState.column === column) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.column = column;
      // Default priority sort descending (VeryUrgent first)
      this.sortState.direction = column === 'priority' ? 'desc' : 'asc';
    }
    this.currentPage = 1;
    this.loadAllRequests();
  }


  /**
   * Sort cards based on column and direction
   * @deprecated Use DashboardFilterService.sortCards instead
   */
  private sortCards(cards: DashboardCard[], column: string, direction: 'asc' | 'desc'): DashboardCard[] {
    return this.dashboardFilterService.sortCards(cards, column, direction);
  }


  get filteredCardsCount(): number {
    return this.totalItems;
  }



  shouldShowCard(card: DashboardCard): boolean {
    return this.paginatedCards.includes(card);
  }


  onViewOrderDetails(orderRequestId: number): void {
    const cachedOrder = this.orderRequestsMap.get(orderRequestId);

    this.dashboardDataService.getOrderById(orderRequestId, cachedOrder)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          this.selectedRequest = order as UnifiedRequestDto;
          this.orderRequestsMap.set(order.id, order); // Cache for future use
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  onViewDetails(returnRequestId: number): void {
    const cachedReturn = this.returnRequestsMap.get(returnRequestId);

    this.dashboardDataService.getReturnById(returnRequestId, cachedReturn)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (returnRequest) => {
          this.selectedRequest = returnRequest as UnifiedRequestDto;
          this.returnRequestsMap.set(returnRequest.id, returnRequest); // Cache for future use
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  onViewDiscardDetails(discardRequestId: number): void {
    const cachedDiscard = this.discardRequestsMap.get(discardRequestId);

    this.dashboardDataService.getDiscardById(discardRequestId, cachedDiscard)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (discardRequest) => {
          this.selectedRequest = discardRequest as UnifiedRequestDto;
          this.discardRequestsMap.set(discardRequest.id, discardRequest); // Cache for future use
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  closeRequestModal(): void {
    this.isRequestModalOpen = false;
    this.selectedRequest = null;
    this.cdr.markForCheck();
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


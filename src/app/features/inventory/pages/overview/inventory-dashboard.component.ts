import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, combineLatest, of, merge } from 'rxjs';
import { catchError, debounceTime, filter, map } from 'rxjs/operators';
import { LucideAngularModule, ShieldAlert, RefreshCw, Grid, List, Eye } from 'lucide-angular';
import { StatusCardComponent, OrderItem, ReturnItem } from '@dashboard/pages/overview/components/status-card/status-card.component';
import { RequestDetailsModalComponent, UnifiedRequestDto } from '@dashboard/pages/overview/components/request-details-modal/request-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { OrderService } from '@services/order.service';
import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { NotificationService } from '@services/notification.service';
import { InventoryService } from '@services/inventory.service';
import { UserContextService } from '@services/user-context.service';
import { UnifiedRequestService } from '@services/unified-request.service';
import { OverstockCardComponent, OverstockItemView } from '@dashboard/pages/overview/components/overstock-card/overstock-card.component';
import { ReturnService } from '@services/return.service';
import { ReturnDto } from '@models/return.model';
import { DiscardService } from '@services/discard.service';
import { DiscardDto } from '@models/discard.model';
import { ErrorHandlingService } from '@services/error-handling.service';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { RequestFilterBarComponent, StatusFilter } from '@components/request-filter-bar/request-filter-bar.component';
import { InventoryDashboardCard, StatisticsData } from '@models/inventory-dashboard.model';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { MonitoringService } from '@services/monitoring.service';
import {
  mapRequestStatusToCardStatus,
  getRequestStatusTranslationKey,
  filterDisplayableRequests,
  filterRequestsByDepartment,
  getRequestTitle,
  mapRequestItems,
  DisplayableRequest,
  CardStatus
} from '@utils/dashboard.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { separateRequestsByType, mapToOrderDto, mapToReturnDto, mapToDiscardDto } from '@utils/request-type-mapper.utils';
import { formatTimeToMilitary, formatDateTimeExtended } from '@utils/format.utils';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    StatusCardComponent,
    RequestDetailsModalComponent,
    OverstockCardComponent,
    PaginationComponent,
    RowsPerPageComponent,
    RequestFilterBarComponent,
    AppDateTimePipe
  ],
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private refreshTimer: any = null;

  // View state
  viewMode: 'table' = 'table';
  currentPage = 1;
  rowsPerPage = 10;

  // Dashboard cards
  allCards: InventoryDashboardCard[] = [];
  visibleCards: InventoryDashboardCard[] = [];

  // Modal state (unified)
  isRequestModalOpen = false;
  selectedRequest: UnifiedRequestDto | null = null;
  private readonly orderRequestsMap = new Map<number, OrderDto>();
  private readonly returnRequestsMap = new Map<number, ReturnDto>();
  private readonly discardRequestsMap = new Map<number, DiscardDto>();

  // Statistics
  statistics: StatisticsData = {
    totalItems: 0,
    totalQuantity: 0,
    lowStock: 0,
    expiringSoon: 0,
    monthlyActivity: Array(12).fill(0),
    monthlyActivityPercentages: Array(12).fill(0)
  };

  // Icons
  readonly ShieldAlert = ShieldAlert;
  readonly RefreshCw = RefreshCw;
  readonly Grid = Grid;
  readonly List = List;
  readonly Eye = Eye;

  showContactAdminNotice = false;

  // Filter state (managed by shared component)
  searchQuery: string = '';
  selectedStatusFilter: StatusFilter = 'all';

  constructor(
    private readonly authService: BackendAuthService,
    private readonly unifiedRequestService: UnifiedRequestService,
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly notificationService: NotificationService,
    private readonly inventoryService: InventoryService,
    private readonly userContext: UserContextService,
    private readonly translate: TranslateService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly requestStatusUpdateService: RequestStatusUpdateService,
    private readonly monitoringService: MonitoringService
  ) { }

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
      filter(() => this.router.url === '/inventory-dashboard' || this.router.url.startsWith('/inventory-dashboard')),
      map(() => 'navigation')
    );

    const languageChanges$ = this.translate.onLangChange.pipe(
      map(() => 'language-change')
    );

    // Merge all triggers and debounce to prevent duplicate calls
    merge(userChanges$, statusUpdates$, navigationChanges$, languageChanges$)
      .pipe(
        debounceTime(100), // Small debounce to handle rapid successive events
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadAll();
      });

    // Auto-refresh periodically (15 seconds)
    this.refreshTimer = setInterval(() => this.loadAll(), 15000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  onRefresh(): void {
    this.loadAll();
  }

  toggleViewMode(mode: 'grid' | 'table'): void {
    // Kept for compatibility if needed, but defaulting to table
    this.rowsPerPage = 10;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  get paginatedCards(): InventoryDashboardCard[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.visibleCards.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.visibleCards.length / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.cdr.markForCheck();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  private loadAll(): void {
    this.loadDataParallel();
    this.notificationService.refresh();
  }

  private loadDataParallel(): void {
    // Use unified API endpoint for better performance
    const requests$ = this.unifiedRequestService.getUserActionRequests().pipe(
      map(requests => separateRequestsByType(requests)),
      catchError((error) => {
        this.errorHandlingService.resolveHttpErrorMessage(error);
        return of({ orders: [], returns: [], discards: [] });
      })
    );

    const inventories$ = this.inventoryService.getAll().pipe(
      catchError((error) => {
        this.errorHandlingService.resolveHttpErrorMessage(error);
        return of([]);
      })
    );

    const summary$ = this.inventoryService.getAllItemsSummary().pipe(
      catchError((error) => {
        this.errorHandlingService.resolveHttpErrorMessage(error);
        return of([] as ItemInventorySummaryDto[]);
      })
    );

    const expiringLotsCount$ = this.monitoringService.getExpiringLotsCount().pipe(
      catchError((error) => {
        this.errorHandlingService.resolveHttpErrorMessage(error);
        return of(0);
      })
    );

    const lowStockCount$ = this.monitoringService.getLowStockItemsCount().pipe(
      catchError((error) => {
        this.errorHandlingService.resolveHttpErrorMessage(error);
        return of(0);
      })
    );

    combineLatest({
      requests: requests$,
      inventories: inventories$,
      summary: summary$,
      expiringLotsCount: expiringLotsCount$,
      lowStockCount: lowStockCount$
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ requests, inventories, summary, expiringLotsCount, lowStockCount }) => {
          // Transform BaseRequestDto to specific types
          const orders = requests.orders.map(o => mapToOrderDto(o));
          const returns = requests.returns.map(r => mapToReturnDto(r));
          const discards = requests.discards.map(d => mapToDiscardDto(d));

          // Process cards
          this.allCards = []; // Reset cards before rebuilding
          this.processRequestData(orders, returns, discards);

          // Process statistics
          this.calculateStatistics(inventories, orders, summary, expiringLotsCount, lowStockCount);

          this.filterCards();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorHandlingService.resolveHttpErrorMessage(error);
          this.cdr.markForCheck();
        }
      });
  }

  private filterCards(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = !!user?.permissions?.length;
    const userDeptId = user?.departmentId ?? null;
    const isAdmin = this.userContext.isAdminUser();

    if (!isAuthenticated) {
      this.visibleCards = [];
      this.showContactAdminNotice = false;
      return;
    }

    let filtered = this.allCards.filter(card => {
      // Admin sees all, unless limited by other logic (which we assume not for now)
      if (!isAdmin && card.departmentIds && card.departmentIds.length > 0) {
        if (userDeptId == null) return false;
        if (!card.departmentIds.includes(userDeptId)) return false;
      }

      // If no specific permissions required, allow
      if (!card.permissions || card.permissions.length === 0) return true;

      if (!hasPermissionsLoaded) return false;
      return this.authService.hasAnyPermission(card.permissions);
    });

    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      if (this.selectedStatusFilter === 'action-required') {
        filtered = filtered.filter(card => card.isMyTurn);
      } else {
        filtered = filtered.filter(card => card.status === this.selectedStatusFilter);
      }
    }

    // Apply search filter
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const query = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(card => {
        // Search in order IDs, department names, requester names
        return card.orders.some(order =>
          (order.orderId && order.orderId.toLowerCase().includes(query)) ||
          (order.departmentName && order.departmentName.toLowerCase().includes(query)) ||
          (order.requesterName && order.requesterName.toLowerCase().includes(query))
        );
      });
    }

    // Sort by status priority
    const rank = (c: InventoryDashboardCard): number => {
      switch (c.status) {
        case 'new': return 0;
        case 'on-progress': return 1;
        case 'completed': return 2;
        case 'declined': return 3;
        default: return 99;
      }
    };

    this.visibleCards = filtered
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        const ra = rank(a.c);
        const rb = rank(b.c);
        if (ra !== rb) return ra - rb;
        return a.i - b.i;
      })
      .map(x => x.c);

    // Reset to first page when filters change
    this.currentPage = 1;

    const permissionsArray = Array.isArray(user?.permissions) ? user?.permissions : [];
    this.showContactAdminNotice = isAuthenticated && permissionsArray.length === 0 && this.visibleCards.length === 0;
  }

  onStatusFilterChange(status: StatusFilter): void {
    this.selectedStatusFilter = status;
    this.filterCards();
    this.cdr.markForCheck();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.filterCards();
    this.currentPage = 1; // Reset to first page when searching
    this.cdr.markForCheck();
  }

  navigateToApproval(orderRequestId: number): void {
    this.router.navigate(['/requests-management', orderRequestId, 'workflow-approval']);
  }

  /**
   * Check if user can approve this order
   * Similar logic to WorkflowApprovalDetailComponent.canApproveOrReject()
   * Only shows button for administrators or users with workflow approval access
   */
  canApproveOrder(order: OrderDto | null): boolean {
    if (!order) {
      return false;
    }

    // Only show button for pending orders (status 1 = New, 2 = Under Process)
    // Status 3 = Approved, 4 = Rejected
    if (order.status !== 1 && order.status !== 2) {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    // Check if user is administrator (multiple detection methods)
    const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
    const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') ||
      currentUser?.email?.toLowerCase().includes('administrator');
    const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
    const isAdminUser = this.userContext.isAdminUser();

    const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions || isAdminUser;

    // Administrators can always approve
    if (isAdministrator) {
      return true;
    }

    // For non-administrators, check if they have permission to access the approval page
    // The route requires: viewrequest.page, viewrequest.view, or order.view (any of these)
    // The approval page itself will do the detailed role-based check for actual approval
    const hasApprovalPageAccess = this.authService.hasAnyPermission([
      'viewrequest.page',
      'viewrequest.view',
      'order.view'
    ]);

    return hasApprovalPageAccess;
  }

  get filteredCardsCount(): number {
    return this.visibleCards.length;
  }

  shouldShowCard(card: InventoryDashboardCard): boolean {
    return this.paginatedCards.includes(card);
  }

  // Helper methods for table view
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'new-issue':
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'on-progress': return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
      case 'completed': return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
      case 'declined': return 'bg-[var(--color-error)]/20 text-[var(--color-error)]';
      default: return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)]';
    }
  }

  getStatusTranslationKey(status: string): string {
    return getRequestStatusTranslationKey(status === 'new' || status === 'new-issue' ? 1 : status === 'on-progress' ? 2 : status === 'completed' ? 3 : 4);
  }

  onTableAction(card: InventoryDashboardCard): void {
    // Find the first order/request in this card to open
    // Logic: Try order first, then return, then discard
    if (card.orderRequestId) {
      this.onViewOrderDetails(card.orderRequestId);
    } else if (card.returnRequestId) {
      this.onViewReturnDetails(card.returnRequestId);
    } else if (card.discardRequestId) {
      this.onViewDiscardDetails(card.discardRequestId);
    } else {
      // Fallback: grab first item id
      const firstItem = card.orders[0];
      if (firstItem) {
        // Determine type if possible, or default to order if we have an order ID
        if (card.title.toLowerCase().includes('order') || firstItem.orderId) {
          // Assuming we stored the ID in requestId on the OrderItem
          if (firstItem.requestId) this.onViewOrderDetails(firstItem.requestId);
        }
      }
    }
  }

  private processRequestData(orders: OrderDto[], returns: ReturnDto[], discards: DiscardDto[]): void {
    const user = this.authService.getCurrentUser();
    const isAdmin = this.userContext.isAdminUser();

    // Filter displayable requests first (handles both string and number statuses)
    const displayableOrders = filterDisplayableRequests(orders);
    const displayableReturns = filterDisplayableRequests(returns || []);
    const displayableDiscards = filterDisplayableRequests(discards || []);

    // Filter by department
    const filteredOrders = filterRequestsByDepartment(displayableOrders, user?.departmentId);
    const filteredReturns = filterRequestsByDepartment(displayableReturns, user?.departmentId);
    const filteredDiscards = filterRequestsByDepartment(displayableDiscards, user?.departmentId);

    // Store in maps
    filteredOrders.forEach(o => this.orderRequestsMap.set(o.id, o));
    filteredReturns.forEach(r => this.returnRequestsMap.set(r.id, r));
    filteredDiscards.forEach(d => this.discardRequestsMap.set(d.id, d));

    // Process each request type using helper methods
    this.processOrderRequests(filteredOrders, isAdmin, user?.departmentId);
    this.processReturnRequests(filteredReturns, isAdmin, user?.departmentId);
    this.processDiscardRequests(filteredDiscards, isAdmin, user?.departmentId);
  }

  /**
   * Process and create cards for order requests
   */
  private processOrderRequests(orders: OrderDto[], isAdmin: boolean, userDepartmentId?: number | null): void {
    orders.forEach(order => {
      const cardStatus = mapRequestStatusToCardStatus(order.status);
      const card: InventoryDashboardCard = {
        title: getRequestTitle(order, order.orderNo),
        status: cardStatus,
        orders: [{
          orderId: getRequestTitle(order, order.orderNo),
          requestDate: order.creationDate ? (typeof order.creationDate === 'string' ? order.creationDate : order.creationDate.toISOString()) : '',
          departmentName: this.resolveOrderDepartmentName(order),
          requesterName: this.resolveRequesterName(order),
          items: mapRequestItems(order.requestItems),
          requestId: order.id
        }],
        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
        departmentIds: (!isAdmin && userDepartmentId != null) ? [userDepartmentId] : undefined,
        orderRequestId: order.id,
        isMyTurn: order.isMyTurn
      };
      this.allCards.push(card);
    });
  }

  /**
   * Process and create cards for return requests
   */
  private processReturnRequests(returns: ReturnDto[], isAdmin: boolean, userDepartmentId?: number | null): void {
    returns.forEach(ret => {
      const cardStatus = mapRequestStatusToCardStatus(ret.status);
      const card: InventoryDashboardCard = {
        title: getRequestTitle(ret),
        status: cardStatus,
        orders: [{
          orderId: getRequestTitle(ret),
          requestDate: (ret as any).creationDate ? (typeof (ret as any).creationDate === 'string' ? (ret as any).creationDate : (ret as any).creationDate.toISOString()) : '',
          departmentName: this.resolveReturnDepartmentName(ret),
          requesterName: this.resolveRequesterName(ret),
          items: mapRequestItems(ret.requestItems),
          requestId: ret.id
        }],
        permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
        departmentIds: (!isAdmin && userDepartmentId != null) ? [userDepartmentId] : undefined,
        returnRequestId: ret.id,
        isMyTurn: ret.isMyTurn
      };
      this.allCards.push(card);
    });
  }

  /**
   * Process and create cards for discard requests
   */
  private processDiscardRequests(discards: DiscardDto[], isAdmin: boolean, userDepartmentId?: number | null): void {
    discards.forEach(discard => {
      const cardStatus = mapRequestStatusToCardStatus(discard.status);
      const card: InventoryDashboardCard = {
        title: getRequestTitle(discard),
        status: cardStatus,
        orders: [{
          orderId: getRequestTitle(discard),
          requestDate: (discard as any).creationDate ? (typeof (discard as any).creationDate === 'string' ? (discard as any).creationDate : (discard as any).creationDate.toISOString()) : '',
          departmentName: this.resolveDiscardDepartmentName(discard),
          requesterName: this.resolveRequesterName(discard),
          items: mapRequestItems(discard.requestItems),
          requestId: discard.id
        }],
        permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
        departmentIds: (!isAdmin && userDepartmentId != null) ? [userDepartmentId] : undefined,
        discardRequestId: discard.id,
        isMyTurn: discard.isMyTurn
      };
      this.allCards.push(card);
    });
  }

  /**
   * Format return request date
   */
  private formatReturnDate(ret: ReturnDto): string {
    // Use creationDate from BaseRequestDto
    const date = (ret as any).creationDate;
    return date ? this.formatDate(date) : 'N/A';
  }

  /**
   * Format discard request date
   */
  private formatDiscardDate(discard: DiscardDto): string {
    // Use creationDate from BaseRequestDto
    const date = (discard as any).creationDate;
    return date ? this.formatDate(date) : 'N/A';
  }


  // Legacy individual load methods are removed as we use parallel loading now

  private calculateStatistics(inventories: any[], orders: OrderDto[], summary: ItemInventorySummaryDto[], expiringLotsCount: number = 0, lowStockCount: number = 0): void {
    const stats: StatisticsData = {
      totalItems: 0,
      totalQuantity: 0,
      lowStock: lowStockCount, // Use API value instead of calculating locally
      expiringSoon: expiringLotsCount,
      monthlyActivity: Array(12).fill(0),
      monthlyActivityPercentages: Array(12).fill(0)
    };

    const now = new Date();
    const currentYear = now.getFullYear();

    // Process Summary for Totals only (low stock comes from API)
    if (summary && summary.length > 0) {
      stats.totalItems = summary.filter(x => x.remainingQuantity > 0).length;
      stats.totalQuantity = summary.reduce((sum, item) => sum + (item.remainingQuantity || 0), 0);
    }



    // Calculate monthly activity for current year only (not accumulating)
    // This shows distribution of orders across months in the current year
    const monthlyCounts = Array(12).fill(0);
    orders.forEach((order: OrderDto) => {
      if (order.usageDateFrom) {
        const orderDate = new Date(order.usageDateFrom);
        // Only count orders from current year
        if (orderDate.getFullYear() === currentYear && !isNaN(orderDate.getTime())) {
          const month = orderDate.getMonth();
          if (month >= 0 && month < 12) {
            monthlyCounts[month]++;
          }
        }
      }
    });

    stats.monthlyActivity = monthlyCounts;

    // Calculate percentages (distribution across months)
    const totalOrders = monthlyCounts.reduce((sum, count) => sum + count, 0);
    if (totalOrders > 0) {
      stats.monthlyActivityPercentages = monthlyCounts.map(count =>
        Math.round((count / totalOrders) * 100)
      );
    } else {
      stats.monthlyActivityPercentages = Array(12).fill(0);
    }

    this.statistics = stats;
  }

  // Modal handlers
  onViewOrderDetails(orderRequestId: number): void {
    const orderRequest = this.orderRequestsMap.get(orderRequestId);

    // Try to fetch fresh data
    this.orderService.getOrderById(orderRequestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          this.selectedRequest = order as UnifiedRequestDto;
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        },
        error: () => {
          // Fallback to cached
          this.selectedRequest = (orderRequest || null) as UnifiedRequestDto;
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  onViewReturnDetails(returnRequestId: number): void {
    const returnRequest = this.returnRequestsMap.get(returnRequestId);

    this.returnService.getReturnById(returnRequestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ret: ReturnDto) => {
          this.selectedRequest = ret as UnifiedRequestDto;
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.selectedRequest = (returnRequest || null) as UnifiedRequestDto;
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  onViewDiscardDetails(discardRequestId: number): void {
    const discardRequest = this.discardRequestsMap.get(discardRequestId);

    this.discardService.getDiscardById(discardRequestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: DiscardDto) => {
          this.selectedRequest = res as UnifiedRequestDto;
          this.isRequestModalOpen = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.selectedRequest = (discardRequest || null) as UnifiedRequestDto;
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

  // Formatting helpers
  formatOrderDate(order: OrderDto): string {
    if (!order.usageDateFrom) return 'N/A';

    const fromDate = this.formatDate(order.usageDateFrom);
    const toDate = order.usageDateTo ? this.formatDate(order.usageDateTo) : '';

    return toDate ? `${fromDate} - ${toDate}` : fromDate;
  }

  /**
   * Format creation date for display
   */
  formatCreationDate(order: OrderDto | any): string {
    const creationDate = order.creationDate || order.requestDate;
    if (!creationDate) return 'N/A';
    return this.formatApprovalDateTime(creationDate);
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

  private formatDate(source?: string | Date): string {
    if (!source) return 'N/A';
    try {
      const date = source instanceof Date ? source : new Date(source);
      if (isNaN(date.getTime())) return 'N/A';

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    } catch {
      return 'N/A';
    }
  }

  resolveOrderDepartmentName(order: OrderDto): string {
    if (!order) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    // Use nested department object if available (for proper localization)
    if (order.department) {
      const localized = getLocalizedName(order.department, currentLang);
      if (localized) return localized;
    }
    // Fallback to flattened properties
    if (order.departmentNameEn || order.departmentNameAr) {
      const localized = getLocalizedName(
        {
          nameEn: order.departmentNameEn,
          nameAr: order.departmentNameAr
        },
        currentLang
      );
      if (localized) return localized;
    }
    return 'N/A';
  }

  /**
   * Resolve requester name with localization
   * Works for OrderDto, ReturnDto, and DiscardDto
   */
  resolveRequesterName(request: OrderDto | ReturnDto | DiscardDto | any): string {
    if (!request) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    // Use nested requester object if available (for proper localization)
    if (request.requester) {
      const localized = getLocalizedName(request.requester, currentLang);
      if (localized) return localized;
      if (request.requester.userName) return request.requester.userName;
    }
    // Fallback to flattened property (for OrderDto compatibility)
    if (request.requesterName) return request.requesterName;
    return 'N/A';
  }

  /**
   * Resolve return department name with localization
   */
  resolveReturnDepartmentName(ret: ReturnDto): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(
      ret.department,
      currentLang
    ) || 'N/A';
  }

  /**
   * Resolve discard department name with localization
   */
  resolveDiscardDepartmentName(discard: DiscardDto): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(
      discard.department,
      currentLang
    ) || 'N/A';
  }

  resolveRequestPurpose(order: OrderDto | null): string {
    if (!order) return 'N/A';
    const currentLang = getCurrentLang(this.translate);

    // Try nested object first (current backend structure)
    if (order.requestPurpose) {
      return getLocalizedName(
        {
          nameEn: order.requestPurpose.nameEn,
          nameAr: order.requestPurpose.nameAr
        },
        currentLang
      ) || 'N/A';
    }

    // Fallback to flattened properties (if they exist)
    return getLocalizedName(
      {
        nameEn: order.requestPurposeNameEn,
        nameAr: order.requestPurposeNameAr
      },
      currentLang
    ) || 'N/A';
  }

  resolveDepotName(order: OrderDto | null): string {
    if (!order) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(
      {
        nameEn: order.depotNameEn,
        nameAr: order.depotNameAr
      },
      currentLang
    ) || 'N/A';
  }

  /**
   * Get translation key for order priority
   * Handles both number and string priority values
   */
  getOrderPriorityKey(priority?: number | string | null): string {
    if (priority === null || priority === undefined) {
      return 'dashboard.priorityLabels.urgent';
    }

    // Normalize to number
    let priorityNum: number;
    if (typeof priority === 'string') {
      const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
      if (priorityLower === 'normal' || priorityLower === '1') {
        priorityNum = 1;
      } else if (priorityLower === 'urgent' || priorityLower === '2') {
        priorityNum = 2;
      } else if (priorityLower === 'veryurgent' || priorityLower === '3') {
        priorityNum = 3;
      } else if (priorityLower === 'critical' || priorityLower === '4') {
        priorityNum = 4;
      } else {
        const parsed = parseInt(priority, 10);
        priorityNum = isNaN(parsed) ? 2 : parsed;
      }
    } else {
      priorityNum = priority;
    }

    switch (priorityNum) {
      case 1: return 'dashboard.priorityLabels.normal';
      case 2: return 'dashboard.priorityLabels.urgent';
      case 3: return 'dashboard.priorityLabels.veryUrgent';
      case 4: return 'dashboard.priorityLabels.critical';
      default: return 'dashboard.priorityLabels.urgent';
    }
  }

  /**
   * Get translation key for order status
   * Handles both number and string status values
   */
  getOrderStatusKey(status?: number | string | null): string {
    return getRequestStatusTranslationKey(status);
  }

  getOrderAllowanceKey(isFromAllowance?: boolean | null): string {
    return isFromAllowance ? 'common.yes' : 'common.no';
  }

  hasOrderItems(items?: OrderRequestItemDto[] | null): boolean {
    return !!items && items.length > 0;
  }

  /**
   * Format order usage time to military format (HHMM)
   * Uses centralized formatTimeToMilitary function for consistency
   */
  formatOrderUsageTime(order: OrderDto | null): string {
    if (!order) return 'N/A';

    const fromTime = formatTimeToMilitary(order.usageTimeFrom);
    const toTime = formatTimeToMilitary(order.usageTimeTo);

    if (!fromTime) return 'N/A';
    return toTime ? `${fromTime} - ${toTime}` : fromTime;
  }

  /**
   * Format order usage date and time together
   * Combines usage date range with usage time range in one line
   * Format: "From Date (From Time) - To Date (To Time)"
   * Uses centralized formatTimeToMilitary function for consistency
   */
  formatOrderUsageDateAndTime(order: OrderDto | null): string {
    if (!order) return 'N/A';

    const fromDate = order.usageDateFrom ? this.formatDate(order.usageDateFrom) : null;
    const toDate = order.usageDateTo ? this.formatDate(order.usageDateTo) : null;

    const fromTime = formatTimeToMilitary(order.usageTimeFrom);
    const toTime = formatTimeToMilitary(order.usageTimeTo);

    // Build the combined string
    let result = '';

    if (fromDate) {
      result = fromTime ? `${fromDate} (${fromTime})` : fromDate;
    }

    if (toDate) {
      const toPart = toTime ? `${toDate} (${toTime})` : toDate;
      if (result) {
        result = `${result} - ${toPart}`;
      } else {
        result = toPart;
      }
    }

    return result || 'N/A';
  }

  /**
   * Format usage date from with time
   */
  formatOrderUsageDateFrom(order: OrderDto | null): string {
    if (!order || !order.usageDateFrom) return 'N/A';

    const fromDate = this.formatDate(order.usageDateFrom);
    const timeRange = this.formatOrderUsageTime(order);

    // Extract just the "from" time (before the dash)
    let timePart = 'N/A';
    if (timeRange !== 'N/A' && timeRange.includes(' - ')) {
      timePart = timeRange.split(' - ')[0];
    } else if (timeRange !== 'N/A') {
      timePart = timeRange;
    }

    return timePart !== 'N/A' ? `${fromDate} (${timePart})` : fromDate;
  }

  /**
   * Format usage date to with time
   */
  formatOrderUsageDateTo(order: OrderDto | null): string {
    if (!order || !order.usageDateTo) return 'N/A';

    const toDate = this.formatDate(order.usageDateTo);
    const timeRange = this.formatOrderUsageTime(order);

    // Extract just the "to" time (after the dash)
    let timePart = 'N/A';
    if (timeRange !== 'N/A' && timeRange.includes(' - ')) {
      timePart = timeRange.split(' - ')[1];
    } else if (timeRange !== 'N/A' && !order.usageTimeFrom) {
      // If there's only one time and no from time, it might be the to time
      timePart = timeRange;
    }

    return timePart !== 'N/A' ? `${toDate} (${timePart})` : toDate;
  }

  // Statistics getters
  get annualActivityValues(): number[] {
    // Return actual counts for the chart (can be switched to percentages if needed)
    return this.statistics.monthlyActivity;
  }

  onExpiringSoonClick(): void {
    this.router.navigate(['/inventory-dashboard/expiring-lots']);
  }

  onLowStockClick(): void {
    this.router.navigate(['/inventory-dashboard/low-stock']);
  }
}

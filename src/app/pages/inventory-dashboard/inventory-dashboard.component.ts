import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, filter, map } from 'rxjs/operators';
import { LucideAngularModule, X, ShieldAlert, RefreshCw, Grid, List, Eye, Search } from 'lucide-angular';
import { StatusCardComponent, OrderItem, ReturnItem } from '@pages/dashboard/components/status-card/status-card.component';
import { ReturnDetailsModalComponent } from '@pages/dashboard/components/return-details-modal/return-details-modal.component';
import { DiscardDetailsModalComponent } from '@pages/dashboard/components/discard-details-modal/discard-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';
import { NotificationService } from '@services/notification.service';
import { InventoryService } from '@services/inventory.service';
import { UserContextService } from '@services/user-context.service';
import { UnifiedRequestService } from '@services/unified-request.service';
import { OverstockCardComponent, OverstockItemView } from '@pages/dashboard/components/overstock-card/overstock-card.component';
import { AnnualActivityCardComponent } from '@pages/dashboard/components/annual-activity-card/annual-activity-card.component';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { ErrorHandlingService } from '@services/error-handling.service';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { InventoryDashboardCard, StatisticsData } from '@models/inventory-dashboard.model';
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

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    StatusCardComponent,
    ReturnDetailsModalComponent,
    DiscardDetailsModalComponent,
    OverstockCardComponent,
    AnnualActivityCardComponent,
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent
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

  // Status filter
  selectedStatusFilter: CardStatus | 'all' = 'all';
  readonly statusFilterOptions: DropdownOption<CardStatus | 'all'>[] = [
    { label: 'dashboard.filters.all', value: 'all' },
    { label: 'dashboard.statusLabels.new', value: 'new' },
    { label: 'dashboard.statusLabels.underProcess', value: 'on-progress' },
    { label: 'dashboard.statusLabels.approved', value: 'completed' },
    { label: 'dashboard.statusLabels.rejected', value: 'declined' }
  ];

  // Modal state
  isOrderModalOpen = false;
  isReturnModalOpen = false;
  isDiscardModalOpen = false;
  selectedOrderRequest: OrderDto | null = null;
  selectedReturnRequest: ReturnDto | null = null;
  selectedDiscardRequest: DiscardDto | null = null;
  private readonly orderRequestsMap = new Map<number, OrderDto>();
  private readonly returnRequestsMap = new Map<number, ReturnDto>();
  private readonly discardRequestsMap = new Map<number, DiscardDto>();

  // Statistics
  statistics: StatisticsData = {
    totalItems: 0,
    totalQuantity: 0,
    expiringSoon: 0,
    lowStock: 0,
    overstockItems: [],
    monthlyActivity: Array(12).fill(0),
    monthlyActivityPercentages: Array(12).fill(0)
  };

  // Icons
  readonly XIcon = X;
  readonly ShieldAlert = ShieldAlert;
  readonly RefreshCw = RefreshCw;
  readonly Grid = Grid;
  readonly List = List;
  readonly Eye = Eye;
  readonly Search = Search;

  showContactAdminNotice = false;

  // Search functionality
  searchQuery: string = '';

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
    private readonly requestStatusUpdateService: RequestStatusUpdateService
  ) { }

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAll();
      });

    this.requestStatusUpdateService.onRequestStatusUpdated$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadAll();
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        filter(() => this.router.url === '/inventory-dashboard' || this.router.url.startsWith('/inventory-dashboard')),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadAll();
      });

    // Subscribe to language changes to update all localized content
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAll();
      });

    this.loadAll();

    // Auto-refresh periodically
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

    combineLatest({
      requests: requests$,
      inventories: inventories$
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ requests, inventories }) => {
          // Transform BaseRequestDto to specific types
          const orders = requests.orders.map(o => mapToOrderDto(o));
          const returns = requests.returns.map(r => mapToReturnDto(r));
          const discards = requests.discards.map(d => mapToDiscardDto(d));

          // Process cards
          this.allCards = []; // Reset cards before rebuilding
          this.processRequestData(orders, returns, discards);

          // Process statistics
          this.calculateStatistics(inventories, orders);

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
      filtered = filtered.filter(card => card.status === this.selectedStatusFilter);
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

  onStatusFilterChange(): void {
    this.filterCards();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
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

  readonly statusFilterLabelFn = (option: DropdownOption<CardStatus | 'all'> | CardStatus | 'all'): string => {
    if (typeof option === 'object' && option !== null && 'label' in option) {
      return this.translate.instant(option.label as string);
    }
    return '';
  };

  shouldShowCard(card: InventoryDashboardCard): boolean {
    return this.paginatedCards.includes(card);
  }

  // Helper methods for table view
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'new-issue':
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'on-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
          requestDate: this.formatCreationDate(order),
          departmentName: this.resolveOrderDepartmentName(order),
          requesterName: this.resolveRequesterName(order),
          items: mapRequestItems(order.requestItems),
          requestId: order.id
        }],
        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
        departmentIds: (!isAdmin && userDepartmentId != null) ? [userDepartmentId] : undefined,
        orderRequestId: order.id
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
          requestDate: this.formatReturnDate(ret),
          departmentName: this.resolveReturnDepartmentName(ret),
          requesterName: this.resolveRequesterName(ret),
          items: mapRequestItems(ret.requestItems),
          requestId: ret.id
        }],
        permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
        departmentIds: (!isAdmin && userDepartmentId != null) ? [userDepartmentId] : undefined,
        returnRequestId: ret.id
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
          requestDate: this.formatDiscardDate(discard),
          departmentName: this.resolveDiscardDepartmentName(discard),
          requesterName: this.resolveRequesterName(discard),
          items: mapRequestItems(discard.requestItems),
          requestId: discard.id
        }],
        permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
        departmentIds: (!isAdmin && userDepartmentId != null) ? [userDepartmentId] : undefined,
        discardRequestId: discard.id
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

  private calculateStatistics(inventories: any[], orders: OrderDto[]): void {
    const stats: StatisticsData = {
      totalItems: 0,
      totalQuantity: 0,
      expiringSoon: 0,
      lowStock: 0,
      overstockItems: [],
      monthlyActivity: Array(12).fill(0),
      monthlyActivityPercentages: Array(12).fill(0)
    };

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentYear = now.getFullYear();
    const overstockThreshold = 10000; // Adjust based on business rules
    const lowStockThreshold = 100; // Items below this are considered low stock

    // Process inventories
    const itemMap = new Map<number, { quantity: number; expiryDate?: Date; name: string; hasExpiringLot: boolean; hasLowStockLot: boolean }>();

    (inventories || []).forEach((inv: any) => {
      const details = inv.inventoryDetails || [];
      details.forEach((d: any) => {
        const quantity = Number(d.originalQuantity ?? d.currentQuantity ?? 0);
        const itemId = d.itemId;
        const itemName = d.item ? (getLocalizedName(d.item, getCurrentLang(this.translate)) || d.item.itemNo || 'Item') : 'Item';

        if (quantity > 0) {
          stats.totalQuantity += quantity;

          const expDate = d.item?.expiryDate ? new Date(d.item.expiryDate) : null;
          const isExpiring = expDate && expDate <= thirtyDaysFromNow && expDate > now;
          const isLowStock = quantity < lowStockThreshold;

          // Track for overstock calculation and unique item counting
          const existing = itemMap.get(itemId);
          if (existing) {
            existing.quantity += quantity;
            if (isExpiring) existing.hasExpiringLot = true;
            if (isLowStock) existing.hasLowStockLot = true;
          } else {
            itemMap.set(itemId, {
              quantity,
              expiryDate: expDate && !isNaN(expDate.getTime()) ? expDate : undefined,
              name: itemName,
              hasExpiringLot: isExpiring || false,
              hasLowStockLot: isLowStock || false
            });
          }
        }
      });
    });

    // Count unique items and calculate statistics
    stats.totalItems = itemMap.size;
    itemMap.forEach(item => {
      if (item.hasExpiringLot) stats.expiringSoon++;
      if (item.hasLowStockLot) stats.lowStock++;
    });

    // Calculate overstock items (top items by quantity)
    const overstockItems: OverstockItemView[] = Array.from(itemMap.values())
      .map(item => {
        const percentage = Math.min(100, Math.round((item.quantity / overstockThreshold) * 100));
        return {
          name: item.name,
          lot: 'N/A',
          percentage,
          expiryDate: item.expiryDate
            ? `${item.expiryDate.getDate()} ${item.expiryDate.toLocaleString('en', { month: 'short' })} ${item.expiryDate.getFullYear()}`
            : undefined,
          imageUrl: 'assets/Ammunition.png' // Default, can be enhanced
        };
      })
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);

    stats.overstockItems = overstockItems;

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
          this.selectedOrderRequest = order;
          this.isOrderModalOpen = true;
          this.cdr.markForCheck();
        },
        error: () => {
          // Fallback to cached
          this.selectedOrderRequest = orderRequest || null;
          this.isOrderModalOpen = true;
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
          this.selectedReturnRequest = ret;
          this.isReturnModalOpen = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.selectedReturnRequest = returnRequest || null;
          this.isReturnModalOpen = true;
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
          this.selectedDiscardRequest = res;
          this.isDiscardModalOpen = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.selectedDiscardRequest = discardRequest || null;
          this.isDiscardModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  closeOrderModal(): void {
    this.isOrderModalOpen = false;
    this.selectedOrderRequest = null;
    this.cdr.markForCheck();
  }

  closeReturnModal(): void {
    this.isReturnModalOpen = false;
    this.selectedReturnRequest = null;
    this.cdr.markForCheck();
  }

  closeDiscardModal(): void {
    this.isDiscardModalOpen = false;
    this.selectedDiscardRequest = null;
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
    const creationDate = order.creationDate;
    if (!creationDate) return 'N/A';
    return this.formatDate(creationDate);
  }

  private formatDate(source?: string | Date): string {
    let date: Date;
    if (source instanceof Date) {
      date = source;
    } else if (typeof source === 'string') {
      const parsed = new Date(source);
      date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      date = new Date();
    }
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
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
      return 'dashboard.priorityLabels.high';
    }

    // Normalize to number
    let priorityNum: number;
    if (typeof priority === 'string') {
      const priorityLower = priority.toLowerCase().trim();
      if (priorityLower === 'high' || priorityLower === '1') {
        priorityNum = 1;
      } else if (priorityLower === 'medium' || priorityLower === '2') {
        priorityNum = 2;
      } else if (priorityLower === 'low' || priorityLower === '3') {
        priorityNum = 3;
      } else if (priorityLower === 'critical' || priorityLower === '4') {
        priorityNum = 4;
      } else {
        const parsed = parseInt(priority, 10);
        priorityNum = isNaN(parsed) ? 1 : parsed;
      }
    } else {
      priorityNum = priority;
    }

    switch (priorityNum) {
      case 2: return 'dashboard.priorityLabels.medium';
      case 3: return 'dashboard.priorityLabels.low';
      default: return 'dashboard.priorityLabels.high';
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

  formatOrderUsageTime(order: OrderDto | null): string {
    if (!order) return 'N/A';

    // Handle military format (HHMM) and legacy format (HH:mm)
    const formatTime = (timeStr: string | null | undefined): string => {
      if (!timeStr) return '';
      // Military format (HHMM - 4 digits)
      if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        return timeStr;
      }
      // Legacy format (HH:mm) - convert to military
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
        return hours + minutes;
      }
      return timeStr;
    };

    const fromTime = formatTime(order.usageTimeFrom);
    const toTime = formatTime(order.usageTimeTo);

    if (!fromTime) return 'N/A';
    return toTime ? `${fromTime} - ${toTime}` : fromTime;
  }

  /**
   * Format order usage date and time together
   * Combines usage date range with usage time range in one line
   * Format: "From Date (From Time) - To Date (To Time)"
   */
  formatOrderUsageDateAndTime(order: OrderDto | null): string {
    if (!order) return 'N/A';

    const fromDate = order.usageDateFrom ? this.formatDate(order.usageDateFrom) : null;
    const toDate = order.usageDateTo ? this.formatDate(order.usageDateTo) : null;

    // Format time helper
    const formatTime = (timeStr: string | null | undefined): string => {
      if (!timeStr) return '';
      // Military format (HHMM - 4 digits) - already in correct format
      if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        return timeStr;
      }
      // Backend TimeOnly format (HH:mm:ss or HH:mm) - convert to military
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
        return hours + minutes;
      }
      return timeStr;
    };

    const fromTime = formatTime(order.usageTimeFrom);
    const toTime = formatTime(order.usageTimeTo);

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

  get overstockItems(): OverstockItemView[] {
    return this.statistics.overstockItems;
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { LucideAngularModule, X, ShieldAlert, RefreshCw } from 'lucide-angular';
import { StatusCardComponent, OrderItem, ReturnItem } from '@pages/dashboard/components/status-card/status-card.component';
import { ReturnDetailsModalComponent } from '@pages/dashboard/components/return-details-modal/return-details-modal.component';
import { DiscardDetailsModalComponent } from '@pages/dashboard/components/discard-details-modal/discard-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';
import { NotificationService } from '@services/notification.service';
import { InventoryService } from '@services/inventory.service';
import { UserContextService } from '@services/user-context.service';
import { OverstockCardComponent, OverstockItemView } from '@pages/dashboard/components/overstock-card/overstock-card.component';
import { AnnualActivityCardComponent } from '@pages/dashboard/components/annual-activity-card/annual-activity-card.component';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
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

interface DashboardCard {
  title: string;
  status: 'new-issue' | 'on-progress' | 'completed' | 'new';
  orders: OrderItem[];
  permissions: string[];
  departmentIds?: number[];
  orderRequestId?: number;
  returnRequestId?: number;
  discardRequestId?: number;
}

interface StatisticsData {
  totalItems: number;
  totalQuantity: number;
  expiringSoon: number; // Items expiring in next 30 days
  lowStock: number; // Items below threshold
  overstockItems: OverstockItemView[];
  monthlyActivity: number[]; // Orders per month (current year only)
  monthlyActivityPercentages: number[]; // Percentage distribution
}

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
    DropdownComponent
  ],
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css']
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refreshTimer: any = null;

  // Dashboard cards
  allCards: DashboardCard[] = [];
  visibleCards: DashboardCard[] = [];

  // Status filter
  selectedStatusFilter: CardStatus | 'all' = 'all';
  statusFilterOptions: DropdownOption<CardStatus | 'all'>[] = [
    { label: 'dashboard.filters.all', value: 'all' },
    { label: 'dashboard.statusLabels.new', value: 'new' },
    { label: 'dashboard.statusLabels.underProcess', value: 'on-progress' },
    { label: 'dashboard.statusLabels.approved', value: 'completed' }
  ];

  // Modal state
  isOrderModalOpen = false;
  isReturnModalOpen = false;
  isDiscardModalOpen = false;
  selectedOrderRequest: OrderDto | null = null;
  selectedReturnRequest: ReturnDto | null = null;
  selectedDiscardRequest: DiscardDto | null = null;
  private orderRequestsMap = new Map<number, OrderDto>();
  private returnRequestsMap = new Map<number, ReturnDto>();
  private discardRequestsMap = new Map<number, DiscardDto>();

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

  readonly XIcon = X;
  readonly ShieldAlert = ShieldAlert;
  readonly RefreshCw = RefreshCw;
  showContactAdminNotice = false;

  constructor(
    private authService: BackendAuthService,
    private orderService: OrderService,
    private returnService: ReturnService,
    private discardService: DiscardService,
    private notificationService: NotificationService,
    private inventoryService: InventoryService,
    private userContext: UserContextService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.filterCards();
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

  private loadAll(): void {
    this.filterCards();
    this.loadOrderRequests();
    this.loadReturnRequests();
    this.loadDiscardRequests();
    this.loadStatistics();
    this.notificationService.refresh();
  }

  private filterCards(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = !!user?.permissions?.length;
    const userDeptId = user?.departmentId ?? null;
    const isAdmin = this.userContext.isAdminUser();

    if (!isAuthenticated) {
      this.visibleCards = [];
      return;
    }

    let filtered = this.allCards.filter(card => {
      if (!isAdmin && card.departmentIds && card.departmentIds.length > 0) {
        if (userDeptId == null) return false;
        if (!card.departmentIds.includes(userDeptId)) return false;
      }
      if (!card.permissions || card.permissions.length === 0) return true;
      if (!hasPermissionsLoaded) return false;
      return this.authService.hasAnyPermission(card.permissions);
    });

    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      filtered = filtered.filter(card => card.status === this.selectedStatusFilter);
    }

    // Sort by status priority
    const rank = (c: DashboardCard): number => {
      switch (c.status) {
        case 'new-issue': return 0;
        case 'new': return 0;
        case 'on-progress': return 1;
        case 'completed': return 2;
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

    const permissionsArray = Array.isArray(user?.permissions) ? user?.permissions : [];
    this.showContactAdminNotice = isAuthenticated && permissionsArray.length === 0 && this.visibleCards.length === 0;
  }

  onStatusFilterChange(): void {
    this.filterCards();
  }

  get filteredCardsCount(): number {
    return this.visibleCards.length;
  }

  statusFilterLabelFn = (option: DropdownOption<CardStatus | 'all'> | CardStatus | 'all'): string => {
    if (typeof option === 'object' && option !== null && 'label' in option) {
      return this.translate.instant(option.label as string);
    }
    return '';
  };

  // Generic method to process and add request cards
  private processRequestCards<T extends DisplayableRequest>(
    requests: T[],
    cardConfig: {
      status: CardStatus;
      permissions: string[];
      getCardId: (req: T) => number | undefined;
      getCardPredicate: (card: DashboardCard) => boolean;
      mapToCard: (req: T) => DashboardCard;
      storeInMap: (req: T) => void;
    }
  ): void {
    const currentUser = this.authService.getCurrentUser();
    const isAdmin = this.userContext.isAdminUser();
    const filtered = filterRequestsByDepartment(
      filterDisplayableRequests(requests),
      isAdmin ? null : currentUser?.departmentId
    );

    // Store in appropriate map
    filtered.forEach(req => cardConfig.storeInMap(req));

    // Create cards
    const cards = filtered.map(req => cardConfig.mapToCard(req));

    // Remove old cards and add new ones
    this.allCards = this.allCards.filter(card => !cardConfig.getCardPredicate(card));
    this.allCards.push(...cards);

    this.filterCards();
  }

  private loadOrderRequests(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) {
      return;
    }

    forkJoin({
      orders: this.orderService.getAllOrders(),
      returns: this.returnService.getAllReturns(),
      discards: this.discardService.getAllDiscards()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ orders, returns, discards }) => {
          const user = this.authService.getCurrentUser();
          const isAdmin = this.userContext.isAdminUser();

          // Process orders by status
          [1, 2, 3].forEach(status => {
            let orderList = orders.filter(o => o.status === status);
            let returnList = (returns || []).filter(r => r.status === status);
            let discardList = (discards || []).filter(d => d.status === status);

            if (!isAdmin && user?.departmentId) {
              orderList = orderList.filter(o => o.departmentId === user.departmentId);
              returnList = returnList.filter(r => r.departmentId === user.departmentId);
              discardList = discardList.filter(d => d.departmentId === user.departmentId);
            }

            // Store in maps
            orderList.forEach(o => this.orderRequestsMap.set(o.id, o));
            returnList.forEach(r => this.returnRequestsMap.set(r.id, r));
            discardList.forEach(d => this.discardRequestsMap.set(d.id, d));

            // Map to OrderItem format
            const ordersView: OrderItem[] = orderList.map(o => ({
              orderId: getRequestTitle(o, o.orderNo),
              requestDate: this.formatOrderDate(o),
              departmentName: this.resolveOrderDepartmentName(o),
              requesterName: o.requesterName || 'N/A',
              items: mapRequestItems(o.requestItems),
              requestId: o.id
            }));

            const returnsView: OrderItem[] = returnList.map(r => ({
              orderId: getRequestTitle(r),
              requestDate: this.formatDate((r as any).creationDate || (r as any).createdOn),
              departmentName: (r as any).departmentName || 'N/A',
              requesterName: r.requesterName || 'N/A',
              items: mapRequestItems(r.requestItems)
            }));

            const discardsView: OrderItem[] = discardList.map(d => ({
              orderId: getRequestTitle(d),
              requestDate: this.formatDate((d as any).creationDate || (d as any).createdOn),
              departmentName: (d as any).departmentName || 'N/A',
              requesterName: d.requesterName || 'N/A',
              items: mapRequestItems(d.requestItems)
            }));

            const merged: OrderItem[] = [...ordersView, ...returnsView, ...discardsView];
            
            if (merged.length > 0) {
              const cardStatus: CardStatus = status === 1 ? 'new' : status === 2 ? 'on-progress' : 'completed';
              const title = status === 1 ? 'New' : status === 2 ? 'Requests On Progress' : 'Done';
              
              const card: DashboardCard = {
                title,
                status: cardStatus,
                orders: merged,
                permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                orderRequestId: ordersView.length > 0 ? orderList[0].id : undefined,
                returnRequestId: returnsView.length > 0 ? returnList[0]?.id : undefined,
                discardRequestId: discardsView.length > 0 ? discardList[0]?.id : undefined
              };

              this.allCards = this.allCards.filter(c => 
                !(c.status === cardStatus && c.title === title)
              );
              this.allCards.push(card);
            }
          });

          this.filterCards();
        },
        error: () => {}
      });
  }

  private loadReturnRequests(): void {
    // Handled in loadOrderRequests via forkJoin
  }

  private loadDiscardRequests(): void {
    // Handled in loadOrderRequests via forkJoin
  }

  private loadStatistics(): void {
    forkJoin({
      inventories: this.inventoryService.getAll(),
      orders: this.orderService.getAllOrders()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ inventories, orders }) => {
          this.calculateStatistics(inventories, orders);
        },
        error: () => {
          // Reset statistics on error
          this.statistics = {
            totalItems: 0,
            totalQuantity: 0,
            expiringSoon: 0,
            lowStock: 0,
            overstockItems: [],
            monthlyActivity: Array(12).fill(0),
            monthlyActivityPercentages: Array(12).fill(0)
          };
        }
      });
  }

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
        const quantity = Number(d.itemQuantity ?? d.currentQuantity ?? 0);
        const itemId = d.itemId;
        const itemName = d.item?.name || d.item?.itemNo || 'Item';
        
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
      if (order.usageDate) {
        const orderDate = new Date(order.usageDate);
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
    if (orderRequest) {
      this.orderService.getOrderById(orderRequestId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (order) => {
            this.selectedOrderRequest = order;
            this.isOrderModalOpen = true;
          },
          error: () => {
            this.selectedOrderRequest = this.orderRequestsMap.get(orderRequestId) || null;
            this.isOrderModalOpen = true;
          }
        });
    }
  }

  onViewReturnDetails(returnRequestId: number): void {
    const returnRequest = this.returnRequestsMap.get(returnRequestId);
    if (returnRequest) {
      this.returnService.getReturnById(returnRequestId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (ret: ReturnDto) => {
            this.selectedReturnRequest = ret;
            this.isReturnModalOpen = true;
          },
          error: () => {
            this.selectedReturnRequest = this.returnRequestsMap.get(returnRequestId) || null;
            this.isReturnModalOpen = true;
          }
        });
    }
  }

  onViewDiscardDetails(discardRequestId: number): void {
    const discardRequest = this.discardRequestsMap.get(discardRequestId);
    if (discardRequest) {
      this.discardService.getDiscardById(discardRequestId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: DiscardDto) => {
            this.selectedDiscardRequest = res;
            this.isDiscardModalOpen = true;
          },
          error: () => {
            this.selectedDiscardRequest = this.discardRequestsMap.get(discardRequestId) || null;
            this.isDiscardModalOpen = true;
          }
        });
    }
  }

  closeOrderModal(): void {
    this.isOrderModalOpen = false;
    this.selectedOrderRequest = null;
  }

  closeReturnModal(): void {
    this.isReturnModalOpen = false;
    this.selectedReturnRequest = null;
  }

  closeDiscardModal(): void {
    this.isDiscardModalOpen = false;
    this.selectedDiscardRequest = null;
  }

  // Formatting helpers
  formatOrderDate(order: OrderDto): string {
    return this.formatDate(order.usageDate);
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
    return (order as any).departmentNameEn || (order as any).departmentNameAr || 'N/A';
  }

  resolveRequestPurpose(order: OrderDto | null): string {
    if (!order) return 'N/A';
    return (order as any).requestPurposeNameEn || (order as any).requestPurposeNameAr || 'N/A';
  }

  resolveDepotName(order: OrderDto | null): string {
    if (!order) return 'N/A';
    return (order as any).depotNameEn || (order as any).depotNameAr || 'N/A';
  }

  getOrderPriorityKey(priority?: number | null): string {
    switch (priority) {
      case 2: return 'dashboard.priorityLabels.medium';
      case 3: return 'dashboard.priorityLabels.low';
      default: return 'dashboard.priorityLabels.high';
    }
  }

  getOrderStatusKey(status?: number | null): string {
    return getRequestStatusTranslationKey(status);
  }

  getOrderAllowanceKey(isFromAllowance?: boolean | null): string {
    return isFromAllowance ? 'common.yes' : 'common.no';
  }

  hasOrderItems(items?: OrderRequestItemDto[] | null): boolean {
    return !!items && items.length > 0;
  }

  formatOrderUsageTime(order: OrderDto | null): string {
    if (!order?.usageTime) return 'N/A';
    return order.usageTime.length >= 5 ? order.usageTime.substring(0, 5) : order.usageTime;
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

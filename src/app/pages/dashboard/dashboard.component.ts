import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, X, ShieldAlert } from 'lucide-angular';
import { StatusCardComponent, OrderItem, ReturnItem } from './components/status-card/status-card.component';
import { ReturnDetailsModalComponent } from './components/return-details-modal/return-details-modal.component';
import { DiscardDetailsModalComponent } from './components/discard-details-modal/discard-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';

export interface DashboardCard {
  title: string;
  status: 'new-issue' | 'on-progress' | 'completed' | 'new';
  orders: OrderItem[];
  permissions: string[]; 
  roles?: string[]; 
  orderRequestId?: number;
  returnRequestId?: number; 
  discardRequestId?: number; 
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, StatusCardComponent, ReturnDetailsModalComponent, DiscardDetailsModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // All dashboard cards with their permission/role requirements
  private allCards: DashboardCard[] = [];

  // Filtered cards based on user permissions and roles
  visibleCards: DashboardCard[] = [];

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

  readonly XIcon = X;
  readonly ShieldAlert = ShieldAlert;
  showContactAdminNotice = false;

  constructor(
    private authService: BackendAuthService,
    private orderService: OrderService,
    private returnService: ReturnService,
    private discardService: DiscardService
  ) {}

  ngOnInit(): void {
    // Subscribe to user changes and filter cards
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.filterCardsByPermissionsAndRoles();
        this.loadOrderRequests();
        this.loadReturnRequests();
        this.loadDiscardRequests();
      });

    // Initial filter
    this.filterCardsByPermissionsAndRoles();
    this.loadOrderRequests();
    this.loadReturnRequests();
    this.loadDiscardRequests();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private filterCardsByPermissionsAndRoles(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = user && user.permissions && user.permissions.length > 0;
    const userRoles = user?.roles || [];

    // If not authenticated, show no cards
    if (!isAuthenticated) {
      this.visibleCards = [];
      return;
    }

    // Filter cards based on permissions and roles
    this.visibleCards = this.allCards.filter(card => {
      if (card.roles && card.roles.length > 0) {
        const hasRequiredRole = card.roles.some(requiredRole =>
          userRoles.some(userRole => 
            userRole.toLowerCase() === requiredRole.toLowerCase()
          )
        );
        if (hasRequiredRole) {
          return true;
        }
      }

      if (!card.permissions || card.permissions.length === 0) {
        return !card.roles || card.roles.length === 0;
      }

      if (!hasPermissionsLoaded) {
        return false;
      }

      return this.authService.hasAnyPermission(card.permissions);
    });

    const permissionsArray = Array.isArray(user?.permissions) ? user?.permissions : [];
    this.showContactAdminNotice = isAuthenticated && permissionsArray.length === 0 && this.visibleCards.length === 0;
  }

  shouldShowCard(card: DashboardCard): boolean {
    return this.visibleCards.includes(card);
  }

  private loadOrderRequests(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) {
      return;
    }

    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          let newOrders = orders.filter(order => order.status === 1);
          const currentUser = this.authService.getCurrentUser();
          const isAdmin = this.userContext.isAdminUser();
          if (!isAdmin && currentUser?.departmentId) {
            newOrders = newOrders.filter(order => order.departmentId === currentUser.departmentId);
          }

          this.orderRequestsMap = new Map(newOrders.map(order => [order.id, order]));

          const orderCards = newOrders.map(order => ({
            title: order.requestNo || order.orderNo || `#${order.id}`,
            status: 'new-issue' as const,
            orders: [{
              orderId: order.requestNo || order.orderNo || `#${order.id}`,
              requestDate: this.formatOrderDate(order),
              departmentName: this.resolveOrderDepartmentName(order),
              requesterName: order.requesterName || 'N/A',
              items: this.mapOrderItems(order.requestItems)
            }],
            permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
            orderRequestId: order.id
          }));

          // Also include Return requests with status = 1
          this.returnService.getAllReturns()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (returns: ReturnDto[]) => {
                let returnList = (returns || []).filter(r => r.status === 1);
                if (!isAdmin && currentUser?.departmentId) {
                  returnList = returnList.filter(r => r.departmentId === currentUser.departmentId);
                }
                this.returnRequestsMap = new Map(returnList.map(r => [r.id, r]));
                
                const returnsView: OrderItem[] = returnList.map(r => ({
                  orderId: r.requestNo || `#${r.id}`,
                  requestDate: this.formatRequestDate(r),
                  departmentName: (r as any).departmentName || 'N/A',
                  requesterName: r.requesterName || 'N/A',
                  items: (r.requestItems || []).map((it: any) => ({
                    itemName: it.itemName || it.itemNo || 'N/A',
                    itemNo: it.itemNo || 'N/A',
                    quantity: Number(it.quantity ?? 0),
                    notes: it.notes || undefined
                  }))
                }));

                // Also include Discard requests with status = 1
                this.discardService.getAllDiscards()
                  .pipe(takeUntil(this.destroy$))
                  .subscribe({
                    next: (discards: DiscardDto[]) => {
                      let discardList = (discards || []).filter(d => d.status === 1);
                      if (!isAdmin && currentUser?.departmentId) {
                        discardList = discardList.filter(d => d.departmentId === currentUser.departmentId);
                      }
                      this.discardRequestsMap = new Map(discardList.map(d => [d.id, d]));
                      
                      const discardView: OrderItem[] = discardList.map(d => ({
                        orderId: d.requestNo || `#${d.id}`,
                        requestDate: this.formatRequestDate(d),
                        departmentName: (d as any).departmentName || 'N/A',
                        requesterName: d.requesterName || 'N/A',
                        items: (d.requestItems || []).map((it: any) => ({
                          itemName: it.itemName || it.itemNo || 'N/A',
                          itemNo: it.itemNo || 'N/A',
                          quantity: Number(it.quantity ?? 0),
                          notes: it.notes || undefined
                        }))
                      }));

                      const merged: OrderItem[] = [...ordersView, ...returnsView, ...discardView];
                      const card: DashboardCard = {
                        title: 'New',
                        status: 'new-issue',
                        orders: merged,
                        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                        departmentIds: (!isAdmin && currentUser?.departmentId != null) ? [currentUser.departmentId] : undefined,
                        returnRequestId: (ordersView.length === 0 && returnList.length > 0) ? returnList[0].id : undefined,
                        discardRequestId: (ordersView.length === 0 && returnsView.length === 0 && discardList.length > 0) ? discardList[0].id : undefined
                      };
                      
                      this.allCards = this.allCards.filter(c => c.status !== 'new-issue');
                      this.allCards.push(card);
                      this.filterCardsByPermissionsAndRoles();
                    },
                    error: () => {
                      // Fallback to orders + returns if discards fail
                      const merged: OrderItem[] = [...ordersView, ...returnsView];
                      const card: DashboardCard = {
                        title: 'New',
                        status: 'new-issue',
                        orders: merged,
                        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                        departmentIds: (!isAdmin && currentUser?.departmentId != null) ? [currentUser.departmentId] : undefined,
                        returnRequestId: (ordersView.length === 0 && returnList.length > 0) ? returnList[0].id : undefined
                      };
                      this.allCards = this.allCards.filter(c => c.status !== 'new-issue');
                      this.allCards.push(card);
                      this.filterCardsByPermissionsAndRoles();
                    }
                  });
              },
              error: () => {
                // Fallback to only orders if returns fail
                const card: DashboardCard = {
                  title: 'New',
                  status: 'new-issue',
                  orders: ordersView,
                  permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                  departmentIds: (!isAdmin && currentUser?.departmentId != null) ? [currentUser.departmentId] : undefined
                };
                this.allCards = this.allCards.filter(c => c.status !== 'new-issue');
                this.allCards.push(card);
                this.filterCardsByPermissionsAndRoles();
              }
            });
        },
        error: () => {
          // Silently fail - don't show error to user
        }
      });
  }

  private loadReturnRequests(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Return.View', 'Permissions.Return.Page'])) {
      return;
    }

    this.returnService.getAllReturns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (returns: ReturnDto[]) => {
          let newReturns = returns.filter(r => r.status === 1);
          const currentUser = this.authService.getCurrentUser();
          if (currentUser?.departmentId) {
            newReturns = newReturns.filter(r => r.departmentId === currentUser.departmentId);
          }

          this.returnRequestsMap = new Map(newReturns.map(r => [r.id, r]));

          const returnCards = newReturns.map(r => {
            const items: ReturnItem[] = (r.requestItems || []).map(item => ({
              itemName: item.itemName || 'Unknown',
              itemNo: item.itemNo || '',
              quantity: item.quantity,
              notes: item.notes || undefined
            }));

            return {
              title: r.requestNo || `#${r.id}`,
              status: 'new' as const,
              orders: [{
                orderId: r.requestNo || `#${r.id}`,
                requestDate: this.formatRequestDate(r),
                departmentName: r.departmentName || 'N/A',
                requesterName: r.requesterName || 'N/A',
                items: items
              }],
              permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
              returnRequestId: r.id
            };
          });

          this.allCards = this.allCards.filter(c => !c.returnRequestId);
          this.allCards.push(...returnCards);
          this.filterCardsByPermissionsAndRoles();
        },
        error: () => {}
      });
  }

  private loadDiscardRequests(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Discard.View', 'Permissions.Discard.Page'])) {
      return;
    }

    this.discardService.getAllDiscards()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (discards: DiscardDto[]) => {
          let newDiscards = discards.filter(d => d.status === 1);
          const currentUser = this.authService.getCurrentUser();
          if (currentUser?.departmentId) {
            newDiscards = newDiscards.filter(d => d.departmentId === currentUser.departmentId);
          }

          this.discardRequestsMap = new Map(newDiscards.map(d => [d.id, d]));

          const discardCards = newDiscards.map(d => {
            const items: ReturnItem[] = (d.requestItems || []).map(item => ({
              itemName: item.itemName || 'Unknown',
              itemNo: item.itemNo || '',
              quantity: item.quantity,
              notes: item.notes || undefined
            }));

            return {
              title: d.requestNo || `#${d.id}`,
              status: 'new' as const,
              orders: [{
                orderId: d.requestNo || `#${d.id}`,
                requestDate: this.formatRequestDate(d),
                departmentName: d.departmentName || 'N/A',
                requesterName: d.requesterName || 'N/A',
                items: items
              }],
              permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
              discardRequestId: d.id
            };
          });

          this.allCards = this.allCards.filter(c => !c.discardRequestId);
          this.allCards.push(...discardCards);
          this.filterCardsByPermissionsAndRoles();
        },
        error: () => {}
      });
  }

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

  onViewDetails(returnRequestId: number): void {
    const returnRequest = this.returnRequestsMap.get(returnRequestId);
    if (returnRequest) {
      this.returnService.getReturnById(returnRequestId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (returnRequest) => {
            this.selectedReturnRequest = returnRequest;
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
          next: (discardRequest) => {
            this.selectedDiscardRequest = discardRequest;
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

  private formatRequestDate(request: ReturnDto | DiscardDto): string {
    const dateSource = (request as any).creationDate || (request as any).createdOn;
    return this.formatDashboardDate(dateSource);
  }

    formatOrderDate(order: OrderDto): string {
    return this.formatDashboardDate(order.usageDate);
  }

  private formatDashboardDate(source?: string | Date): string {
    let date: Date;

    if (source instanceof Date) {
      date = source;
    } else if (typeof source === 'string') {
      const parsed = new Date(source);
      date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      date = new Date();
    }

    const day = date.getDate();
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  }

  resolveOrderDepartmentName(order: OrderDto): string {
    return order.departmentNameEn || order.departmentNameAr || 'N/A';
  }

  resolveRequestPurpose(order: OrderDto | null): string {
    if (!order) {
      return 'N/A';
    }
    return order.requestPurposeNameEn || order.requestPurposeNameAr || 'N/A';
  }

  resolveDepotName(order: OrderDto | null): string {
    if (!order) {
      return 'N/A';
    }
    return order.depotNameEn || order.depotNameAr || 'N/A';
  }

  private mapOrderItems(items?: OrderRequestItemDto[] | null): ReturnItem[] {
    if (!items || items.length === 0) {
      return [];
    }

    return items.map(item => ({
      itemName: item.itemName || item.itemNo || 'N/A',
      itemNo: item.itemNo || 'N/A',
      quantity: Number(item.quantity ?? 0),
      notes: item.notes || undefined
    }));
  }

  getOrderPriorityKey(priority?: number | null): string {
    switch (priority) {
      case 2:
        return 'dashboard.priorityLabels.medium';
      case 3:
        return 'dashboard.priorityLabels.low';
      default:
        return 'dashboard.priorityLabels.high';
    }
  }

  getOrderStatusKey(status?: number | null): string {
    switch (status) {
      case 2:
        return 'dashboard.statusLabels.underProcess';
      case 3:
        return 'dashboard.statusLabels.approved';
      case 4:
        return 'dashboard.statusLabels.rejected';
      case 5:
        return 'dashboard.statusLabels.cancelled';
      default:
        return 'dashboard.statusLabels.new';
    }
  }

  getOrderAllowanceKey(isFromAllowance?: boolean | null): string {
    return isFromAllowance ? 'common.yes' : 'common.no';
  }

  hasOrderItems(items?: OrderRequestItemDto[] | null): boolean {
    return !!items && items.length > 0;
  }

  formatOrderUsageTime(order: OrderDto | null): string {
    if (!order?.usageTime) {
      return 'N/A';
    }
    return order.usageTime.length >= 5 ? order.usageTime.substring(0, 5) : order.usageTime;
  }
}


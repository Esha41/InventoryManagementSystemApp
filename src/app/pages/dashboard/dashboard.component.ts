import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, X } from 'lucide-angular';
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

  /**
   * Filter dashboard cards based on user permissions and roles
   * Permissions from ALL user roles are combined by the backend
   */
  private filterCardsByPermissionsAndRoles(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = user && user.permissions && user.permissions.length > 0;
    const userRoles = user?.roles || [];

    // Debug logging to verify roles and permissions
    console.log('Dashboard Filtering - User Info:', {
      userName: user?.userName,
      userRoles: userRoles,
      totalRoles: userRoles.length,
      totalPermissions: user?.permissions?.length || 0,
      permissions: user?.permissions?.map(p => p.id || p.claimType) || []
    });

    // If not authenticated, show no cards
    if (!isAuthenticated) {
      this.visibleCards = [];
      return;
    }

    // Filter cards based on permissions and roles
    this.visibleCards = this.allCards.filter(card => {
      // If card has role requirements, check roles first
      if (card.roles && card.roles.length > 0) {
        const hasRequiredRole = card.roles.some(requiredRole =>
          userRoles.some(userRole => 
            userRole.toLowerCase() === requiredRole.toLowerCase()
          )
        );
        if (hasRequiredRole) {
          console.log(`Card "${card.title}" visible: User has required role`);
          return true; // User has one of the required roles
        }
      }

      // If card has no permissions requirement, show it (unless roles were specified and didn't match)
      if (!card.permissions || card.permissions.length === 0) {
        // If roles were specified but user doesn't have them, don't show
        return !card.roles || card.roles.length === 0;
      }

      // If permissions haven't loaded yet, don't show cards that require permissions
      if (!hasPermissionsLoaded) {
        console.log(`Card "${card.title}" hidden: Permissions not loaded yet`);
        return false;
      }

      // Check if user has any of the required permissions from ANY role
      // The backend should combine permissions from all roles in user.permissions
      const hasPermission = this.authService.hasAnyPermission(card.permissions);
      
      if (hasPermission) {
        console.log(`Card "${card.title}" visible: User has permission from one of their roles`);
      } else {
        console.log(`Card "${card.title}" hidden: User missing required permissions:`, card.permissions);
        // Debug: Check which permissions user actually has
        const userPermissionIds = user?.permissions?.map(p => p.id || p.claimType).filter(Boolean) || [];
        console.log(`User's actual permissions:`, userPermissionIds);
      }
      
      return hasPermission;
    });

    console.log('Dashboard Filtering Result:', {
      totalCards: this.allCards.length,
      visibleCards: this.visibleCards.length,
      visibleCardTitles: this.visibleCards.map(c => c.title)
    });
  }

  /**
   * Check if a card should be visible
   */
  shouldShowCard(card: DashboardCard): boolean {
    return this.visibleCards.includes(card);
  }

  /**
   * Load return requests from backend and create individual cards for each return
   */
  private loadOrderRequests(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) {
      return;
    }

    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          const newOrders = orders.filter(order => order.status === 1);

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

          this.allCards = this.allCards.filter(card => !card.orderRequestId);
          this.allCards.push(...orderCards);

          this.filterCardsByPermissionsAndRoles();
        },
        error: (error) => {
          console.error('Failed to load order requests:', error);
        }
      });
  }

  /**
   * Load return requests from backend and create individual cards for each return
   */
  private loadReturnRequests(): void {
    // Check if user has permission to view returns
    if (!this.authService.hasAnyPermission(['Permissions.Return.View', 'Permissions.Return.Page'])) {
      return;
    }

    this.returnService.getAllReturns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (returns: ReturnDto[]) => {
          // Filter only new returns (status = 1 = New)
          const newReturns = returns.filter(r => r.status === 1);
          
          // Store return requests for modal access
          this.returnRequestsMap = new Map(newReturns.map(r => [r.id, r]));

          // Create individual card for each return request
          const returnCards = newReturns.map(r => {
            // Map return items to ReturnItem format
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

          // Merge with existing cards (remove old return cards first)
          this.allCards = this.allCards.filter(c => !c.returnRequestId);
          this.allCards.push(...returnCards);

          // Re-filter cards to include the new returns cards
          this.filterCardsByPermissionsAndRoles();
        },
        error: (error) => {
          console.error('Failed to load return requests:', error);
          // Don't show error to user, just log it
        }
      });
  }

  /**
   * Load discard requests from backend and create individual cards for each discard
   */
  private loadDiscardRequests(): void {
    // Check if user has permission to view discards
    if (!this.authService.hasAnyPermission(['Permissions.Discard.View', 'Permissions.Discard.Page'])) {
      return;
    }

    this.discardService.getAllDiscards()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (discards: DiscardDto[]) => {
          // Filter only new discards (status = 1 = New)
          const newDiscards = discards.filter(d => d.status === 1);
          
          // Store discard requests for modal access
          this.discardRequestsMap = new Map(newDiscards.map(d => [d.id, d]));

          // Create individual card for each discard request
          const discardCards = newDiscards.map(d => {
            // Map discard items to ReturnItem format
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

          // Merge with existing cards (remove old discard cards first)
          this.allCards = this.allCards.filter(c => !c.discardRequestId);
          this.allCards.push(...discardCards);

          // Re-filter cards to include the new discards cards
          this.filterCardsByPermissionsAndRoles();
        },
        error: (error) => {
          console.error('Failed to load discard requests:', error);
          // Don't show error to user, just log it
        }
      });
  }


  /**
   * Handle view details button click for return requests
   */
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
          error: (error) => {
            console.error('Failed to fetch order details:', error);
            this.selectedOrderRequest = this.orderRequestsMap.get(orderRequestId) || null;
            this.isOrderModalOpen = true;
          }
        });
    }
  }

  onViewDetails(returnRequestId: number): void {
    const returnRequest = this.returnRequestsMap.get(returnRequestId);
    if (returnRequest) {
      // Fetch full details from backend
      this.returnService.getReturnById(returnRequestId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (returnRequest) => {
            this.selectedReturnRequest = returnRequest;
            this.isReturnModalOpen = true;
          },
          error: (error) => {
            console.error('Failed to fetch return request details:', error);
            // Fallback to cached data if available
            this.selectedReturnRequest = this.returnRequestsMap.get(returnRequestId) || null;
            this.isReturnModalOpen = true;
          }
        });
    }
  }

  /**
   * Handle view details button click for discard requests
   */
  onViewDiscardDetails(discardRequestId: number): void {
    const discardRequest = this.discardRequestsMap.get(discardRequestId);
    if (discardRequest) {
      // Fetch full details from backend
      this.discardService.getDiscardById(discardRequestId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (discardRequest) => {
            this.selectedDiscardRequest = discardRequest;
            this.isDiscardModalOpen = true;
          },
          error: (error) => {
            console.error('Failed to fetch discard request details:', error);
            // Fallback to cached data if available
            this.selectedDiscardRequest = this.discardRequestsMap.get(discardRequestId) || null;
            this.isDiscardModalOpen = true;
          }
        });
    }
  }

  /**
   * Close return modal
   */
  closeOrderModal(): void {
    this.isOrderModalOpen = false;
    this.selectedOrderRequest = null;
  }

  closeReturnModal(): void {
    this.isReturnModalOpen = false;
    this.selectedReturnRequest = null;
  }

  /**
   * Close discard modal
   */
  closeDiscardModal(): void {
    this.isDiscardModalOpen = false;
    this.selectedDiscardRequest = null;
  }

  /**
   * Format request date similar to backend date format
   * Format: "DD MMM YYYY" (e.g., "25 JULY 2024")
   */
  private formatRequestDate(request: ReturnDto | DiscardDto): string {
    return this.formatDashboardDate();
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


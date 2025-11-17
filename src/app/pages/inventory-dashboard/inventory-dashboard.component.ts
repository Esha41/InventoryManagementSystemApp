import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, X } from 'lucide-angular';
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

interface DashboardCard {
  title: string;
  status: 'new-issue' | 'on-progress' | 'completed';
  orders: OrderItem[];
  permissions: string[];
  departmentIds?: number[];
  orderRequestId?: number;
  returnRequestId?: number;
  discardRequestId?: number;
}

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    StatusCardComponent,
    ReturnDetailsModalComponent,
    DiscardDetailsModalComponent,
    OverstockCardComponent,
    AnnualActivityCardComponent
  ],
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css']
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refreshTimer: any = null;

  private allCards: DashboardCard[] = [];
  visibleCards: DashboardCard[] = [];

  isOrderModalOpen = false;
  selectedOrderRequest: OrderDto | null = null;
  private orderRequestsMap = new Map<number, OrderDto>();

  isReturnModalOpen = false;
  selectedReturnRequest: ReturnDto | null = null;

  isDiscardModalOpen = false;
  selectedDiscardRequest: DiscardDto | null = null;

  overstockItems: OverstockItemView[] = [];
  annualActivityValues: number[] = Array(12).fill(0);

  readonly XIcon = X;

  constructor(
    private authService: BackendAuthService,
    private orderService: OrderService,
    private returnService: ReturnService,
    private discardService: DiscardService,
    private notificationService: NotificationService,
    private inventoryService: InventoryService,
    private userContext: UserContextService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadAll());
    this.loadAll();

    // Auto-refresh periodically to reflect DB changes
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

  private loadAll(): void {
    this.filterCards();
    this.loadNewOrders();
    this.loadInProgressOrders();
    this.loadCompletedOrders();
    this.loadOverstock();
    this.loadAnnualActivity();
    this.notificationService.refresh();
  }

  // Expose manual refresh action for UI button
  onRefresh(): void {
    this.loadAll();
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

    const filtered = this.allCards.filter(card => {
      if (!isAdmin && card.departmentIds && card.departmentIds.length > 0) {
        if (userDeptId == null) return false;
        if (!card.departmentIds.includes(userDeptId)) return false;
      }
      if (!card.permissions || card.permissions.length === 0) return true;
      if (!hasPermissionsLoaded) return false;
      return this.authService.hasAnyPermission(card.permissions);
    });

    const rank = (c: DashboardCard): number => {
      switch (c.status) {
        case 'new-issue': return 0;
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
  }

  private loadNewOrders(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) return;
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          let orderList = orders.filter(o => o.status === 1);
          const user = this.authService.getCurrentUser();
          const isAdmin = this.userContext.isAdminUser();
          if (!isAdmin && user?.departmentId) {
            orderList = orderList.filter(o => o.departmentId === user.departmentId);
          }
          this.orderRequestsMap = new Map(orderList.map(o => [o.id, o]));
          const ordersView: OrderItem[] = orderList.map(o => ({
            orderId: o.requestNo || o.orderNo || `#${o.id}`,
            requestDate: this.formatOrderDate(o),
            departmentName: this.resolveOrderDepartmentName(o),
            requesterName: o.requesterName || 'N/A',
            items: this.mapOrderItems(o.requestItems),
            requestId: o.id
          }));

          // Also include Return requests with status = 1 in the same "New" column
          this.returnService.getAllReturns()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (returns: ReturnDto[]) => {
                let returnList = (returns || []).filter(r => r.status === 1);
                if (!isAdmin && user?.departmentId) {
                  returnList = returnList.filter(r => r.departmentId === user.departmentId);
                }
                const returnsView: OrderItem[] = returnList.map(r => ({
                  orderId: r.requestNo || `#${r.id}`,
                  requestDate: this.formatDate((r as any).createdOn || (r as any).creationDate),
                  departmentName: (r as any).departmentName || 'N/A',
                  requesterName: r.requesterName || 'N/A',
                  items: (r.requestItems || []).map((it: any) => ({
                    itemName: it.itemName || it.itemNo || 'N/A',
                    itemNo: it.itemNo || 'N/A',
                    quantity: Number(it.quantity ?? 0),
                    notes: it.notes || undefined
                  }))
                  // Note: no requestId so View Details button will still target the first order entry
                }));

                // Also include Discard requests with status = 1
                this.discardService.getAllDiscards()
                  .pipe(takeUntil(this.destroy$))
                  .subscribe({
                    next: (discards: DiscardDto[]) => {
                      let discardList = (discards || []).filter(d => d.status === 1);
                      if (!isAdmin && user?.departmentId) {
                        discardList = discardList.filter(d => d.departmentId === user.departmentId);
                      }
                      const discardView: OrderItem[] = discardList.map(d => ({
                        orderId: d.requestNo || `#${d.id}`,
                        requestDate: this.formatDate((d as any).creationDate || (d as any).createdOn),
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
                        departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                        returnRequestId: (ordersView.length === 0 && returnList.length > 0) ? returnList[0].id : undefined,
                        discardRequestId: (ordersView.length === 0 && returnsView.length === 0 && discardList.length > 0) ? discardList[0].id : undefined
                      };
                      this.allCards = this.allCards.filter(c => c.status !== 'new-issue');
                      this.allCards.push(card);
                      this.filterCards();
                    },
                    error: () => {
                      // Fallback to orders + returns if discards fail
                      const merged: OrderItem[] = [...ordersView, ...returnsView];
                      const card: DashboardCard = {
                        title: 'New',
                        status: 'new-issue',
                        orders: merged,
                        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                        departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                        returnRequestId: (ordersView.length === 0 && returnList.length > 0) ? returnList[0].id : undefined
                      };
                      this.allCards = this.allCards.filter(c => c.status !== 'new-issue');
                      this.allCards.push(card);
                      this.filterCards();
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
                  departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined
                };
                this.allCards = this.allCards.filter(c => c.status !== 'new-issue');
                this.allCards.push(card);
                this.filterCards();
              }
            });
        },
        error: () => {}
      });
  }

  private loadInProgressOrders(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) return;
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          let list = orders.filter(o => o.status === 2);
          const user = this.authService.getCurrentUser();
          const isAdmin = this.userContext.isAdminUser();
          if (!isAdmin && user?.departmentId) {
            list = list.filter(o => o.departmentId === user.departmentId);
          }
          const ordersList: OrderItem[] = list.map(o => ({
            orderId: o.requestNo || o.orderNo || `#${o.id}`,
            requestDate: this.formatOrderDate(o),
            departmentName: this.resolveOrderDepartmentName(o),
            requesterName: o.requesterName || 'N/A',
            items: this.mapOrderItems(o.requestItems),
            requestId: o.id
          }));

          // Merge Return status=2
          this.returnService.getAllReturns().pipe(takeUntil(this.destroy$)).subscribe({
            next: (returns: ReturnDto[]) => {
              let ret = (returns || []).filter(r => r.status === 2);
              if (!isAdmin && user?.departmentId) ret = ret.filter(r => r.departmentId === user.departmentId);
              const returnView: OrderItem[] = ret.map(r => ({
                orderId: r.requestNo || `#${r.id}`,
                requestDate: this.formatDate((r as any).creationDate || (r as any).createdOn),
                departmentName: (r as any).departmentName || 'N/A',
                requesterName: r.requesterName || 'N/A',
                items: (r.requestItems || []).map((it: any) => ({
                  itemName: it.itemName || it.itemNo || 'N/A',
                  itemNo: it.itemNo || 'N/A',
                  quantity: Number(it.quantity ?? 0),
                  notes: it.notes || undefined
                }))
              }));

              // Merge Discard status=2
              this.discardService.getAllDiscards().pipe(takeUntil(this.destroy$)).subscribe({
                next: (discards: DiscardDto[]) => {
                  let dis = (discards || []).filter(d => d.status === 2);
                  if (!isAdmin && user?.departmentId) dis = dis.filter(d => d.departmentId === user.departmentId);
                  const discardView: OrderItem[] = dis.map(d => ({
                    orderId: d.requestNo || `#${d.id}`,
                    requestDate: this.formatDate((d as any).creationDate || (d as any).createdOn),
                    departmentName: (d as any).departmentName || 'N/A',
                    requesterName: d.requesterName || 'N/A',
                    items: (d.requestItems || []).map((it: any) => ({
                      itemName: it.itemName || it.itemNo || 'N/A',
                      itemNo: it.itemNo || 'N/A',
                      quantity: Number(it.quantity ?? 0),
                      notes: it.notes || undefined
                    }))
                  }));

                  const merged = [...ordersList, ...returnView, ...discardView];
                  const card: DashboardCard = {
                    title: 'Requests On Progress',
                    status: 'on-progress',
                    orders: merged,
                    permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                    departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                    returnRequestId: returnView.length > 0 ? ret[0]?.id : undefined,
                    discardRequestId: discardView.length > 0 ? dis[0]?.id : undefined
                  };
                  this.allCards = this.allCards.filter(c => c.status !== 'on-progress');
                  this.allCards.push(card);
                  this.filterCards();
                },
                error: () => {
                  const merged = [...ordersList, ...returnView];
                  const card: DashboardCard = {
                    title: 'Requests On Progress',
                    status: 'on-progress',
                    orders: merged,
                    permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                    departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                    returnRequestId: returnView.length > 0 ? ret[0]?.id : undefined
                  };
                  this.allCards = this.allCards.filter(c => c.status !== 'on-progress');
                  this.allCards.push(card);
                  this.filterCards();
                }
              });
            },
            error: () => {
              const card: DashboardCard = {
                title: 'Requests On Progress',
                status: 'on-progress',
                orders: ordersList,
                permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined
              };
              this.allCards = this.allCards.filter(c => c.status !== 'on-progress');
              this.allCards.push(card);
              this.filterCards();
            }
          });
        },
        error: () => {}
      });
  }

  private loadCompletedOrders(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) return;
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          let list = orders.filter(o => o.status === 3);
          const user = this.authService.getCurrentUser();
          const isAdmin = this.userContext.isAdminUser();
          if (!isAdmin && user?.departmentId) {
            list = list.filter(o => o.departmentId === user.departmentId);
          }
          const ordersList: OrderItem[] = list.map(o => ({
            orderId: o.requestNo || o.orderNo || `#${o.id}`,
            requestDate: this.formatOrderDate(o),
            departmentName: this.resolveOrderDepartmentName(o),
            requesterName: o.requesterName || 'N/A',
            items: this.mapOrderItems(o.requestItems),
            requestId: o.id
          }));

          this.returnService.getAllReturns().pipe(takeUntil(this.destroy$)).subscribe({
            next: (returns: ReturnDto[]) => {
              let ret = (returns || []).filter(r => r.status === 3);
              if (!isAdmin && user?.departmentId) ret = ret.filter(r => r.departmentId === user.departmentId);
              const returnView: OrderItem[] = ret.map(r => ({
                orderId: r.requestNo || `#${r.id}`,
                requestDate: this.formatDate((r as any).creationDate || (r as any).createdOn),
                departmentName: (r as any).departmentName || 'N/A',
                requesterName: r.requesterName || 'N/A',
                items: (r.requestItems || []).map((it: any) => ({
                  itemName: it.itemName || it.itemNo || 'N/A',
                  itemNo: it.itemNo || 'N/A',
                  quantity: Number(it.quantity ?? 0),
                  notes: it.notes || undefined
                }))
              }));

              this.discardService.getAllDiscards().pipe(takeUntil(this.destroy$)).subscribe({
                next: (discards: DiscardDto[]) => {
                  let dis = (discards || []).filter(d => d.status === 3);
                  if (!isAdmin && user?.departmentId) dis = dis.filter(d => d.departmentId === user.departmentId);
                  const discardView: OrderItem[] = dis.map(d => ({
                    orderId: d.requestNo || `#${d.id}`,
                    requestDate: this.formatDate((d as any).creationDate || (d as any).createdOn),
                    departmentName: (d as any).departmentName || 'N/A',
                    requesterName: d.requesterName || 'N/A',
                    items: (d.requestItems || []).map((it: any) => ({
                      itemName: it.itemName || it.itemNo || 'N/A',
                      itemNo: it.itemNo || 'N/A',
                      quantity: Number(it.quantity ?? 0),
                      notes: it.notes || undefined
                    }))
                  }));

                  const merged = [...ordersList, ...returnView, ...discardView];
                  const card: DashboardCard = {
                    title: 'Done',
                    status: 'completed',
                    orders: merged,
                    permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                    departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                    returnRequestId: returnView.length > 0 ? ret[0]?.id : undefined,
                    discardRequestId: discardView.length > 0 ? dis[0]?.id : undefined
                  };
                  this.allCards = this.allCards.filter(c => c.status !== 'completed');
                  this.allCards.push(card);
                  this.filterCards();
                },
                error: () => {
                  const merged = [...ordersList, ...returnView];
                  const card: DashboardCard = {
                    title: 'Done',
                    status: 'completed',
                    orders: merged,
                    permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                    departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined,
                    returnRequestId: returnView.length > 0 ? ret[0]?.id : undefined
                  };
                  this.allCards = this.allCards.filter(c => c.status !== 'completed');
                  this.allCards.push(card);
                  this.filterCards();
                }
              });
            },
            error: () => {
              const card: DashboardCard = {
                title: 'Done',
                status: 'completed',
                orders: ordersList,
                permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
                departmentIds: (!isAdmin && user?.departmentId != null) ? [user.departmentId] : undefined
              };
              this.allCards = this.allCards.filter(c => c.status !== 'completed');
              this.allCards.push(card);
              this.filterCards();
            }
          });
        },
        error: () => {}
      });
  }

  onViewOrderDetails(orderRequestId: number): void {
    this.orderService.getOrderById(orderRequestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order: OrderDto) => {
          this.selectedOrderRequest = order;
          this.isOrderModalOpen = true;
        },
        error: () => {
          this.selectedOrderRequest = this.orderRequestsMap.get(orderRequestId) || null;
          this.isOrderModalOpen = true;
        }
      });
  }

  closeOrderModal(): void {
    this.isOrderModalOpen = false;
    this.selectedOrderRequest = null;
  }

  onViewReturnDetails(returnRequestId: number): void {
    this.returnService.getReturnById(returnRequestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ret: ReturnDto) => {
          this.selectedReturnRequest = ret;
          this.isReturnModalOpen = true;
        },
        error: () => {
          this.selectedReturnRequest = null;
          this.isReturnModalOpen = false;
        }
      });
  }

  closeReturnModal(): void {
    this.isReturnModalOpen = false;
    this.selectedReturnRequest = null;
  }

  onViewDiscardDetails(discardRequestId: number): void {
    this.discardService.getDiscardById(discardRequestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: DiscardDto) => {
          this.selectedDiscardRequest = res;
          this.isDiscardModalOpen = true;
        },
        error: () => {
          this.selectedDiscardRequest = null;
          this.isDiscardModalOpen = false;
        }
      });
  }

  closeDiscardModal(): void {
    this.isDiscardModalOpen = false;
    this.selectedDiscardRequest = null;
  }

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
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  resolveOrderDepartmentName(order: OrderDto): string {
    return (order as any).departmentNameEn || (order as any).departmentNameAr || 'N/A';
  }

  private mapOrderItems(items?: OrderRequestItemDto[] | null): ReturnItem[] {
    if (!items || items.length === 0) return [];
    return items.map((i: OrderRequestItemDto) => ({
      itemName: (i as any).itemName || i.itemNo || 'N/A',
      itemNo: i.itemNo || 'N/A',
      quantity: Number((i as any).quantity ?? 0),
      notes: (i as any).notes || undefined
    }));
  }

  private loadOverstock(): void {
    this.inventoryService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventories: any[]) => {
          console.log('Loaded inventories for overstock:', inventories);
          const out: OverstockItemView[] = [];
          
          if (!inventories || inventories.length === 0) {
            console.log('No inventories found');
            this.overstockItems = [];
            return;
          }
          
          (inventories || []).forEach((inv: any) => {
            console.log('Processing inventory:', inv);
            const details = inv.inventoryDetails || [];
            console.log('Inventory details:', details);
            
            if (!details || details.length === 0) {
              console.log('No inventory details found for inventory:', inv.id);
              return;
            }
            
            details.forEach((d: any) => {
              // Use itemQuantity (which is what warehouse inventory uses)
              const quantity: number = Number(d.itemQuantity ?? d.currentQuantity ?? 0);
              console.log('Processing detail:', d, 'Quantity:', quantity);
              
              // Only include items with quantity > 0
              if (quantity > 0) {
                const expDate: string | Date | undefined = d.item?.expiryDate;
                const exp = expDate ? new Date(expDate as any) : null;
                
                // Calculate percentage based on quantity (normalize to 0-100)
                // For overstock, we'll use a simple scale: items with higher quantities get higher percentages
                // You can adjust this logic based on your business rules (e.g., compare against a threshold)
                const maxQuantity = 10000; // Adjust this threshold based on your needs
                const percentage = Math.min(100, Math.round((quantity / maxQuantity) * 100));
                
                const itemName = d.item?.name || d.item?.itemNo || 'Item';
                console.log('Adding item to overstock:', itemName, 'Quantity:', quantity, 'Percentage:', percentage);
                
                out.push({
                  name: itemName,
                  lot: d.lot || 'N/A',
                  percentage: percentage,
                  expiryDate: exp && !isNaN(exp.getTime()) ? `${exp.getDate()} ${exp.toLocaleString('en', { month: 'short' })} ${exp.getFullYear()}` : undefined,
                  imageUrl: d.item?.itemType === 2 ? 'assets/Weapon .png' : 'assets/Ammunition.png'
                });
              } else {
                console.log('Skipping item with quantity 0:', d);
              }
            });
          });
          
          console.log('Total items found:', out.length);
          
          // Sort by quantity descending to show highest stock items first
          out.sort((a, b) => b.percentage - a.percentage);
          
          // Take top 10 items
          this.overstockItems = out.slice(0, 10);
          console.log('Final overstock items:', this.overstockItems);
        },
        error: (err) => { 
          console.error('Failed to load overstock items:', err);
          this.overstockItems = []; 
        }
      });
  }

  private loadAnnualActivity(): void {
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          const months: number[] = Array(12).fill(0);
          orders.forEach((o: OrderDto) => {
            const d = o.usageDate ? new Date(o.usageDate) : null;
            const m = d && !isNaN(d.getTime()) ? d.getMonth() : null;
            if (m !== null) months[m] = months[m] + 1;
          });
          this.annualActivityValues = months;
        },
        error: () => { this.annualActivityValues = Array(12).fill(0); }
      });
  }
}



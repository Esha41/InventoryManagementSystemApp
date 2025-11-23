import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, X, ShieldAlert } from 'lucide-angular';
import { StatusCardComponent, OrderItem, ReturnItem } from './components/status-card/status-card.component';
import { ReturnDetailsModalComponent } from './components/return-details-modal/return-details-modal.component';
import { DiscardDetailsModalComponent } from './components/discard-details-modal/discard-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';
import { REQUEST_STATUS } from '@constants/app.constants';
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
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';

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
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    StatusCardComponent,
    ReturnDetailsModalComponent,
    DiscardDetailsModalComponent,
    DropdownComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // All dashboard cards with their permission/role requirements
  allCards: DashboardCard[] = [];

  // Filtered cards based on user permissions and roles
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

  readonly XIcon = X;
  readonly ShieldAlert = ShieldAlert;
  showContactAdminNotice = false;

  constructor(
    private authService: BackendAuthService,
    private orderService: OrderService,
    private returnService: ReturnService,
    private discardService: DiscardService,
    private translate: TranslateService
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
    let filteredCards = this.allCards.filter(card => {
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

    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      filteredCards = filteredCards.filter(card => card.status === this.selectedStatusFilter);
    }

    this.visibleCards = filteredCards;

    const permissionsArray = Array.isArray(user?.permissions) ? user?.permissions : [];
    this.showContactAdminNotice = isAuthenticated && permissionsArray.length === 0 && this.visibleCards.length === 0;
  }

  onStatusFilterChange(): void {
    this.filterCardsByPermissionsAndRoles();
  }

  get filteredCardsCount(): number {
    return this.visibleCards.length;
  }

  // Translate function for dropdown labels
  statusFilterLabelFn = (option: DropdownOption<CardStatus | 'all'> | CardStatus | 'all'): string => {
    if (typeof option === 'object' && option !== null && 'label' in option) {
      return this.translate.instant(option.label as string);
    }
    return '';
  };

  shouldShowCard(card: DashboardCard): boolean {
    return this.visibleCards.includes(card);
  }

  // Helper: Remove existing cards of a specific type
  private removeCardsByType(predicate: (card: DashboardCard) => boolean): void {
    this.allCards = this.allCards.filter(card => !predicate(card));
  }

  // Generic method to process and add request cards
  private processRequestCards<T extends DisplayableRequest>(
    requests: T[],
    cardConfig: {
      permissions: string[];
      getCardId: (req: T) => number | undefined;
      getCardPredicate: (card: DashboardCard) => boolean;
      mapToCard: (req: T) => DashboardCard;
      storeInMap: (req: T) => void;
    }
  ): void {
    const currentUser = this.authService.getCurrentUser();
    const filtered = filterRequestsByDepartment(
      filterDisplayableRequests(requests),
      currentUser?.departmentId
    );

    // Store in appropriate map
    filtered.forEach(req => cardConfig.storeInMap(req));

    // Create cards
    const cards = filtered.map(req => cardConfig.mapToCard(req));

    // Remove old cards and add new ones
    this.removeCardsByType(cardConfig.getCardPredicate);
    this.allCards.push(...cards);

    this.filterCardsByPermissionsAndRoles();
  }

  private loadOrderRequests(): void {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) {
      return;
    }

    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          this.processRequestCards(orders, {
            permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
            getCardId: (order) => order.id,
            getCardPredicate: (card) => !!card.orderRequestId,
            mapToCard: (order) => ({
              title: getRequestTitle(order, order.orderNo),
              status: mapRequestStatusToCardStatus(order.status),
              orders: [{
                orderId: getRequestTitle(order, order.orderNo),
                requestDate: this.formatOrderDate(order),
                departmentName: this.resolveOrderDepartmentName(order),
                requesterName: order.requesterName || 'N/A',
                items: mapRequestItems(order.requestItems)
              }],
              permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
              orderRequestId: order.id
            }),
            storeInMap: (order) => this.orderRequestsMap.set(order.id, order)
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
          this.processRequestCards(returns, {
            permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
            getCardId: (ret) => ret.id,
            getCardPredicate: (card) => !!card.returnRequestId,
            mapToCard: (ret) => ({
              title: getRequestTitle(ret),
              status: mapRequestStatusToCardStatus(ret.status),
              orders: [{
                orderId: getRequestTitle(ret),
                requestDate: this.formatRequestDate(ret),
                departmentName: ret.departmentName || 'N/A',
                requesterName: ret.requesterName || 'N/A',
                items: mapRequestItems(ret.requestItems)
              }],
              permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
              returnRequestId: ret.id
            }),
            storeInMap: (ret) => this.returnRequestsMap.set(ret.id, ret)
          });
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
          this.processRequestCards(discards, {
            permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
            getCardId: (discard) => discard.id,
            getCardPredicate: (card) => !!card.discardRequestId,
            mapToCard: (discard) => ({
              title: getRequestTitle(discard),
              status: mapRequestStatusToCardStatus(discard.status),
              orders: [{
                orderId: getRequestTitle(discard),
                requestDate: this.formatRequestDate(discard),
                departmentName: discard.departmentName || 'N/A',
                requesterName: discard.requesterName || 'N/A',
                items: mapRequestItems(discard.requestItems)
              }],
              permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
              discardRequestId: discard.id
            }),
            storeInMap: (discard) => this.discardRequestsMap.set(discard.id, discard)
          });
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
    return getRequestStatusTranslationKey(status);
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


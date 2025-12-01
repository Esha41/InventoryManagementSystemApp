import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, combineLatest, of, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LucideAngularModule, X, ShieldAlert, Grid, List, Eye, Search } from 'lucide-angular';
import { StatusCardComponent, OrderItem } from './components/status-card/status-card.component';
import { ReturnDetailsModalComponent } from './components/return-details-modal/return-details-modal.component';
import { DiscardDetailsModalComponent } from './components/discard-details-modal/discard-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';
import { ErrorHandlingService } from '@services/error-handling.service';
import { UserContextService } from '@services/user-context.service';
import { DashboardCard } from '@models/dashboard.model';
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
import { formatRequestDate } from '@utils/request-mapper.utils';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';

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
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent
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
  rowsPerPage = 9;
  
  // Icons
  readonly Grid = Grid;
  readonly List = List;
  readonly Eye = Eye;
  readonly XIcon = X;
  readonly ShieldAlert = ShieldAlert;
  readonly Search = Search;

  // Search functionality
  searchQuery: string = '';

  // All dashboard cards with their permission/role requirements
  allCards: DashboardCard[] = [];

  // Filtered cards based on user permissions and roles
  visibleCards: DashboardCard[] = [];
  
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

  showContactAdminNotice = false;

  // Helper for status badges in table view
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'new-issue':
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'on-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Helper for status translation in table view
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
      default:
        return 'dashboard.statusLabels.new';
    }
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
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly translate: TranslateService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly userContext: UserContextService
  ) {}

  get paginatedCards(): DashboardCard[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.visibleCards.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.visibleCards.length / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.cdr.markForCheck();
    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  toggleViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
    this.rowsPerPage = mode === 'table' ? 10 : 9; // Different defaults for different views
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    // Subscribe to user changes and load data
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAllRequests();
      });

    // Initial load
    this.loadAllRequests();
  }

  /**
   * Load all requests in parallel for better performance
   */
  private loadAllRequests(): void {
    combineLatest({
      orders: this.loadOrderRequests$(),
      returns: this.loadReturnRequests$(),
      discards: this.loadDiscardRequests$()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ orders, returns, discards }) => {
          this.processOrderRequests(orders);
          this.processReturnRequests(returns);
          this.processDiscardRequests(discards);
          this.filterCardsByPermissionsAndRoles();
          this.cdr.markForCheck();
        },
        error: (error) => {
          const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
          console.error('Failed to load dashboard requests:', errorMessage);
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private filterCardsByPermissionsAndRoles(): void {
    const user = this.authService.getCurrentUser();
    const isAuthenticated = this.authService.isAuthenticated();
    const hasPermissionsLoaded = user?.permissions && user.permissions.length > 0;
    const userRoles = user?.roles || [];

    // If not authenticated, show no cards
    if (!isAuthenticated) {
      this.visibleCards = [];
      this.showContactAdminNotice = false;
      return;
    }

    // Filter cards based on permissions and roles
    let filteredCards = this.allCards.filter(card => {
      // Check role-based access first
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

      // If card has no permissions or roles, show it only if user has no restrictions
      if (!card.permissions || card.permissions.length === 0) {
        return !card.roles || card.roles.length === 0;
      }

      // Require permissions to be loaded if card needs permissions
      if (!hasPermissionsLoaded) {
        return false;
      }

      return this.authService.hasAnyPermission(card.permissions);
    });

    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      filteredCards = filteredCards.filter(card => card.status === this.selectedStatusFilter);
    }

    // Apply search filter
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const query = this.searchQuery.trim().toLowerCase();
      filteredCards = filteredCards.filter(card => {
        // Search in order IDs, department names, requester names
        return card.orders.some(order => 
          (order.orderId && order.orderId.toLowerCase().includes(query)) ||
          (order.departmentName && order.departmentName.toLowerCase().includes(query)) ||
          (order.requesterName && order.requesterName.toLowerCase().includes(query))
        );
      });
    }

    this.visibleCards = filteredCards;
    
    // Reset to first page when filters change
    this.currentPage = 1;

    const permissionsArray = Array.isArray(user?.permissions) ? user.permissions : [];
    this.showContactAdminNotice = isAuthenticated && permissionsArray.length === 0 && this.visibleCards.length === 0;
  }

  onStatusFilterChange(): void {
    this.filterCardsByPermissionsAndRoles();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.filterCardsByPermissionsAndRoles();
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

  /**
   * Translate function for dropdown labels
   */
  readonly statusFilterLabelFn = (option: DropdownOption<CardStatus | 'all'> | CardStatus | 'all'): string => {
    if (typeof option === 'object' && option !== null && 'label' in option) {
      return this.translate.instant(option.label as string);
    }
    return '';
  };

  shouldShowCard(card: DashboardCard): boolean {
    return this.paginatedCards.includes(card);
  }

  /**
   * Remove existing cards of a specific type
   */
  private removeCardsByType(predicate: (card: DashboardCard) => boolean): void {
    this.allCards = this.allCards.filter(card => !predicate(card));
  }

  /**
   * Generic method to process and add request cards
   */
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
  }

  /**
   * Load order requests as Observable for combineLatest
   */
  private loadOrderRequests$() {
    if (!this.authService.hasAnyPermission(['Permissions.Order.View', 'Permissions.Order.Page'])) {
      return of(null);
    }

    return this.orderService.getAllOrders().pipe(
      catchError((error) => {
        const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
        // Log error but don't break the flow
        console.error('Failed to load order requests:', errorMessage);
        return of([] as OrderDto[]);
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Load return requests as Observable for combineLatest
   */
  private loadReturnRequests$() {
    if (!this.authService.hasAnyPermission(['Permissions.Return.View', 'Permissions.Return.Page'])) {
      return of(null);
    }

    return this.returnService.getAllReturns().pipe(
      catchError((error) => {
        const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
        console.error('Failed to load return requests:', errorMessage);
        return of([] as ReturnDto[]);
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Load discard requests as Observable for combineLatest
   */
  private loadDiscardRequests$() {
    if (!this.authService.hasAnyPermission(['Permissions.Discard.View', 'Permissions.Discard.Page'])) {
      return of(null);
    }

    return this.discardService.getAllDiscards().pipe(
      catchError((error) => {
        const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
        console.error('Failed to load discard requests:', errorMessage);
        return of([] as DiscardDto[]);
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Process and store order requests
   */
  private processOrderRequests(orders: OrderDto[] | null): void {
    if (!orders || orders.length === 0) {
      return;
    }

    this.processRequestCards(orders, {
      permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
      getCardId: (order) => order.id,
      getCardPredicate: (card) => !!card.orderRequestId,
      mapToCard: (order) => ({
        title: getRequestTitle(order, order.orderNo),
        status: mapRequestStatusToCardStatus(order.status),
        orders: [{
          orderId: getRequestTitle(order, order.orderNo),
          requestDate: formatRequestDate(order.usageDate),
          departmentName: this.resolveOrderDepartmentName(order),
          requesterName: order.requesterName || 'N/A',
          items: mapRequestItems(order.requestItems)
        }],
        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
        orderRequestId: order.id
      }),
      storeInMap: (order) => this.orderRequestsMap.set(order.id, order)
    });
  }

  /**
   * Process and store return requests
   */
  private processReturnRequests(returns: ReturnDto[] | null): void {
    if (!returns || returns.length === 0) {
      return;
    }

    this.processRequestCards(returns, {
      permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
      getCardId: (ret) => ret.id,
      getCardPredicate: (card) => !!card.returnRequestId,
      mapToCard: (ret) => ({
        title: getRequestTitle(ret),
        status: mapRequestStatusToCardStatus(ret.status),
        orders: [{
          orderId: getRequestTitle(ret),
          requestDate: 'N/A', // Return requests don't have a date field in the DTO
          departmentName: ret.departmentName || 'N/A',
          requesterName: ret.requesterName || 'N/A',
          items: mapRequestItems(ret.requestItems)
        }],
        permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
        returnRequestId: ret.id
      }),
      storeInMap: (ret) => this.returnRequestsMap.set(ret.id, ret)
    });
  }

  /**
   * Process and store discard requests
   */
  private processDiscardRequests(discards: DiscardDto[] | null): void {
    if (!discards || discards.length === 0) {
      return;
    }

    this.processRequestCards(discards, {
      permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
      getCardId: (discard) => discard.id,
      getCardPredicate: (card) => !!card.discardRequestId,
      mapToCard: (discard) => ({
        title: getRequestTitle(discard),
        status: mapRequestStatusToCardStatus(discard.status),
        orders: [{
          orderId: getRequestTitle(discard),
          requestDate: 'N/A', // Discard requests don't have a date field in the DTO
          departmentName: discard.departmentName || 'N/A',
          requesterName: discard.requesterName || 'N/A',
          items: mapRequestItems(discard.requestItems)
        }],
        permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
        discardRequestId: discard.id
      }),
      storeInMap: (discard) => this.discardRequestsMap.set(discard.id, discard)
    });
  }

  onViewOrderDetails(orderRequestId: number): void {
    const cachedOrder = this.orderRequestsMap.get(orderRequestId);
    
    this.orderService.getOrderById(orderRequestId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
          console.error('Failed to load order details:', errorMessage);
          // Fallback to cached data if available
          if (cachedOrder) {
            return of(cachedOrder);
          }
          return EMPTY;
        })
      )
      .subscribe({
        next: (order) => {
          this.selectedOrderRequest = order;
          this.isOrderModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  onViewDetails(returnRequestId: number): void {
    const cachedReturn = this.returnRequestsMap.get(returnRequestId);
    
    this.returnService.getReturnById(returnRequestId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
          console.error('Failed to load return details:', errorMessage);
          if (cachedReturn) {
            return of(cachedReturn);
          }
          return EMPTY;
        })
      )
      .subscribe({
        next: (returnRequest) => {
          this.selectedReturnRequest = returnRequest;
          this.isReturnModalOpen = true;
          this.cdr.markForCheck();
        }
      });
  }

  onViewDiscardDetails(discardRequestId: number): void {
    const cachedDiscard = this.discardRequestsMap.get(discardRequestId);
    
    this.discardService.getDiscardById(discardRequestId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          const errorMessage = this.errorHandlingService.resolveHttpErrorMessage(error);
          console.error('Failed to load discard details:', errorMessage);
          if (cachedDiscard) {
            return of(cachedDiscard);
          }
          return EMPTY;
        })
      )
      .subscribe({
        next: (discardRequest) => {
          this.selectedDiscardRequest = discardRequest;
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

  /**
   * Format order date for display
   */
  formatOrderDate(order: OrderDto): string {
    return formatRequestDate(order.usageDate);
  }

  /**
   * Resolve department name with fallback
   */
  resolveOrderDepartmentName(order: OrderDto): string {
    return order.departmentNameEn || order.departmentNameAr || 'N/A';
  }

  /**
   * Resolve request purpose name with fallback
   */
  resolveRequestPurpose(order: OrderDto | null): string {
    if (!order) {
      return 'N/A';
    }
    return order.requestPurposeNameEn || order.requestPurposeNameAr || 'N/A';
  }

  /**
   * Resolve depot name with fallback
   */
  resolveDepotName(order: OrderDto | null): string {
    if (!order) {
      return 'N/A';
    }
    return order.depotNameEn || order.depotNameAr || 'N/A';
  }

  /**
   * Get translation key for order priority
   */
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

  /**
   * Get translation key for order status
   */
  getOrderStatusKey(status?: number | null): string {
    return getRequestStatusTranslationKey(status);
  }

  /**
   * Get translation key for allowance indicator
   */
  getOrderAllowanceKey(isFromAllowance?: boolean | null): string {
    return isFromAllowance ? 'common.yes' : 'common.no';
  }

  /**
   * Check if order has items
   */
  hasOrderItems(items?: OrderRequestItemDto[] | null): boolean {
    return !!items && items.length > 0;
  }

  /**
   * Format order usage time (HH:MM format)
   */
  formatOrderUsageTime(order: OrderDto | null): string {
    if (!order?.usageTime) {
      return 'N/A';
    }
    return order.usageTime.length >= 5 ? order.usageTime.substring(0, 5) : order.usageTime;
  }
}


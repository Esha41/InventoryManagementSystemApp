import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, combineLatest, of, EMPTY, merge } from 'rxjs';
import { catchError, debounceTime, filter, map } from 'rxjs/operators';
import { LucideAngularModule, X, ShieldAlert, Grid, List, Eye, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { StatusCardComponent, OrderItem } from './components/status-card/status-card.component';
import { ReturnDetailsModalComponent } from './components/return-details-modal/return-details-modal.component';
import { DiscardDetailsModalComponent } from './components/discard-details-modal/discard-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { UnifiedRequestService, BaseRequestDto } from '@services/unified-request.service';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';
import { ErrorHandlingService } from '@services/error-handling.service';
import { UserContextService } from '@services/user-context.service';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
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
import { isDisplayableRequestStatus } from '@utils/status.utils';
import { formatRequestDate } from '@utils/request-mapper.utils';
import { mapToOrderDto, mapToReturnDto, mapToDiscardDto, separateRequestsByType } from '@utils/request-type-mapper.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
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
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;

  // Search functionality
  searchQuery: string = '';

  // Sort state
  sortState: { column: string | null; direction: 'asc' | 'desc' } = {
    column: null,
    direction: 'asc'
  };

  // All dashboard cards with their permission/role requirements
  allCards: DashboardCard[] = [];

  // Filtered cards based on user permissions and roles
  visibleCards: DashboardCard[] = [];

  // Status filter
  selectedStatusFilter: CardStatus | 'all' | 'action-required' = 'all';
  readonly statusFilterOptions: DropdownOption<CardStatus | 'all' | 'action-required'>[] = [
    { label: 'dashboard.filters.all', value: 'all' },
    { label: 'requestsManagement.actionRequired', value: 'action-required' },
    { label: 'dashboard.statusLabels.new', value: 'new' },
    { label: 'dashboard.statusLabels.underProcess', value: 'on-progress' },
    { label: 'dashboard.statusLabels.approved', value: 'completed' },
    { label: 'dashboard.statusLabels.rejected', value: 'declined' },
    { label: 'dashboard.statusLabels.returnedForReview', value: 'returned' }
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
      case 'returned':
        return 'bg-purple-100 text-purple-800';
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
      case 'returned':
        return 'dashboard.statusLabels.returnedForReview';
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
    private readonly unifiedRequestService: UnifiedRequestService,
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly translate: TranslateService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly userContextService: UserContextService,
    private readonly requestStatusUpdateService: RequestStatusUpdateService
  ) { }

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

    const languageChanges$ = this.translate.onLangChange.pipe(
      map(() => 'language-change')
    );

    // Merge all triggers and use distinctUntilChanged with a time window
    // to prevent duplicate calls within a short time frame
    merge(userChanges$, statusUpdates$, navigationChanges$, languageChanges$)
      .pipe(
        debounceTime(100), // Small debounce to handle rapid successive events
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadAllRequests();
      });
  }

  /**
   * Load all requests using unified endpoint for better performance
   * Reduces API calls from 3 (Order, Return, Discard) to 1 unified call
   * Following Angular best practices for data fetching and transformation
   */
  private loadAllRequests(): void {
    this.unifiedRequestService.getUserActionRequests()
      .pipe(
        map(requests => separateRequestsByType(requests)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: ({ orders, returns, discards }) => {
          this.allCards = [];

          // Process each request type
          this.processUnifiedOrders(orders);
          this.processUnifiedReturns(returns);
          this.processUnifiedDiscards(discards);

          // Apply filters and update view
          this.filterCardsByPermissionsAndRoles();
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Process unified order requests
   * Transforms BaseRequestDto to OrderDto and processes them
   */
  private processUnifiedOrders(orders: BaseRequestDto[]): void {
    if (!orders || orders.length === 0) {
      return;
    }

    // Transform BaseRequestDto to OrderDto
    const orderDtos = orders.map(order => mapToOrderDto(order));

    // Process using existing logic
    this.processOrderRequests(orderDtos);
  }

  /**
   * Process unified return requests
   * Transforms BaseRequestDto to ReturnDto and processes them
   */
  private processUnifiedReturns(returns: BaseRequestDto[]): void {
    if (!returns || returns.length === 0) {
      return;
    }

    // Transform BaseRequestDto to ReturnDto
    const returnDtos = returns.map(ret => mapToReturnDto(ret));

    // Process using existing logic
    this.processReturnRequests(returnDtos);
  }

  /**
   * Process unified discard requests
   * Transforms BaseRequestDto to DiscardDto and processes them
   */
  private processUnifiedDiscards(discards: BaseRequestDto[]): void {
    if (!discards || discards.length === 0) {
      return;
    }

    // Transform BaseRequestDto to DiscardDto
    const discardDtos = discards.map(discard => mapToDiscardDto(discard));

    // Process using existing logic
    this.processDiscardRequests(discardDtos);
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

    if (!isAuthenticated) {
      this.visibleCards = [];
      this.showContactAdminNotice = false;
      return;
    }

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
      if (this.selectedStatusFilter === 'action-required') {
        filteredCards = filteredCards.filter(card => card.isMyTurn);
      } else {
        filteredCards = filteredCards.filter(card => card.status === this.selectedStatusFilter);
      }
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

    // Apply sorting
    if (this.sortState.column) {
      filteredCards = this.sortCards(filteredCards, this.sortState.column, this.sortState.direction);
    }

    this.visibleCards = filteredCards;
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

  sortByColumn(column: string): void {
    if (this.sortState.column === column) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.column = column;
      this.sortState.direction = 'asc';
    }
    this.filterCardsByPermissionsAndRoles();
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

    // Only show button for pending orders (status 1 = New, 2 = Under Process, 6 = ReturnedForReview)
    // Status 3 = Approved, 4 = Rejected
    if (order.status !== 1 && order.status !== 2 && order.status !== 6) {
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
    const isAdminUser = this.userContextService.isAdminUser();

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
  readonly statusFilterLabelFn = (option: DropdownOption<CardStatus | 'all' | 'action-required'> | CardStatus | 'all' | 'action-required'): string => {
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
    const displayableRequests = filterDisplayableRequests(requests);
    const filtered = filterRequestsByDepartment(
      displayableRequests,
      currentUser?.departmentId
    );

    filtered.forEach(req => cardConfig.storeInMap(req));
    const cards = filtered.map(req => cardConfig.mapToCard(req));
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
      catchError(() => {
        // Return empty array on error to not break the flow
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
      catchError(() => {
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
      catchError(() => {
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
          requestDate: this.formatCreationDate(order),
          departmentName: this.resolveOrderDepartmentName(order),
          requesterName: this.resolveRequesterName(order),
          items: mapRequestItems(order.requestItems)
        }],
        permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
        orderRequestId: order.id,
        isMyTurn: order.isMyTurn
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
          requestDate: this.formatCreationDate(ret),
          departmentName: this.resolveReturnDepartmentName(ret),
          requesterName: this.resolveRequesterName(ret),
          items: mapRequestItems(ret.requestItems)
        }],
        permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
        returnRequestId: ret.id,
        isMyTurn: ret.isMyTurn
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
          requestDate: this.formatCreationDate(discard),
          departmentName: this.resolveDiscardDepartmentName(discard),
          requesterName: this.resolveRequesterName(discard),
          items: mapRequestItems(discard.requestItems)
        }],
        permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
        discardRequestId: discard.id,
        isMyTurn: discard.isMyTurn
      }),
      storeInMap: (discard) => this.discardRequestsMap.set(discard.id, discard)
    });
  }

  onViewOrderDetails(orderRequestId: number): void {
    const cachedOrder = this.orderRequestsMap.get(orderRequestId);

    this.orderService.getOrderById(orderRequestId)
      .pipe(
        takeUntil(this.destroy$),
        map((order) => {
          // Ensure nested objects are preserved for localization
          // Backend returns OrderDto which extends BaseRequestDto with nested objects
          // But we need to ensure they're available for the modal
          if (order && !order.department && (order as any).Department) {
            // Handle potential casing differences
            order.department = (order as any).Department;
          }
          if (order && !order.requester && (order as any).Requester) {
            order.requester = (order as any).Requester;
          }
          return order;
        }),
        catchError(() => {
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
        catchError(() => {
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
        catchError(() => {
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
    if (!order.usageDateFrom) return 'N/A';

    const fromDate = new Date(order.usageDateFrom).toLocaleDateString();
    const toDate = order.usageDateTo ? new Date(order.usageDateTo).toLocaleDateString() : '';

    return toDate ? `${fromDate} - ${toDate}` : fromDate;
  }

  /**
   * Format creation date for display
   */
  formatCreationDate(order: OrderDto | any): string {
    const creationDate = order.creationDate;
    if (!creationDate) return 'N/A';
    return new Date(creationDate).toLocaleDateString();
  }

  /**
   * Resolve department name with localization
   */
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

  /**
   * Resolve request purpose name with fallback
   */
  resolveRequestPurpose(order: OrderDto | null): string {
    if (!order) {
      return 'N/A';
    }
    const currentLang = getCurrentLang(this.translate);

    // Try nested object first (current backend structure)
    if (order.requestPurpose) {
      return getLocalizedName(
        {
          nameEn: order.requestPurpose.nameEn,
          nameAr: order.requestPurpose.nameAr
        },
        currentLang
      ) || order.usagePurpose || 'N/A';
    }

    // Fallback to flattened properties (if they exist)
    return getLocalizedName(
      {
        nameEn: order.requestPurposeNameEn,
        nameAr: order.requestPurposeNameAr
      },
      currentLang
    ) || order.usagePurpose || 'N/A';
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
   * Handles both number and string status values
   */
  getOrderStatusKey(status?: number | string | null): string {
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
   * Format order usage time to military format (HHMM)
   * Handles backend TimeOnly serialization format (HH:mm:ss)
   */
  formatOrderUsageTime(order: OrderDto | null): string {
    if (!order) return 'N/A';

    // Backend sends TimeOnly as "HH:mm:ss" format, convert to military time (HHMM)
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

    const fromDate = order.usageDateFrom ? new Date(order.usageDateFrom).toLocaleDateString() : null;
    const toDate = order.usageDateTo ? new Date(order.usageDateTo).toLocaleDateString() : null;

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

    const fromDate = new Date(order.usageDateFrom).toLocaleDateString();
    const fromTime = this.formatOrderUsageTime(order);

    // Extract just the "from" time (before the dash)
    let timePart = 'N/A';
    if (fromTime !== 'N/A' && fromTime.includes(' - ')) {
      timePart = fromTime.split(' - ')[0];
    } else if (fromTime !== 'N/A') {
      timePart = fromTime;
    }

    return timePart !== 'N/A' ? `${fromDate} (${timePart})` : fromDate;
  }

  /**
   * Format usage date to with time
   */
  formatOrderUsageDateTo(order: OrderDto | null): string {
    if (!order || !order.usageDateTo) return 'N/A';

    const toDate = new Date(order.usageDateTo).toLocaleDateString();
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

  /**
   * Sort cards based on column and direction
   */
  private sortCards(cards: DashboardCard[], column: string, direction: 'asc' | 'desc'): DashboardCard[] {
    const sorted = [...cards];
    sorted.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (column) {
        case 'orderNumber':
          valA = a.orders[0]?.orderId || a.title || '';
          valB = b.orders[0]?.orderId || b.title || '';
          break;
        case 'usageDate':
          valA = a.orders[0]?.requestDate || '';
          valB = b.orders[0]?.requestDate || '';
          // Try to parse as date for proper date sorting
          const dateA = this.parseDate(valA);
          const dateB = this.parseDate(valB);
          if (dateA && dateB) {
            return direction === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
          }
          // Fallback to string comparison if dates can't be parsed
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        case 'department':
          valA = a.orders[0]?.departmentName || 'N/A';
          valB = b.orders[0]?.departmentName || 'N/A';
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        case 'requester':
          valA = a.orders[0]?.requesterName || 'N/A';
          valB = b.orders[0]?.requesterName || 'N/A';
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          break;
        default:
          return 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Parse date string to Date object
   * Handles various date formats including DD/MM/YYYY, MM/DD/YYYY, and ISO formats
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === 'N/A') return null;
    
    // Try parsing as ISO date first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try parsing DD/MM/YYYY or MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Try DD/MM/YYYY format (common in many locales)
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // Try MM/DD/YYYY format
      const month2 = parseInt(parts[0], 10) - 1;
      const day2 = parseInt(parts[1], 10);
      const year2 = parseInt(parts[2], 10);
      if (!isNaN(day2) && !isNaN(month2) && !isNaN(year2)) {
        date = new Date(year2, month2, day2);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return null;
  }
}


import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, combineLatest, of, EMPTY, merge } from 'rxjs';
import { catchError, debounceTime, filter, map } from 'rxjs/operators';
import { LucideAngularModule, X, ShieldAlert, Grid, List, Eye, Search, ArrowUp, ArrowDown, ArrowUpDown, Filter } from 'lucide-angular';
import { StatusCardComponent, OrderItem } from './components/status-card/status-card.component';
import { RequestDetailsModalComponent, UnifiedRequestDto } from './components/request-details-modal/request-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { UnifiedRequestService } from '@services/unified-request.service';
import { ReturnService } from '@services/return.service';
import { ReturnDto } from '@models/return.model';
import { DiscardService } from '@services/discard.service';
import { DiscardDto } from '@models/discard.model';
import { OrderService } from '@services/order.service';
import { OrderDto } from '@models/order.model';
import { ErrorHandlingService } from '@services/error-handling.service';
import { UserContextService } from '@services/user-context.service';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { DashboardDataService } from '@services/dashboard-data.service';
import { DashboardFilterService } from '@services/dashboard-filter.service';
import { DashboardCard } from '@models/dashboard.model';
import {
  getRequestStatusTranslationKey,
  CardStatus
} from '@utils/dashboard.utils';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { formatTimeToMilitary } from '@utils/format.utils';

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
  rowsPerPage = 8;

  // Icons
  readonly Grid = Grid;
  readonly List = List;
  readonly Eye = Eye;
  readonly ShieldAlert = ShieldAlert;
  readonly Search = Search;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;
  readonly X = X;
  readonly Filter = Filter;

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

  // Modal state (unified)
  isRequestModalOpen = false;
  selectedRequest: UnifiedRequestDto | null = null;
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
    private readonly requestStatusUpdateService: RequestStatusUpdateService,
    private readonly dashboardDataService: DashboardDataService,
    private readonly dashboardFilterService: DashboardFilterService
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
   * Load all requests using DashboardDataService
   * Business logic has been extracted to service following Angular best practices
   */
  private loadAllRequests(): void {
    this.dashboardDataService.loadAllDashboardCards()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cards) => {
          this.allCards = cards;
          // Store requests in maps for modal access
          this.updateRequestMaps(cards);
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
   * Update request maps from cards for modal access
   * This maintains backward compatibility with existing modal logic
   */
  private updateRequestMaps(cards: DashboardCard[]): void {
    // Clear existing maps
    this.orderRequestsMap.clear();
    this.returnRequestsMap.clear();
    this.discardRequestsMap.clear();

    // Note: Maps are populated when modals are opened via getOrderById, etc.
    // This method is kept for potential future use if we need to pre-populate maps
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private filterCardsByPermissionsAndRoles(): void {
    const result = this.dashboardFilterService.filterCards(
      this.allCards,
      {
        statusFilter: this.selectedStatusFilter,
        searchQuery: this.searchQuery,
        sortColumn: this.sortState.column,
        sortDirection: this.sortState.direction
      }
    );

    this.visibleCards = result.filteredCards;
    this.currentPage = 1;
    this.showContactAdminNotice = result.showContactAdminNotice;
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

  /**
   * Sort cards based on column and direction
   * @deprecated Use DashboardFilterService.sortCards instead
   */
  private sortCards(cards: DashboardCard[], column: string, direction: 'asc' | 'desc'): DashboardCard[] {
    return this.dashboardFilterService.sortCards(cards, column, direction);
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
    if (!dateTime) return '';

    try {
      const date = dateTime instanceof Date ? dateTime : new Date(dateTime);
      if (isNaN(date.getTime())) return '';

      // Format date as dd/MM/yyyy
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      // Format time as HHmm
      const formattedTime = formatTimeToMilitary(date);

      return formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
    } catch {
      return '';
    }
  }

}


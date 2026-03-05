import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, combineLatest, of, merge, interval, forkJoin, Observable } from 'rxjs';
import { catchError, filter, map, startWith, switchMap, finalize, distinctUntilChanged } from 'rxjs/operators';
import { LucideAngularModule, ShieldAlert, RefreshCw, Grid, List, Eye } from 'lucide-angular';
import { RequestDetailsModalComponent, UnifiedRequestDto } from '@dashboard/pages/overview/components/request-details-modal/request-details-modal.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { OrderService } from '@services/order.service';
import { OrderDto, OrderRequestItemDto } from '@models/order.model';
import { NotificationService } from '@services/notification.service';
import { UserContextService } from '@services/user-context.service';
import { UnifiedRequestService } from '@services/unified-request.service';
import { ReturnService } from '@services/return.service';
import { ReturnDto } from '@models/return.model';
import { DiscardService } from '@services/discard.service';
import { DiscardDto } from '@models/discard.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { RequestFilterBarComponent, StatusFilter } from '@components/request-filter-bar/request-filter-bar.component';
import { DashboardDataService } from '@services/dashboard-data.service';
import { DashboardCard } from '@models/dashboard.model';
import { StatisticsData } from '@models/inventory-dashboard.model';
import { MonitoringService } from '@services/monitoring.service';
import {
  getRequestStatusTranslationKey
} from '@utils/dashboard.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { separateRequestsByType, mapToOrderDto } from '@utils/request-type-mapper.utils';
import { formatTimeToMilitary, formatDateTimeExtended } from '@utils/format.utils';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    RequestDetailsModalComponent,
    PaginationComponent,
    RowsPerPageComponent,
    RequestFilterBarComponent
  ],
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly manualRefresh$ = new Subject<void>();

  // View state
  viewMode: 'table' = 'table';
  currentPage = 1;
  rowsPerPage = 10;

  // Dashboard cards
  visibleCards: DashboardCard[] = [];
  totalItems: number = 0;
  totalPages: number = 0;
  isLoading: boolean = false;

  // Modal state (unified)
  isRequestModalOpen = false;
  selectedRequest: UnifiedRequestDto | null = null;

  // Statistics
  statistics: StatisticsData = {
    totalItems: 0,
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
  errorMessage: string | null = null;

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
    private readonly userContext: UserContextService,
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    private readonly requestStatusUpdateService: RequestStatusUpdateService,
    private readonly monitoringService: MonitoringService,
    private readonly dashboardDataService: DashboardDataService
  ) { }

  ngOnInit(): void {
    this.setupLoadingPipeline();
  }

  private setupLoadingPipeline(): void {
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

    const triggers$ = merge(
      userChanges$.pipe(distinctUntilChanged()),
      statusUpdates$,
      navigationChanges$,
      languageChanges$,
      this.manualRefresh$
    ).pipe(
      startWith('initial-load'),
      takeUntil(this.destroy$)
    );

    triggers$
      .pipe(
        switchMap((trigger) => {
          this.isLoading = true;
          this.cdr.markForCheck();

          // Load all dashboard data atomically in parallel
          return forkJoin({
            statistics: this.fetchStatisticsData(),
            paginatedRequests: this.fetchPaginatedRequestsData()
          }).pipe(
            catchError(err => {
              this.errorMessage = ErrorHandler.extractErrorMessage(err, 'Failed to load dashboard data');
              this.cdr.markForCheck();
              return of(null);
            }),
            finalize(() => {
              this.isLoading = false;
              this.cdr.markForCheck();
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((result: { statistics: any; paginatedRequests: any } | null) => {
        if (result) {
          const { statistics, paginatedRequests } = result;
          if (statistics) {
            this.calculateStatistics(statistics.expiringLotsCount, statistics.lowStockCount);
          }
          if (paginatedRequests) {
            this.visibleCards = paginatedRequests.items;
            this.totalItems = paginatedRequests.totalCount;
            this.totalPages = paginatedRequests.totalPages;
          }
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRefresh(): void {
    this.manualRefresh$.next();
  }

  private loadAll(): void {
    // This method is now legacy, using the pipeline instead
  }

  private fetchStatisticsData(): Observable<any> {
    const expiringLotsCount$ = this.monitoringService.getExpiringLotsCount().pipe(catchError(() => of(0)));
    const lowStockCount$ = this.monitoringService.getLowStockItemsCount().pipe(catchError(() => of(0)));

    return forkJoin({
      expiringLotsCount: expiringLotsCount$,
      lowStockCount: lowStockCount$
    });
  }

  private fetchPaginatedRequestsData(): Observable<any> {
    return this.dashboardDataService.getDashboardRequests(
      this.currentPage,
      this.rowsPerPage,
      this.searchQuery,
      this.selectedStatusFilter,
      { column: null, direction: 'asc' } // Default sort for inventory dashboard
    );
  }

  get paginatedCards(): DashboardCard[] {
    return this.visibleCards;
  }

  get filteredCardsCount(): number {
    return this.totalItems;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.manualRefresh$.next();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.manualRefresh$.next();
  }

  onStatusFilterChange(status: StatusFilter): void {
    this.selectedStatusFilter = status;
    this.currentPage = 1;
    this.manualRefresh$.next();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.currentPage = 1;
    this.manualRefresh$.next();
  }

  private calculateStatistics(expiringLotsCount: number = 0, lowStockCount: number = 0): void {
    this.statistics = {
      totalItems: 0,
      lowStock: lowStockCount,
      expiringSoon: expiringLotsCount,
      monthlyActivity: Array(12).fill(0),
      monthlyActivityPercentages: Array(12).fill(0)
    };
  }

  onViewOrderDetails(orderRequestId: number): void {
    this.orderService.getOrderById(orderRequestId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (order) => {
        this.selectedRequest = order as UnifiedRequestDto;
        this.isRequestModalOpen = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isRequestModalOpen = true;
        this.cdr.markForCheck();
      }
    });
  }

  onViewReturnDetails(returnRequestId: number): void {
    this.returnService.getReturnById(returnRequestId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (ret: ReturnDto) => {
        this.selectedRequest = ret as UnifiedRequestDto;
        this.isRequestModalOpen = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isRequestModalOpen = true;
        this.cdr.markForCheck();
      }
    });
  }

  onViewDiscardDetails(discardRequestId: number): void {
    this.discardService.getDiscardById(discardRequestId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: DiscardDto) => {
        this.selectedRequest = res as UnifiedRequestDto;
        this.isRequestModalOpen = true;
        this.cdr.markForCheck();
      },
      error: () => {
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

  onTableAction(card: DashboardCard): void {
    if (card.orderRequestId) {
      this.onViewOrderDetails(card.orderRequestId);
    } else if (card.returnRequestId) {
      this.onViewReturnDetails(card.returnRequestId);
    } else if (card.discardRequestId) {
      this.onViewDiscardDetails(card.discardRequestId);
    }
  }

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

  // Formatting helpers
  formatOrderDate(order: OrderDto): string {
    if (!order.usageDateFrom) return 'N/A';
    const fromDate = this.formatDate(order.usageDateFrom);
    const toDate = order.usageDateTo ? this.formatDate(order.usageDateTo) : '';
    return toDate ? `${fromDate} - ${toDate}` : fromDate;
  }

  formatCreationDate(order: any): string {
    const creationDate = order.creationDate || order.requestDate;
    if (!creationDate) return 'N/A';
    return this.formatApprovalDateTime(creationDate);
  }

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
    if (order.department) {
      const localized = getLocalizedName(order.department, currentLang);
      if (localized) return localized;
    }
    if (order.departmentNameEn || order.departmentNameAr) {
      return getLocalizedName({ nameEn: order.departmentNameEn, nameAr: order.departmentNameAr }, currentLang) || 'N/A';
    }
    return 'N/A';
  }

  resolveRequesterName(request: any): string {
    if (!request) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    if (request.requester) {
      const localized = getLocalizedName(request.requester, currentLang);
      if (localized) return localized;
      if (request.requester.userName) return request.requester.userName;
    }
    if (request.requesterName) return request.requesterName;
    return 'N/A';
  }

  resolveReturnDepartmentName(ret: ReturnDto): string {
    return getLocalizedName(ret.department, getCurrentLang(this.translate)) || 'N/A';
  }

  resolveDiscardDepartmentName(discard: DiscardDto): string {
    return getLocalizedName(discard.department, getCurrentLang(this.translate)) || 'N/A';
  }

  resolveRequestPurpose(order: OrderDto | null): string {
    if (!order) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    if (order.requestPurpose) {
      return getLocalizedName({ nameEn: order.requestPurpose.nameEn, nameAr: order.requestPurpose.nameAr }, currentLang) || 'N/A';
    }
    return getLocalizedName({ nameEn: order.requestPurposeNameEn, nameAr: order.requestPurposeNameAr }, currentLang) || 'N/A';
  }

  resolveDepotName(order: OrderDto | null): string {
    if (!order) return 'N/A';
    return getLocalizedName({ nameEn: order.depotNameEn, nameAr: order.depotNameAr }, getCurrentLang(this.translate)) || 'N/A';
  }

  getOrderPriorityKey(priority?: number | string | null): string {
    if (priority === null || priority === undefined) return 'dashboard.priorityLabels.urgent';
    let priorityNum: number;
    if (typeof priority === 'string') {
      const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
      if (priorityLower === 'normal' || priorityLower === '1') priorityNum = 1;
      else if (priorityLower === 'urgent' || priorityLower === '2') priorityNum = 2;
      else if (priorityLower === 'veryurgent' || priorityLower === '3') priorityNum = 3;
      else if (priorityLower === 'critical' || priorityLower === '4') priorityNum = 4;
      else priorityNum = parseInt(priority, 10) || 2;
    } else priorityNum = priority;

    switch (priorityNum) {
      case 1: return 'dashboard.priorityLabels.normal';
      case 2: return 'dashboard.priorityLabels.urgent';
      case 3: return 'dashboard.priorityLabels.veryUrgent';
      case 4: return 'dashboard.priorityLabels.critical';
      default: return 'dashboard.priorityLabels.urgent';
    }
  }

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
    const fromTime = formatTimeToMilitary(order.usageTimeFrom);
    const toTime = formatTimeToMilitary(order.usageTimeTo);
    if (!fromTime) return 'N/A';
    return toTime ? `${fromTime} - ${toTime}` : fromTime;
  }

  get annualActivityValues(): number[] {
    return this.statistics.monthlyActivity;
  }

  onExpiringSoonClick(): void {
    this.router.navigate(['/inventory-dashboard/expiring-lots']);
  }

  onLowStockClick(): void {
    this.router.navigate(['/inventory-dashboard/low-stock']);
  }
}

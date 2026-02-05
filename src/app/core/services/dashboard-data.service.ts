import { Injectable } from '@angular/core';
import { Observable, of, EMPTY } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { UnifiedRequestService, BaseRequestDto } from './unified-request.service';
import { OrderService } from './order.service';
import { OrderDto } from '@models/order.model';
import { ReturnService } from './return.service';
import { ReturnDto } from '@models/return.model';
import { DiscardService } from './discard.service';
import { DiscardDto } from '@models/discard.model';
import { DashboardCard } from '@models/dashboard.model';
import {
  mapRequestStatusToCardStatus,
  getRequestTitle,
  mapRequestItems,
  filterDisplayableRequests,
  DisplayableRequest
} from '@utils/dashboard.utils';
import { mapToOrderDto, mapToReturnDto, mapToDiscardDto, separateRequestsByType } from '@utils/request-type-mapper.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { PaginatedList, PagedRequest } from '@models/api-response.model';
import { RequestType } from '@utils/request-type-mapper.utils';

/**
 * Dashboard Data Service
 * Handles data loading and transformation for dashboard cards
 * Extracted from dashboard.component.ts to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class DashboardDataService {
  constructor(
    private readonly unifiedRequestService: UnifiedRequestService,
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService,
    private readonly translate: TranslateService
  ) { }

  /**
   * Load all dashboard cards from unified endpoint
   * Returns Observable of DashboardCard array
   */
  loadAllDashboardCards(): Observable<DashboardCard[]> {
    return this.unifiedRequestService.getUserActionRequests().pipe(
      map(requests => separateRequestsByType(requests)),
      map(({ orders, returns, discards }) => {
        const allCards: DashboardCard[] = [];

        // Process each request type
        if (orders && orders.length > 0) {
          const orderDtos = orders.map(order => mapToOrderDto(order));
          allCards.push(...this.processOrderRequests(orderDtos));
        }

        if (returns && returns.length > 0) {
          const returnDtos = returns.map(ret => mapToReturnDto(ret));
          allCards.push(...this.processReturnRequests(returnDtos));
        }

        if (discards && discards.length > 0) {
          const discardDtos = discards.map(discard => mapToDiscardDto(discard));
          allCards.push(...this.processDiscardRequests(discardDtos));
        }

        return allCards;
      }),
      catchError(() => {
        // Return empty array on error to not break the flow
        return of([]);
      })
    );
  }

  /**
   * Load paginated dashboard cards from unified endpoint
   */
  loadPaginatedDashboardCards(request: PagedRequest): Observable<PaginatedList<DashboardCard>> {
    return this.unifiedRequestService.getUserActionRequestsPaginated(request).pipe(
      map(paginatedResponse => {
        const items = paginatedResponse.items || [];
        const cards = items.map(base => {
          let typeNum: number;
          if (typeof base.requestType === 'number') {
            typeNum = base.requestType;
          } else {
            const typeStr = String(base.requestType).toLowerCase();
            if (typeStr === 'order' || typeStr === '1') typeNum = 1;
            else if (typeStr === 'return' || typeStr === '2') typeNum = 2;
            else if (typeStr === 'discard' || typeStr === '3') typeNum = 3;
            else typeNum = parseInt(typeStr, 10);
          }

          if (typeNum === 1 || typeNum === RequestType.Order) {
            const order = mapToOrderDto(base);
            return {
              title: getRequestTitle(order, order.orderNo),
              status: mapRequestStatusToCardStatus(order.status),
              orders: [{
                orderId: getRequestTitle(order, order.orderNo),
                requestDate: order.creationDate ? (typeof order.creationDate === 'string' ? order.creationDate : order.creationDate.toISOString()) : '',
                departmentName: this.resolveOrderDepartmentName(order),
                requesterName: this.resolveRequesterName(order),
                items: mapRequestItems(order.requestItems)
              }],
              permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
              orderRequestId: order.id,
              isMyTurn: order.isMyTurn
            } as DashboardCard;
          } else if (typeNum === 2 || typeNum === RequestType.Return) {
            const ret = mapToReturnDto(base);
            return {
              title: getRequestTitle(ret),
              status: mapRequestStatusToCardStatus(ret.status),
              orders: [{
                orderId: getRequestTitle(ret),
                requestDate: ret.creationDate ? (typeof ret.creationDate === 'string' ? ret.creationDate : ret.creationDate.toISOString()) : '',
                departmentName: this.resolveReturnDepartmentName(ret),
                requesterName: this.resolveRequesterName(ret),
                items: mapRequestItems(ret.requestItems)
              }],
              permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
              returnRequestId: ret.id,
              isMyTurn: ret.isMyTurn
            } as DashboardCard;
          } else if (typeNum === 3 || typeNum === RequestType.Discard) {
            const discard = mapToDiscardDto(base);
            return {
              title: getRequestTitle(discard),
              status: mapRequestStatusToCardStatus(discard.status),
              orders: [{
                orderId: getRequestTitle(discard),
                requestDate: discard.creationDate ? (typeof discard.creationDate === 'string' ? discard.creationDate : discard.creationDate.toISOString()) : '',
                departmentName: this.resolveDiscardDepartmentName(discard),
                requesterName: this.resolveRequesterName(discard),
                items: mapRequestItems(discard.requestItems)
              }],
              permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
              discardRequestId: discard.id,
              isMyTurn: discard.isMyTurn
            } as DashboardCard;
          }
          return null;
        }).filter(c => !!c) as DashboardCard[];

        return {
          ...paginatedResponse,
          items: cards
        };
      }),
      catchError(error => {
        console.error('DashboardDataService Paginated Error:', error);
        return of({ items: [], totalCount: 0, pageIndex: 1, totalPages: 0, hasPreviousPage: false, hasNextPage: false });
      })
    );
  }

  /**
   * Process order requests and convert to dashboard cards
   */
  private processOrderRequests(orders: OrderDto[]): DashboardCard[] {
    if (!orders || orders.length === 0) {
      return [];
    }

    const displayableRequests = filterDisplayableRequests(orders);

    return displayableRequests.map(order => ({
      title: getRequestTitle(order, order.orderNo),
      status: mapRequestStatusToCardStatus(order.status),
      orders: [{
        orderId: getRequestTitle(order, order.orderNo),
        requestDate: order.creationDate ? (typeof order.creationDate === 'string' ? order.creationDate : order.creationDate.toISOString()) : '',
        departmentName: this.resolveOrderDepartmentName(order),
        requesterName: this.resolveRequesterName(order),
        items: mapRequestItems(order.requestItems)
      }],
      permissions: ['Permissions.Order.View', 'Permissions.Order.Page'],
      orderRequestId: order.id,
      isMyTurn: order.isMyTurn
    }));
  }

  /**
   * Process return requests and convert to dashboard cards
   */
  private processReturnRequests(returns: ReturnDto[]): DashboardCard[] {
    if (!returns || returns.length === 0) {
      return [];
    }

    const displayableRequests = filterDisplayableRequests(returns);

    return displayableRequests.map(ret => ({
      title: getRequestTitle(ret),
      status: mapRequestStatusToCardStatus(ret.status),
      orders: [{
        orderId: getRequestTitle(ret),
        requestDate: (ret as any).creationDate ? (typeof (ret as any).creationDate === 'string' ? (ret as any).creationDate : (ret as any).creationDate.toISOString()) : '',
        departmentName: this.resolveReturnDepartmentName(ret),
        requesterName: this.resolveRequesterName(ret),
        items: mapRequestItems(ret.requestItems)
      }],
      permissions: ['Permissions.Return.View', 'Permissions.Return.Page'],
      returnRequestId: ret.id,
      isMyTurn: ret.isMyTurn
    }));
  }

  /**
   * Get dashboard requests with strict typing and centralized logic
   */
  getDashboardRequests(
    page: number,
    rowsPerPage: number,
    searchQuery: string,
    statusFilter: string,
    sortState: { column: string | null; direction: 'asc' | 'desc' }
  ): Observable<PaginatedList<DashboardCard>> {
    const filters: any[] = []; // Use strict FilterData[] in implementation if possible, or build carefully

    // Global search
    if (searchQuery && searchQuery.trim()) {
      filters.push({ value: searchQuery.trim() });
    }

    // Status filter mapping
    if (statusFilter !== 'all') {
      if (statusFilter === 'action-required') {
        filters.push({ field: 'IsMyTurn', operator: 'eq', value: 'true' });
      } else {
        const dashboardStatusToBackendStatus: Record<string, number> = {
          'new': 1,
          'on-progress': 2,
          'completed': 3,
          'declined': 4,
          'returned': 6
        };
        const statusValue = dashboardStatusToBackendStatus[statusFilter];
        if (statusValue) {
          filters.push({ field: 'Status', operator: 'eq', value: statusValue.toString() });
        }
      }
    }

    const pagedRequest: PagedRequest = {
      page: page,
      pageSize: rowsPerPage,
      filter: filters.length > 0 ? (filters.length === 1 ? filters[0] : { logic: 'and', filters }) : undefined
    };

    // Sorting mapping
    if (sortState.column) {
      const columnMap: Record<string, string> = {
        'orderNumber': 'RequestNo',
        'usageDate': 'CreationDate',
        'department': 'Department.NameEn',
        'requester': 'Requester.UserName',
        'status': 'Status'
      };
      const backendColumn = columnMap[sortState.column];
      if (backendColumn) {
        if (!pagedRequest.filter) {
          pagedRequest.filter = {};
        }
        pagedRequest.filter.sortField = backendColumn;
        pagedRequest.filter.sortDirection = sortState.direction === 'asc' ? 1 : 2;
      }
    }

    return this.loadPaginatedDashboardCards(pagedRequest);
  }

  /**
   * Process discard requests and convert to dashboard cards
   */
  private processDiscardRequests(discards: DiscardDto[]): DashboardCard[] {
    if (!discards || discards.length === 0) {
      return [];
    }

    const displayableRequests = filterDisplayableRequests(discards);

    return displayableRequests.map(discard => ({
      title: getRequestTitle(discard),
      status: mapRequestStatusToCardStatus(discard.status),
      orders: [{
        orderId: getRequestTitle(discard),
        requestDate: (discard as any).creationDate ? (typeof (discard as any).creationDate === 'string' ? (discard as any).creationDate : (discard as any).creationDate.toISOString()) : '',
        departmentName: this.resolveDiscardDepartmentName(discard),
        requesterName: this.resolveRequesterName(discard),
        items: mapRequestItems(discard.requestItems)
      }],
      permissions: ['Permissions.Discard.View', 'Permissions.Discard.Page'],
      discardRequestId: discard.id,
      isMyTurn: discard.isMyTurn
    }));
  }


  /**
   * Resolve department name with localization for orders
   */
  private resolveOrderDepartmentName(order: OrderDto): string {
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
  private resolveRequesterName(request: OrderDto | ReturnDto | DiscardDto | any): string {
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
  private resolveReturnDepartmentName(ret: ReturnDto): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(ret.department, currentLang) || 'N/A';
  }

  /**
   * Resolve discard department name with localization
   */
  private resolveDiscardDepartmentName(discard: DiscardDto): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(discard.department, currentLang) || 'N/A';
  }

  /**
   * Get order by ID with fallback to cached data
   */
  getOrderById(orderRequestId: number, cachedOrder?: OrderDto | null): Observable<OrderDto> {
    return this.orderService.getOrderById(orderRequestId).pipe(
      map((order) => {
        // Ensure nested objects are preserved for localization
        if (order && !order.department && (order as any).Department) {
          order.department = (order as any).Department;
        }
        if (order && !order.requester && (order as any).Requester) {
          order.requester = (order as any).Requester;
        }
        if (order && !order.requestPurpose && (order as any).RequestPurpose) {
          order.requestPurpose = (order as any).RequestPurpose;
        }

        // Ensure flat properties are populated from nested objects if not already present
        if (order) {
          // Copy department name properties from nested object if flat properties are missing
          if (!order.departmentNameEn && order.department?.nameEn) {
            order.departmentNameEn = order.department.nameEn;
          }
          if (!order.departmentNameAr && order.department?.nameAr) {
            order.departmentNameAr = order.department.nameAr;
          }

          // Copy requester name properties from nested object if flat properties are missing
          if (!order.requesterName && order.requester) {
            order.requesterName = order.requester.fullNameEN || order.requester.fullNameAR || order.requester.userName;
          }
          if (!order.requesterNameEn && order.requester?.fullNameEN) {
            order.requesterNameEn = order.requester.fullNameEN;
          }
          if (!order.requesterNameAr && order.requester?.fullNameAR) {
            order.requesterNameAr = order.requester.fullNameAR;
          }

          // Copy request purpose name properties from nested object if flat properties are missing
          if (!order.requestPurposeNameEn && order.requestPurpose?.nameEn) {
            order.requestPurposeNameEn = order.requestPurpose.nameEn;
          }
          if (!order.requestPurposeNameAr && order.requestPurpose?.nameAr) {
            order.requestPurposeNameAr = order.requestPurpose.nameAr;
          }
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
    );
  }

  /**
   * Get return by ID with fallback to cached data
   */
  getReturnById(returnRequestId: number, cachedReturn?: ReturnDto | null): Observable<ReturnDto> {
    return this.returnService.getReturnById(returnRequestId).pipe(
      catchError(() => {
        if (cachedReturn) {
          return of(cachedReturn);
        }
        return EMPTY;
      })
    );
  }

  /**
   * Get discard by ID with fallback to cached data
   */
  getDiscardById(discardRequestId: number, cachedDiscard?: DiscardDto | null): Observable<DiscardDto> {
    return this.discardService.getDiscardById(discardRequestId).pipe(
      catchError(() => {
        if (cachedDiscard) {
          return of(cachedDiscard);
        }
        return EMPTY;
      })
    );
  }
}


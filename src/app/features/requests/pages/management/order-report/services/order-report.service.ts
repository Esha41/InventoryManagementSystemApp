import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@services/api.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { OrderDto } from '@models/order.model';
import { RoleDto } from '@models/backend-user.model';
import { BaseRequestDto, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep } from '@models/order-report.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import { UnifiedRequestService } from '@requests/services/unified-request.service';
import { PaginatedList, PagedRequest } from '@models/api-response.model';
import { 
  mapOrderToSummary, 
  mapOrderItems, 
  generateApprovalWorkflowFallback 
} from '../../utils/order-report.utils';
import { 
  mapApprovalHistory, 
  mapRequestStatus
} from '@utils/request-mapper.utils';
import { resolveRequestDetailEndpoint } from '@utils/request-detail-endpoint.utils';
import { 
  getLocalizedName, 
  getCurrentLang 
} from '@utils/localization.utils';
import {  formatTimeToMilitary } from '@utils/format.utils';

/**
 * Service for handling order report data loading and business logic
 */
@Injectable({
  providedIn: 'root'
})
export class OrderReportService {
  private roles: RoleDto[] = [];
  private roleMap: Map<string, string> = new Map();
  private destroy$ = new Subject<void>();

  constructor(
    private apiService: ApiService,
    private backendUserService: BackendUserService,
    private toastService: ToastService,
    private translate: TranslateService,
    private unifiedRequestService: UnifiedRequestService
  ) {}

  /**
   * Load orders from the paginated user-actions API (Request/UserActionsPaginated).
   */
  loadOrdersPaginated(
    page: number,
    pageSize: number,
    search?: string
  ): Observable<PaginatedList<OrderDto>> {
    const trimmed = search?.trim() ?? '';
    const request: PagedRequest = {
      page,
      pageSize,
      filter: trimmed ? { value: trimmed } : undefined
    };

    return this.unifiedRequestService.getUserActionRequestsPaginated(request).pipe(
      map((paginated) => ({
        ...paginated,
        items: (paginated.items ?? []).map((item) => item as OrderDto)
      })),
      catchError((error) => {
        console.error('Failed to load requests', error);
        this.toastService.error('Failed to load request list. Please try again.');
        return of({
          items: [] as OrderDto[],
          pageIndex: page,
          totalPages: 0,
          totalCount: 0,
          hasPreviousPage: false,
          hasNextPage: false
        });
      })
    );
  }

  /**
   * Load approval workflow for an order
   */
  loadApprovalWorkflow(
    orderId: number,
    orders: OrderDto[],
    orderSummary: OrderSummary
  ): Observable<OrderReportApprovalStep[]> {
    return this.apiService.get<BaseRequestDto>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.BASE_REQUEST_BY_ID(orderId)
    )
      .pipe(
        map((response: BaseRequestDto) => this.extractSingleBaseRequest(response)),
        tap((baseRequest) => this.syncOrderWithDepartment(orderId, baseRequest, orders)),
        map((baseRequest) => this.buildApprovalWorkflowFromSingle(
          baseRequest, 
          orderId, 
          orders, 
          orderSummary
        )),
        catchError((error) => {
          console.error('Failed to load approval workflow', error);
          return of(this.buildFallbackApprovalSteps(orderId, orders, orderSummary));
        })
      );
  }

  /**
   * Map order to report data (summary and items)
   */
  mapOrderToReport(order: OrderDto, baseRequestStatus?: number | null): {
    summary: OrderSummary;
    items: OrderReportItem[];
  } {
    const summary = mapOrderToSummary(order, baseRequestStatus, this.translate);
    const items = mapOrderItems(order);
    
    return { summary, items };
  }

  /**
   * Load full request detail (includes weapon associations on line items).
   * Paginated user-actions list omits weapon association rows on request items.
   */
  loadRequestDetailForReport(order: OrderDto): Observable<OrderDto> {
    const endpoint = resolveRequestDetailEndpoint(order.requestType, order.id, {
      defaultToOrderWhenMissing: true
    });
    if (!endpoint) {
      return of(order);
    }

    return this.apiService.get<OrderDto>(endpoint).pipe(
      map((detail) => this.mergeRequestDetail(order, detail)),
      catchError((error) => {
        console.error('Failed to load request detail for report', error);
        this.toastService.warning(
          this.translate.instant('requestsManagement.orderReport.detailLoadWarning')
        );
        return of(order);
      })
    );
  }

  /**
   * Filter orders based on search term
   */
  filterOrders(
    orders: OrderDto[], 
    searchTerm: string,
    getDepartmentName: (order: OrderDto) => string,
    getStatusLabel: (status: number) => string,
    getPriorityLabel: (priority: number) => string
  ): OrderDto[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return [...orders];
    }

    const searchLower = searchTerm.toLowerCase().trim();
    return orders.filter(order => {
      const requestNo = (order.requestNo || order.orderNo || `#${order.id}`).toLowerCase();
      const department = getDepartmentName(order).toLowerCase();
      const status = getStatusLabel(order.status).toLowerCase();
      const priority = getPriorityLabel(order.priority).toLowerCase();

      return requestNo.includes(searchLower) ||
        department.includes(searchLower) ||
        status.includes(searchLower) ||
        priority.includes(searchLower);
    });
  }

  /**
   * Load roles and build role map
   */
  loadRoles(): Observable<void> {
    if (this.roles.length > 0) {
      this.rebuildRoleMap(getCurrentLang(this.translate));
      return of(void 0);
    }

    return this.backendUserService.getRoles()
      .pipe(
        tap((roles: RoleDto[]) => {
          this.roles = roles;
          this.rebuildRoleMap(getCurrentLang(this.translate));
        }),
        map(() => void 0),
        catchError((error) => {
          console.error('Failed to load roles', error);
          return of(void 0);
        })
      );
  }

  /**
   * Get role name by ID
   */
  getRoleName(roleId?: string | null): string {
    if (!roleId) return 'N/A';
    return this.roleMap.get(roleId) || roleId;
  }

  /**
   * Get localized role name from step
   */
  getLocalizedRoleName(step: WorkflowApprovalStep): string {
    const currentLang = getCurrentLang(this.translate);

    if (currentLang === 'ar' && step.applicationRoleNameAr) {
      return step.applicationRoleNameAr;
    } else if (step.applicationRoleName) {
      return step.applicationRoleName;
    } else if (step.applicationRoleId) {
      return this.getRoleName(step.applicationRoleId);
    }

    return 'N/A';
  }

  /**
   * Get localized approver name from step
   */
  getLocalizedApproverName(step: WorkflowApprovalStep): string {
    const currentLang = getCurrentLang(this.translate);

    if (step.isPending) {
      if (currentLang === 'ar' && step.applicationRoleNameAr) {
        return step.applicationRoleNameAr;
      } else if (step.applicationRoleName) {
        return step.applicationRoleName;
      }
    }

    if (currentLang === 'ar' && step.approverNameAr) {
      return step.approverNameAr;
    } else if (step.approverNameEn) {
      return step.approverNameEn;
    } else if (step.approverName) {
      return step.approverName;
    }

    return 'N/A';
  }

  /**
   * Format approval date-time for workflow display
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

  // Private helper methods

  private extractSingleBaseRequest(response: BaseRequestDto | unknown): BaseRequestDto | null {
    if (!response) return null;
    if (Array.isArray(response)) {
      return (response[0] as BaseRequestDto) || null;
    }
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = (response as { data?: unknown }).data;
      return Array.isArray(data) ? ((data[0] as BaseRequestDto) || null) : (data as BaseRequestDto);
    }
    return (response as BaseRequestDto);
  }

  private syncOrderWithDepartment(
    orderId: number, 
    baseRequest: BaseRequestDto | null, 
    orders: OrderDto[]
  ): void {
    if (!baseRequest) return;
    const order = orders.find(o => o.id === orderId);
    if (order && (!order.department && !order.departmentNameEn && !order.departmentNameAr)) {
      if (baseRequest.departmentNameEn || baseRequest.departmentNameAr || baseRequest.departmentName) {
        order.departmentNameEn = baseRequest.departmentNameEn || baseRequest.departmentName;
        order.departmentNameAr = baseRequest.departmentNameAr;
      }
      if (baseRequest.department) {
        order.department = baseRequest.department;
      }
    }
  }

  private buildApprovalWorkflowFromSingle(
    baseRequest: BaseRequestDto | null,
    orderId: number,
    orders: OrderDto[],
    orderSummary: OrderSummary
  ): OrderReportApprovalStep[] {
    if (baseRequest) {
      this.updateSummaryFromBaseRequest(orderId, baseRequest, orders, orderSummary);
    }

    const requesterStep = this.buildRequesterStep(baseRequest, orderSummary);

    if (!baseRequest || !baseRequest.approvalHistory || baseRequest.approvalHistory.length === 0) {
      return [requesterStep];
    }

    const approvalSteps = this.mapApprovalHistorySteps(baseRequest);
    return [requesterStep, ...approvalSteps];
  }

  private buildRequesterStep(
    baseRequest?: BaseRequestDto | null, 
    orderSummary?: OrderSummary
  ): OrderReportApprovalStep {
    const currentLang = getCurrentLang(this.translate);
    const requesterRoleName: string = currentLang === 'ar'
      ? (baseRequest?.requesterNameAr || this.translate.instant('requestsManagement.orderReport.table.requester'))
      : (baseRequest?.requesterName || baseRequest?.requesterNameEn || this.translate.instant('requestsManagement.orderReport.table.requester'));

    const requesterApproverName: string = currentLang === 'ar' && baseRequest?.requesterNameAr
      ? baseRequest.requesterNameAr
      : baseRequest?.requesterNameEn || baseRequest?.requesterName || orderSummary?.requester || 'N/A';

    const requestDate = baseRequest?.requestDate || orderSummary?.requestDate;
    return {
      step: '1',
      role: requesterRoleName,
      approver: requesterApproverName,
      status: 'submitted',
      date: requestDate || null, // Raw date for pipe formatting
      notes: 'Request submitted'
    };
  }

  private mapApprovalHistorySteps(baseRequest: BaseRequestDto): OrderReportApprovalStep[] {
    const requestStatus = mapRequestStatus(baseRequest.status);
    const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory || [], requestStatus);

    const currentLang = getCurrentLang(this.translate);
    const mapped = workflowSteps.map((step, index) => {
      const parallelNote =
        step.eligibleParallelRoleNamesEn || step.eligibleParallelRoleNamesAr
          ? `${this.translate.instant('workflowApprovalDetail.parallelApproversLabel')}: ${
              currentLang === 'ar'
                ? step.eligibleParallelRoleNamesAr || step.eligibleParallelRoleNamesEn
                : step.eligibleParallelRoleNamesEn || step.eligibleParallelRoleNamesAr
            }`
          : '';

      const roleLine = [this.getLocalizedRoleName(step), parallelNote].filter(Boolean).join(' — ');

      const approverBase = this.getLocalizedApproverName(step);
      const extras: string[] = [];
      if (step.isDelegation === true || step.isDelegation === 1) {
        const changedByRoleName =
          currentLang === 'ar'
            ? step.changedByRoleNameAr || step.changedByRoleName
            : step.changedByRoleName || step.changedByRoleNameAr;
        const delegationMessage = this.translate.instant(this.getDelegationMessageKey(step.status));
        const delegationByRoleLabel = this.translate.instant('workflowApprovalDetail.delegationByRoleLabel');

        extras.push(
          changedByRoleName
            ? `${delegationMessage} ${delegationByRoleLabel} ${changedByRoleName}`
            : delegationMessage
        );
      } else {
        if (step.changedByRoleId && String(step.changedByRoleId) !== String(step.applicationRoleId || '')) {
          const actionLabel = this.translate.instant(this.getNonDelegationActionKey(step.status));
          const byLabel = this.translate.instant('workflowApprovalDetail.delegationByRoleLabel');
          const performedRoleName =
            currentLang === 'ar'
              ? step.changedByRoleNameAr || step.changedByRoleName || step.applicationRoleNameAr || step.applicationRoleName
              : step.changedByRoleName || step.changedByRoleNameAr || step.applicationRoleName || step.applicationRoleNameAr;

          extras.push(
            performedRoleName
              ? `${actionLabel} ${byLabel} ${performedRoleName}`
              : actionLabel
          );
        }
      }
      const approverLine = [approverBase, ...extras].filter(Boolean).join('\n');

      return {
        step: (step.steporder ? (step.steporder + 1) : (index + 2)).toString(),
        role: roleLine,
        approver: approverLine,
        status: step.status?.toLowerCase() as
          | 'pending'
          | 'submitted'
          | 'approved'
          | 'rejected'
          | 'auto-rejected'
          | 'autorejected'
          | 'cancelled'
          | 'in-progress'
          | 'returned'
          | 'returnedforreview' || 'pending',
        date: step.changedAt || null,
        notes: step.comments || ''
      };
    });

    // If the request ended by system auto-reject, the backend may still include future/pending steps.
    // For UX in Order Report, mark the last pending step as auto-rejected so the diagram reflects the terminal state.
    if (requestStatus === 'AutoRejected') {
      for (let i = mapped.length - 1; i >= 0; i--) {
        if (mapped[i].status === 'pending') {
          mapped[i] = { ...mapped[i], status: 'auto-rejected' };
          break;
        }
      }
    }

    if (requestStatus === 'Cancelled') {
      for (let i = mapped.length - 1; i >= 0; i--) {
        if (mapped[i].status === 'pending') {
          mapped[i] = { ...mapped[i], status: 'cancelled' };
          break;
        }
      }
    }

    return mapped;
  }

  private getDelegationMessageKey(status?: string): string {
    switch (status) {
      case 'Approved':
        return 'workflowApprovalDetail.approvedThroughDelegation';
      case 'Rejected':
        return 'workflowApprovalDetail.rejectedThroughDelegation';
      case 'AutoRejected':
        return 'workflowApprovalDetail.rejectedThroughDelegation';
      case 'Returned':
      case 'ReturnedForReview':
        return 'workflowApprovalDetail.returnedThroughDelegation';
      case 'Cancelled':
        return 'common.statuses.Cancelled';
      default:
        return 'workflowApprovalDetail.actedThroughDelegation';
    }
  }

  private getNonDelegationActionKey(status?: string): string {
    switch (status) {
      case 'Approved':
        return 'common.statuses.Approved';
      case 'Rejected':
        return 'common.statuses.Rejected';
      case 'AutoRejected':
        return 'common.statuses.AutoRejected';
      case 'Cancelled':
        return 'common.statuses.Cancelled';
      case 'Returned':
      case 'ReturnedForReview':
        return 'common.statuses.ReturnedForReview';
      default:
        return 'common.statuses.Pending';
    }
  }

  private buildFallbackApprovalSteps(
    orderId: number, 
    orders: OrderDto[], 
    orderSummary: OrderSummary
  ): OrderReportApprovalStep[] {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return [];
    }

    const fallbackSteps = generateApprovalWorkflowFallback(order)
      .map((step, index) => {
        // Convert the formatted date string back to raw date
        // The function returns formatted strings like "DD/MM/YYYY · HHmm - DD/MM/YYYY · HHmm"
        // We need to extract the first date or use usageDateFrom
        let rawDate: string | Date | null = null;
        if (step.date && step.date !== 'Pending' && step.date !== 'N/A') {
          // Try to extract date from formatted string, or use order.usageDateFrom
          rawDate = order.usageDateFrom || null;
        }
        
        return {
          ...step,
          step: (index + 2).toString(),
          date: rawDate
        };
      });

    const requesterStep = this.createRequesterStepFromOrder(order, orderSummary);
    if (!requesterStep) {
      return fallbackSteps;
    }

    return [requesterStep, ...fallbackSteps];
  }

  private createRequesterStepFromOrder(
    order: OrderDto, 
    orderSummary: OrderSummary
  ): OrderReportApprovalStep | null {
    const requesterRoleName = this.translate.instant('requestsManagement.orderReport.table.requester');
    const currentLang = getCurrentLang(this.translate);
    const requesterApproverName: string = order.requester
      ? (getLocalizedName(order.requester, currentLang) || order.requester.userName || 'N/A')
      : (currentLang === 'ar' && order.requesterNameAr
        ? order.requesterNameAr
        : order.requesterNameEn || order.requesterName || orderSummary.requester || 'N/A');

    const requestDate = orderSummary.requestDate || orderSummary.submittedOn;
    return {
      step: '1',
      role: requesterRoleName,
      approver: requesterApproverName,
      status: 'submitted',
      date: requestDate || null, // Raw date for pipe formatting
      notes: 'Request submitted'
    };
  }

  private updateSummaryFromBaseRequest(
    orderId: number, 
    baseRequest: BaseRequestDto, 
    orders: OrderDto[],
    orderSummary: OrderSummary
  ): void {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return;
    }

    const updatedSummary = mapOrderToSummary(order, baseRequest.status, this.translate);

    // Update requestDate from baseRequest if available, otherwise keep the fallback from order
    // Update requestDate with raw date for pipe formatting
    if (baseRequest.requestDate) {
      updatedSummary.requestDate = baseRequest.requestDate;
    } else if (baseRequest.creationDate && !updatedSummary.requestDate) {
      updatedSummary.requestDate = baseRequest.creationDate;
    }

    if ((!updatedSummary.department || updatedSummary.department === 'N/A') &&
      (baseRequest.departmentNameEn || baseRequest.departmentNameAr || baseRequest.departmentName)) {
      const currentLang = getCurrentLang(this.translate);
      updatedSummary.department = getLocalizedName(
        {
          nameEn: baseRequest.departmentNameEn || baseRequest.departmentName,
          nameAr: baseRequest.departmentNameAr
        },
        currentLang
      ) || 'N/A';
    }

    if (baseRequest.usageDateFrom !== undefined) {
      updatedSummary.usageDateFrom = baseRequest.usageDateFrom ?? null;
    }
    if (baseRequest.usageTimeFrom !== undefined) {
      updatedSummary.usageTimeFrom = baseRequest.usageTimeFrom ?? null;
    }
    if (baseRequest.usageDateTo !== undefined) {
      updatedSummary.usageDateTo = baseRequest.usageDateTo ?? null;
    }
    if (baseRequest.usageTimeTo !== undefined) {
      updatedSummary.usageTimeTo = baseRequest.usageTimeTo ?? null;
    }

    // Update lastUpdated with raw date for pipe formatting
    if (!updatedSummary.lastUpdated) {
      updatedSummary.lastUpdated = baseRequest.requestDate || baseRequest.creationDate || null;
    }

    // Update orderSummary properties
    Object.assign(orderSummary, updatedSummary);
  }

  private rebuildRoleMap(currentLang: string): void {
    this.roleMap = new Map(
      this.roles.map(role => [
        role.id,
        getLocalizedName(role, currentLang) || role.name || role.id
      ])
    );
  }

  private mergeRequestDetail(cached: OrderDto, detail: OrderDto): OrderDto {
    const merged: OrderDto = { ...cached, ...detail };
    const detailRecord = detail as unknown as Record<string, unknown>;
    const detailItems =
      detail.requestItems ??
      (detailRecord['RequestItems'] as OrderDto['requestItems']);

    if (Array.isArray(detailItems) && detailItems.length > 0) {
      merged.requestItems = detailItems;
    }

    return merged;
  }
}

import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { map, catchError, tap, takeUntil } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@services/api.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { OrderDto } from '@models/order.model';
import { RoleDto } from '@models/backend-user.model';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep } from '@models/order-report.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import { 
  mapOrderToSummary, 
  mapOrderItems, 
  generateApprovalWorkflowFallback 
} from '../../utils/order-report.utils';
import { 
  mapApprovalHistory, 
  mapRequestStatus 
} from '@utils/request-mapper.utils';
import { 
  getLocalizedName, 
  getCurrentLang 
} from '@utils/localization.utils';
import { formatDateShort, formatTimeToMilitary } from '@utils/format.utils';

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
    private translate: TranslateService
  ) {}

  /**
   * Load orders from API
   */
  loadOrders(): Observable<OrderDto[]> {
    return this.apiService.getWithAuth<OrderDto[]>('/Request/user-actions')
      .pipe(
        map((res: any) => Array.isArray(res) ? res as OrderDto[] : (res?.data || [] as OrderDto[])),
        map((orders: OrderDto[]) => {
          // Sort orders by ID
          return orders.sort((a, b) => (a.id || 0) - (b.id || 0));
        }),
        catchError((error) => {
          console.error('Failed to load requests', error);
          this.toastService.error('Failed to load request list. Please try again.');
          return of([] as OrderDto[]);
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
    return this.apiService.getWithAuth<any>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.BASE_REQUEST_BY_ID(orderId)
    )
      .pipe(
        map((response: any) => this.extractSingleBaseRequest(response)),
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
  mapOrderToReport(order: OrderDto, baseRequestStatus?: number | string | null): {
    summary: OrderSummary;
    items: OrderReportItem[];
  } {
    const summary = mapOrderToSummary(order, baseRequestStatus, this.translate);
    const items = mapOrderItems(order);
    
    return { summary, items };
  }

  /**
   * Filter orders based on search term
   */
  filterOrders(
    orders: OrderDto[], 
    searchTerm: string,
    getDepartmentName: (order: OrderDto) => string,
    getStatusLabel: (status: number | string) => string,
    getPriorityLabel: (priority: number | string) => string
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
  getLocalizedRoleName(step: any): string {
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
  getLocalizedApproverName(step: any): string {
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

  private extractSingleBaseRequest(response: any): BaseRequestDto | null {
    if (!response) return null;
    if (Array.isArray(response)) {
      return response[0] || null;
    }
    if (response?.data) {
      return Array.isArray(response.data) ? (response.data[0] || null) : response.data;
    }
    return response as BaseRequestDto;
  }

  private syncOrderWithDepartment(
    orderId: number, 
    baseRequest: BaseRequestDto | null, 
    orders: OrderDto[]
  ): void {
    if (!baseRequest) return;
    const order = orders.find(o => o.id === orderId);
    if (order && (!order.department && !order.departmentNameEn && !order.departmentNameAr)) {
      if (baseRequest['departmentNameEn'] || baseRequest['departmentNameAr'] || baseRequest['departmentName']) {
        order.departmentNameEn = baseRequest['departmentNameEn'] || baseRequest['departmentName'];
        order.departmentNameAr = baseRequest['departmentNameAr'];
      }
      if (baseRequest['department']) {
        order.department = baseRequest['department'];
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
      status: 'approved',
      date: requestDate || null, // Raw date for pipe formatting
      notes: 'Request submitted'
    };
  }

  private mapApprovalHistorySteps(baseRequest: BaseRequestDto): OrderReportApprovalStep[] {
    const requestStatus = mapRequestStatus(baseRequest.status);
    const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory || [], requestStatus);

    return workflowSteps.map((step, index) => ({
      step: (step.steporder ? (step.steporder + 1) : (index + 2)).toString(),
      role: this.getLocalizedRoleName(step),
      approver: this.getLocalizedApproverName(step),
      status: step.status?.toLowerCase() as 'pending' | 'approved' | 'rejected' | 'in-progress' | 'returned' | 'returnedforreview' || 'pending',
      // Use changedAt (raw date) instead of approvedDateTime (already formatted)
      // changedAt should have time information from the backend
      date: step.changedAt || null, // Raw date for pipe formatting
      notes: step.comments || ''
    }));
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

    const fallbackSteps = generateApprovalWorkflowFallback(order, (d, t) => {
      // Return raw date string, formatting will be done by pipe
      // The function expects a string, so return empty string if no date
      return d || '';
    })
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
      status: 'approved',
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
      (baseRequest['departmentNameEn'] || baseRequest['departmentNameAr'] || baseRequest['departmentName'])) {
      const currentLang = getCurrentLang(this.translate);
      updatedSummary.department = getLocalizedName(
        {
          nameEn: baseRequest['departmentNameEn'] || baseRequest['departmentName'],
          nameAr: baseRequest['departmentNameAr']
        },
        currentLang
      ) || 'N/A';
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
}

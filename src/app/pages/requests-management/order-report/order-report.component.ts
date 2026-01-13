import { Component, ElementRef, ViewChild, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileDown, Printer, ArrowRight, CheckCircle2, Clock4, QrCode, ArrowLeft } from 'lucide-angular';
import { Subject, takeUntil, of, Observable } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import QRCode from 'qrcode';
import { OrderService, OrderDto } from '@services/order.service';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';
import { ToastService } from '@services/toast.service';
import { ApiService } from '@services/api.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { mapOrderStatusFromApi } from '@utils/status.utils';
import { formatOrderDateTime } from '@utils/date.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { formatDate, formatTimeToMilitary } from '@utils/format.utils';
import { mapApprovalHistory, mapRequestStatus, RequestTypeEnum, formatRequestDateTime, formatRequestDate } from '@utils/request-mapper.utils';
import { filterRequestsByDepartment } from '@utils/dashboard.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import {
  mapOrderToSummary,
  mapOrderItems,
  mapApprovalRecordsToSteps,
  generateApprovalWorkflowFallback,
  generateQrCodeData,
  filterApprovalRecordsByOrderId
} from '../utils/order-report.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-order-report',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './order-report.component.html',
  styleUrls: ['./order-report.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderReportComponent implements OnInit, OnDestroy {
  @ViewChild('reportContent') reportContent?: ElementRef<HTMLDivElement>;

  readonly FileDown = FileDown;
  readonly Printer = Printer;
  readonly ArrowRight = ArrowRight;
  readonly ArrowLeft = ArrowLeft;
  readonly CheckCircle2 = CheckCircle2;
  readonly Clock4 = Clock4;
  readonly QrCode = QrCode;

  private destroy$ = new Subject<void>();
  ordersLoading = false;
  detailsLoading = false;
  ordersError: string | null = null;
  errorMessage: string | null = null;
  qrCodeDataUrl: string | null = null;
  orders: OrderDto[] = [];
  selectedOrderId: number | null = null;

  orderSummary: OrderSummary = {
    orderId: '',
    status: '',
    priority: '',
    submittedOn: '',
    requestDate: '',
    department: '',
    requester: '',
    usagePurpose: '',
    totalItems: 0,
    totalQuantity: 0,
    lastUpdated: ''
  };

  orderItems: OrderReportItem[] = [];
  approvalWorkflow: OrderReportApprovalStep[] = [];
  workflowDetails: WorkflowDetail[] = [];
  approvalWorkflowStatus: string = '';
  roles: RoleDto[] = [];
  roleMap: Map<string, string> = new Map();
  currentDate: string = '';
  currentUser: string = '';
  logoDataUrl: string = '/assets/organization-logo.png'; // Organization logo - absolute path from root

  constructor(
    private router: Router,
    private orderService: OrderService,
    private returnService: ReturnService,
    private discardService: DiscardService,
    private toastService: ToastService,
    private apiService: ApiService,
    private authService: BackendAuthService,
    private backendUserService: BackendUserService,
    private translationService: TranslationService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  ngOnInit(): void {
    this.currentDate = new Date().toLocaleDateString(this.translate.currentLang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const user = this.authService.getCurrentUser();
    this.currentUser = user?.userName || user?.email || 'N/A';

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.selectedOrderId) {
          this.loadOrder(this.selectedOrderId);
        }
        this.cdr.markForCheck();
      });

    // Directly load orders; skip roles/me fetches to reduce calls
    this.loadOrders();
  }

  private loadRoles(): Observable<void> {
    if (this.roles.length > 0) {
      this.rebuildRoleMap(getCurrentLang(this.translate));
      return of(void 0);
    }

    return this.backendUserService.getRoles()
      .pipe(
        takeUntil(this.destroy$),
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

  private rebuildRoleMap(currentLang: string): void {
    this.roleMap = new Map(
      this.roles.map(role => [
        role.id,
        getLocalizedName(role, currentLang) || role.name || role.id
      ])
    );
  }

  private getRoleName(roleId?: string | null): string {
    if (!roleId) return 'N/A';
    return this.roleMap.get(roleId) || roleId;
  }

  private getLocalizedRoleName(step: any): string {
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

  private getLocalizedApproverName(step: any): string {
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.ordersLoading = true;
    this.ordersError = null;

    // Use user-actions endpoint (relative path to avoid double base URL prefixing)
    this.apiService.getWithAuth<OrderDto[]>('/Request/user-actions')
      .pipe(
        takeUntil(this.destroy$),
        map((res: any) => Array.isArray(res) ? res as OrderDto[] : (res?.data || [] as OrderDto[])),
        catchError(() => of([] as OrderDto[]))
      )
      .subscribe({
        next: (orders) => {
          const allRequests = [...orders];
          this.orders = allRequests.sort((a, b) => (a.id || 0) - (b.id || 0));

          this.ordersLoading = false;
          this.selectedOrderId = null;
          this.resetReportData();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load requests', error);
          this.ordersError = 'Failed to load request list. Please try again.';
          this.toastService.error(this.ordersError);
          this.ordersLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  selectOrder(order: OrderDto): void {
    if (!order || !order.id) {
      return;
    }
    this.selectedOrderId = order.id;
    this.loadOrder(order.id);
  }

  loadOrder(id: number): void {
    this.detailsLoading = true;
    this.errorMessage = null;
    this.approvalWorkflow = [];
    this.workflowDetails = [];
    this.approvalWorkflowStatus = '';
    this.cdr.markForCheck();

    const request = this.orders.find(r => r.id === id);
    if (!request) {
      this.errorMessage = 'Request not found.';
      this.toastService.error(this.errorMessage);
      this.detailsLoading = false;
      return;
    }

    // user-action API already returns full order details; use the cached entry
    this.mapOrderToReport(request);
    this.generateQrCode();
    this.detailsLoading = false;
    this.cdr.markForCheck();
  }

  private mapOrderToReport(order: OrderDto): void {
    this.orderSummary = mapOrderToSummary(order, undefined, this.translate);
    this.orderItems = mapOrderItems(order);
    this.cdr.markForCheck();

    this.loadApprovalWorkflow(order.id);
    this.loadWorkflowDetails(order);
  }


  private loadApprovalWorkflow(orderId: number): void {
    this.apiService.getWithAuth<any>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.BASE_REQUEST_BY_ID(orderId)
    )
      .pipe(
        takeUntil(this.destroy$),
        map((response: any) => this.extractSingleBaseRequest(response)),
        tap((baseRequest) => this.syncOrderWithDepartment(orderId, baseRequest)),
        map((baseRequest) => this.buildApprovalWorkflowFromSingle(baseRequest, orderId)),
        catchError((error) => {
          console.error('Failed to load approval workflow', error);
          return of(this.buildFallbackApprovalSteps(orderId));
        })
      )
      .subscribe({
        next: (steps) => {
          this.approvalWorkflow = steps;
          if (!this.orderSummary.lastUpdated || this.orderSummary.lastUpdated.trim() === '') {
            const requestDateOnly = this.orderSummary.requestDate
              ? this.orderSummary.requestDate.split(' ').slice(0, 3).join(' ')
              : 'N/A';
            this.orderSummary.lastUpdated = requestDateOnly;
          }
        },
        error: (error) => {
          console.error('Error loading approval workflow', error);
          this.approvalWorkflow = this.buildFallbackApprovalSteps(orderId);
          this.cdr.markForCheck();
        }
      });
  }

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

  private syncOrderWithDepartment(orderId: number, baseRequest: BaseRequestDto | null): void {
    if (!baseRequest) return;
    const order = this.orders.find(o => o.id === orderId);
    if (order && (!order.department && !order.departmentNameEn && !order.departmentNameAr)) {
      if (baseRequest['departmentNameEn'] || baseRequest['departmentNameAr'] || baseRequest['departmentName']) {
        order.departmentNameEn = baseRequest['departmentNameEn'] || baseRequest['departmentName'];
        order.departmentNameAr = baseRequest['departmentNameAr'];
      }
      if (baseRequest['department']) {
        order.department = baseRequest['department'];
      }
    }
    this.cdr.markForCheck();
  }

  private updateSummaryFromBaseRequest(orderId: number, baseRequest: BaseRequestDto): void {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) {
      return;
    }

    const updatedSummary = mapOrderToSummary(order, baseRequest.status, this.translate);

    if (baseRequest.requestDate) {
      updatedSummary.requestDate = formatRequestDate(baseRequest.requestDate);
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

    if (!updatedSummary.lastUpdated || updatedSummary.lastUpdated.trim() === '') {
      updatedSummary.lastUpdated = formatRequestDate(baseRequest.requestDate) || 'N/A';
    }

    if (updatedSummary.orderId && updatedSummary.orderId.trim() !== '') {
      this.orderSummary = updatedSummary;
      this.generateQrCode();
      this.cdr.markForCheck();
    }
  }

  private buildApprovalWorkflowFromSingle(baseRequest: BaseRequestDto | null, orderId: number): OrderReportApprovalStep[] {
    if (baseRequest) {
      this.updateSummaryFromBaseRequest(orderId, baseRequest!);
    }

    const requesterStep = this.buildRequesterStep(baseRequest);

    if (!baseRequest || !baseRequest.approvalHistory || baseRequest.approvalHistory.length === 0) {
      return [requesterStep];
    }

    const approvalSteps = this.mapApprovalHistorySteps(baseRequest);
    return [requesterStep, ...approvalSteps];
  }

  private buildRequesterStep(baseRequest?: BaseRequestDto | null): OrderReportApprovalStep {
    const currentLang = getCurrentLang(this.translate);
    const requesterRoleName: string = currentLang === 'ar'
      ? (baseRequest?.requesterNameAr || this.translate.instant('requestsManagement.orderReport.table.requester'))
      : (baseRequest?.requesterName || baseRequest?.requesterNameEn || this.translate.instant('requestsManagement.orderReport.table.requester'));

    const requesterApproverName: string = currentLang === 'ar' && baseRequest?.requesterNameAr
      ? baseRequest.requesterNameAr
      : baseRequest?.requesterNameEn || baseRequest?.requesterName || this.orderSummary.requester || 'N/A';

    return {
      step: '1',
      role: requesterRoleName,
      approver: requesterApproverName,
      status: 'approved',
      date: baseRequest?.requestDate ? formatRequestDateTime(baseRequest.requestDate) : (this.orderSummary.requestDate || 'N/A'),
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
      date: step.approvedDateTime || formatOrderDateTime(step.changedAt?.toString(), undefined),
      notes: step.comments || ''
    }));
  }

  private buildFallbackApprovalSteps(orderId: number): OrderReportApprovalStep[] {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) {
      return [];
    }

    const fallbackSteps = generateApprovalWorkflowFallback(order, (d, t) => formatOrderDateTime(d, t))
      .map((step, index) => ({
        ...step,
        step: (index + 2).toString()
      }));

    const requesterStep = this.createRequesterStepFromOrder(order);
    if (!requesterStep) {
      return fallbackSteps;
    }

    return [requesterStep, ...fallbackSteps];
  }

  private createRequesterStepFromOrder(order: OrderDto): OrderReportApprovalStep | null {
    const requesterRoleName = this.translate.instant('requestsManagement.orderReport.table.requester');
    const currentLang = getCurrentLang(this.translate);
    const requesterApproverName: string = order.requester
      ? (getLocalizedName(order.requester, currentLang) || order.requester.userName || 'N/A')
      : (currentLang === 'ar' && order.requesterNameAr
        ? order.requesterNameAr
        : order.requesterNameEn || order.requesterName || this.orderSummary.requester || 'N/A');

    return {
      step: '1',
      role: requesterRoleName,
      approver: requesterApproverName,
      status: 'approved',
      date: this.orderSummary.requestDate || this.orderSummary.submittedOn || 'N/A',
      notes: 'Request submitted'
    };
  }


  private loadWorkflowDetails(order: OrderDto): void {
    this.workflowDetails = [];
  }

  goBack(): void {
    this.router.navigate(['/requests-management']);
  }

  async generateQrCode(): Promise<void> {
    if (!this.orderSummary.orderId) {
      return;
    }
    try {
      const qrData = this.orderSummary.orderId;
      this.qrCodeDataUrl = await QRCode.toDataURL(
        qrData,
        {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'H'
        }
      );
    } catch (error) {
      console.error('Failed to generate QR code', error);
      this.qrCodeDataUrl = null;
    }
  }


  getStatusLabel(status: number | string): string {
    return mapOrderStatusFromApi(status);
  }

  getPriorityLabel(priority: number | string): string {
    return mapOrderPriorityToString(priority);
  }

  getPriorityColorClass(priority: number | string): string {
    const priorityLabel = this.getPriorityLabel(priority).toLowerCase();
    if (priorityLabel === 'normal') {
      return 'priority-normal';
    } else if (priorityLabel === 'urgent') {
      return 'priority-urgent';
    } else if (priorityLabel === 'veryurgent') {
      return 'priority-veryurgent';
    }
    return 'priority-normal'; // default
  }

  getDepartmentName(order: OrderDto): string {
    if (!order) return this.translate.instant('requestsManagement.orderReport.list.unknown');
    const currentLang = getCurrentLang(this.translate);

    if (order.department) {
      const localized = getLocalizedName(order.department, currentLang);
      if (localized) return localized;
    }

    if (order.departmentNameEn || order.departmentNameAr) {
      const localized = getLocalizedName(
        { nameEn: order.departmentNameEn, nameAr: order.departmentNameAr },
        currentLang
      );
      if (localized) return localized;
    }

    return this.translate.instant('requestsManagement.orderReport.list.unknown');
  }

  getOrderDateLabel(order: OrderDto): string {
    if (!order.usageDateFrom) return '-';

    const formatTime = (timeStr: string | null | undefined): string => {
      if (!timeStr) return '';
      if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        return timeStr;
      }
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';
        return hours + minutes;
      }
      return timeStr;
    };

    const fromDate = formatDate(order.usageDateFrom);
    const toDate = order.usageDateTo ? formatDate(order.usageDateTo) : '';
    const fromTime = formatTimeToMilitary(order.usageTimeFrom);
    const toTime = formatTimeToMilitary(order.usageTimeTo);

    return toDate
      ? `${fromDate} ${fromTime ? '· ' + fromTime : ''} - ${toDate} ${toTime ? '· ' + toTime : ''}`.trim()
      : `${fromDate}${fromTime ? ' · ' + fromTime : ''}`;
  }

  trackByOrderId(_: number, order: OrderDto): number | undefined {
    return order.id;
  }

  private resetReportData(): void {
    this.orderSummary = {
      orderId: '',
      status: '',
      priority: '',
      submittedOn: '',
      requestDate: '',
      department: '',
      requester: '',
      usagePurpose: '',
      totalItems: 0,
      totalQuantity: 0,
      lastUpdated: ''
    };
    this.orderItems = [];
    this.approvalWorkflow = [];
    this.workflowDetails = [];
    this.approvalWorkflowStatus = '';
    this.qrCodeDataUrl = null;
  }

  private convertReturnToOrderDto(returnDto: ReturnDto): OrderDto {
    return {
      id: returnDto.id,
      requestNo: returnDto.requestNo,
      orderNo: returnDto.requestNo || `#${returnDto.id}`,
      requestType: RequestTypeEnum.Return,
      reason: returnDto.reason,
      priority: returnDto.priority,
      status: returnDto.status,
      notes: returnDto.notes,
      departmentId: returnDto.departmentId,
      requesterId: returnDto.requesterId?.toString() || null,
      recieverId: returnDto.recieverId?.toString() || null,
      depotId: returnDto.depotId || null,
      requestPurposeId: returnDto.requestPurposeId,
      isFromAllowance: false,
      usagePurpose: returnDto.requestPurpose?.nameEn || returnDto.requestPurpose?.nameAr || undefined,
      departmentNameAr: returnDto.department?.nameAr,
      departmentNameEn: returnDto.department?.nameEn,
      requesterName: returnDto.requester?.fullNameEN || returnDto.requester?.fullNameAR || returnDto.requester?.userName,
      recieverName: undefined,
      depotNameAr: undefined,
      depotNameEn: undefined,
      requestPurposeNameAr: returnDto.requestPurpose?.nameAr,
      requestPurposeNameEn: returnDto.requestPurpose?.nameEn,
      requestItems: this.mapRequestItems(returnDto.requestItems)
    };
  }

  private convertDiscardToOrderDto(discardDto: DiscardDto): OrderDto {
    return {
      id: discardDto.id,
      requestNo: discardDto.requestNo,
      orderNo: discardDto.requestNo || `#${discardDto.id}`,
      requestType: RequestTypeEnum.Discard,
      reason: discardDto.reason,
      priority: discardDto.priority,
      status: discardDto.status,
      notes: discardDto.notes,
      departmentId: discardDto.departmentId,
      requesterId: discardDto.requesterId?.toString() || null,
      recieverId: discardDto.recieverId?.toString() || null,
      depotId: discardDto.depotId || null,
      requestPurposeId: discardDto.requestPurposeId,
      isFromAllowance: false,
      usagePurpose: discardDto.requestPurpose?.nameEn || discardDto.requestPurpose?.nameAr || undefined,
      departmentNameAr: discardDto.department?.nameAr,
      departmentNameEn: discardDto.department?.nameEn,
      requesterName: discardDto.requester?.fullNameEN || discardDto.requester?.fullNameAR || discardDto.requester?.userName,
      recieverName: undefined,
      depotNameAr: undefined,
      depotNameEn: undefined,
      requestPurposeNameAr: discardDto.requestPurpose?.nameAr,
      requestPurposeNameEn: discardDto.requestPurpose?.nameEn,
      requestItems: this.mapRequestItems(discardDto.requestItems)
    };
  }

  private mapRequestItems(items?: Array<{
    id: number;
    itemId: number;
    quantity: number;
    notes?: string;
    itemName?: string;
    itemNo?: string;
  }>): Array<{
    id: number;
    itemId: number;
    quantity: number;
    notes?: string;
    itemName?: string;
    itemNo?: string;
  }> {
    return items?.map(item => ({
      id: item.id,
      itemId: item.itemId,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
      itemName: item.itemName ?? undefined,
      itemNo: item.itemNo ?? undefined
    })) || [];
  }

  printReport(): void {
    if (!this.reportContent) {
      return;
    }

    const printContents = this.reportContent.nativeElement.innerHTML;
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <base href="/">
          <meta name="url" content="">
          <title>Request Report - ${this.orderSummary.orderId}</title>
          <style>
            @page {
              size: A4;
              margin: 0.8cm 1.5cm 1.5cm 1.5cm;
            }
            
            @page {
              @bottom-left {
                content: none;
              }
              @bottom-center {
                content: none;
              }
              @bottom-right {
                content: none;
              }
            }
            
            * {
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              print-color-adjust: exact;
            }
            
            body {
              font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
              margin: 0;
              padding: 0;
              color: #000000;
              background: #ffffff;
              font-size: 11pt;
              line-height: 1.4;
              direction: ${this.isRTL ? 'rtl' : 'ltr'};
            }
            
            /* Hide non-printable elements */
            button, aside, .no-print {
              display: none !important;
            }
            
            /* Report container */
            .print-report-content {
              max-width: 100%;
              margin: 0;
              padding: 0;
            }
            
            /* Header section with Logo centered and QR on right */
            .print-header {
              margin-bottom: 20px;
              page-break-after: avoid;
            }
            
            .print-header-content {
              display: flex !important;
              justify-content: center !important;
              align-items: flex-start !important;
              margin-bottom: 15px !important;
              position: relative !important;
              min-height: 120px !important;
            }
            
            .print-logo-center {
              flex: 1 !important;
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
            }
            
            .print-logo,
            img[alt="Organization Logo"] {
              display: block !important;
              visibility: visible !important;
              max-width: 200px !important;
              max-height: 100px !important;
              height: auto !important;
              object-fit: contain !important;
            }
            
            .print-qr-container {
              position: absolute !important;
              right: 0 !important;
              top: -10px !important;
              text-align: center !important;
              border: none !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            
            .print-qr-code,
            img[alt="Order QR Code"] {
              width: 100px !important;
              height: 100px !important;
              display: block !important;
              margin: 0 auto 5px auto !important;
              border: none !important;
              padding: 5px !important;
              background: #ffffff !important;
            }
            
            .print-qr-label {
              font-size: 9pt !important;
              font-weight: bold !important;
              color: #000 !important;
              margin: 0 !important;
              text-align: center !important;
            }
            
            .print-divider {
              border-bottom: none !important;
              margin-top: 10px !important;
              margin-bottom: 15px !important;
            }
            
            /* Sections */
            .print-section,
            section {
              break-inside: avoid;
              page-break-inside: avoid;
              border: 2px solid #000 !important;
              border-radius: 0 !important;
              padding: 12px !important;
              margin-bottom: 15px !important;
              background: #ffffff !important;
              box-shadow: none !important;
            }
            
            .print-section-title {
              font-size: 14pt !important;
              font-weight: bold !important;
              color: #000 !important;
              margin: 0 0 8px 0 !important;
              padding-bottom: 6px !important;
            }
            
            .print-info-grid {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 8px 15px !important;
              margin-bottom: 0 !important;
              margin-top: 0 !important;
            }
            
            .print-info-item {
              display: flex !important;
              padding: 6px 0 !important;
              border-bottom: 1px solid #ddd !important;
              margin: 0 !important;
            }
            
            .print-info-label {
              font-weight: bold !important;
              color: #333 !important;
              min-width: 120px !important;
              font-size: 9pt !important;
            }
            
            .print-info-value {
              color: #000 !important;
              font-size: 9pt !important;
              flex: 1 !important;
            }
            
            .order-info-section {
              position: relative !important;
            }
            
            .print-section-header {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              margin-bottom: 8px !important;
              padding-bottom: 6px !important;
              border-bottom: 2px solid #000 !important;
            }
            
            .print-section-title {
              margin: 0 !important;
              padding-bottom: 0 !important;
            }
            
            .allowance-badge {
              background: #f5f5f5 !important;
              padding: 4px 12px !important;
              border: none !important;
              border-radius: 6px !important;
              font-size: 10pt !important;
              font-weight: bold !important;
              color: #000 !important;
              white-space: nowrap !important;
              line-height: 1.4 !important;
              margin: 0 !important;
            }
            
            .priority-value.priority-normal {
              color: #22c55e !important;
            }
            
            .priority-value.priority-urgent {
              color: #f97316 !important;
            }
            
            .priority-value.priority-veryurgent {
              color: #ef4444 !important;
            }
            
            /* Professional Tables */
            .print-table,
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 10px !important;
              page-break-inside: avoid !important;
              border: 2px solid #000 !important;
            }
            
            .print-table-header,
            table thead th {
              background-color: #333 !important;
              color: #ffffff !important;
              font-weight: bold !important;
              font-size: 10pt !important;
              padding: 6px 12px !important;
              text-align: left !important;
              border: 1px solid #000 !important;
            }
            
            .print-table-cell,
            table tbody td {
              padding: 6px 12px !important;
              border: 1px solid #333 !important;
              font-size: 10pt !important;
              color: #000 !important;
            }
            
            .print-table-row:nth-child(even),
            table tbody tr:nth-child(even) {
              background-color: #f9f9f9 !important;
            }
            
            .print-table-footer,
            table tfoot tr {
              background-color: #e8e8e8 !important;
              font-weight: bold !important;
            }
            
            .print-table-footer-cell,
            table tfoot td {
              padding: 6px 12px !important;
              border: 1px solid #000 !important;
              font-size: 10pt !important;
              font-weight: bold !important;
              color: #000 !important;
            }
            
            /* Approval Workflow Cards */
            .approval-workflow-cards {
              display: grid !important;
              grid-template-columns: repeat(4, 1fr) !important;
              gap: 6px !important;
              margin-top: 8px !important;
            }
            
            .approval-card {
              border: 1px solid #333 !important;
              border-radius: 0 !important;
              background: #ffffff !important;
              page-break-inside: avoid !important;
              overflow: hidden !important;
              font-size: 7pt !important;
            }
            
            .approval-card-header {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              padding: 4px 6px !important;
              background: #f5f5f5 !important;
              border-bottom: 1px solid #333 !important;
            }
            
            .approval-step-number {
              font-weight: bold !important;
              font-size: 7pt !important;
              color: #000 !important;
              background: #fff !important;
              border: 1px solid #333 !important;
              padding: 1px 5px !important;
              border-radius: 0 !important;
            }
            
            .approval-status {
              font-size: 6.5pt !important;
              font-weight: bold !important;
              padding: 2px 5px !important;
              border-radius: 0 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.2px !important;
            }
            
            .approval-status.status-approved {
              background: #d4edda !important;
              color: #155724 !important;
              border: 1px solid #155724 !important;
            }
            
            .approval-status.status-rejected {
              background: #f8d7da !important;
              color: #721c24 !important;
              border: 1px solid #721c24 !important;
            }
            
            .approval-status.status-pending {
              background: #fff3cd !important;
              color: #856404 !important;
              border: 1px solid #856404 !important;
            }
            
            .approval-status.status-in-progress {
              background: #d1ecf1 !important;
              color: #0c5460 !important;
              border: 1px solid #0c5460 !important;
            }
            
            .approval-card-body {
              padding: 5px 6px !important;
            }
            
            .approval-role {
              font-weight: bold !important;
              font-size: 7pt !important;
              color: #000 !important;
              margin-bottom: 2px !important;
            }
            
            .approval-approver {
              font-size: 6.5pt !important;
              color: #333 !important;
              margin-bottom: 2px !important;
            }
            
            .approval-date {
              font-size: 6pt !important;
              color: #666 !important;
              margin-bottom: 2px !important;
            }
            
            .approval-notes {
              font-size: 6pt !important;
              color: #444 !important;
              margin-top: 3px !important;
              padding-top: 3px !important;
              border-top: 1px dashed #ccc !important;
              line-height: 1.2 !important;
            }
            
            .approval-notes .notes-label {
              font-weight: bold !important;
              color: #000 !important;
              font-size: 6pt !important;
            }
            
            /* Headers */
            h1, h2, h3, h4 {
              color: #000000 !important;
              margin: 0.5rem 0 !important;
              page-break-after: avoid;
            }
            
            h2 {
              font-size: 18pt !important;
              font-weight: bold !important;
            }
            
            h3 {
              font-size: 14pt !important;
              font-weight: bold !important;
            }
            
            h4 {
              font-size: 12pt !important;
              font-weight: bold !important;
            }
            
            /* Remove backgrounds */
            .bg-gradient-to-br,
            .bg-gradient-to-r,
            .bg-white,
            .bg-slate-50,
            .bg-blue-50,
            .bg-indigo-100,
            .bg-green-100 {
              background: #ffffff !important;
            }
            
            .bg-gradient-to-r.from-slate-900,
            .bg-gradient-to-r.from-slate-800 {
              background: #000000 !important;
              color: #ffffff !important;
            }
            
            /* Text colors */
            .text-slate-900,
            .text-slate-700,
            .text-slate-600,
            .text-slate-500 {
              color: #000000 !important;
            }
            
            .text-white {
              color: #ffffff !important;
            }
            
            /* Badges */
            span[class*="bg-"],
            div[class*="bg-"] {
              background: #f0f0f0 !important;
              border: 1px solid #000 !important;
              color: #000000 !important;
            }
            
            /* Remove effects */
            .shadow-lg,
            .shadow-xl,
            .shadow-sm {
              box-shadow: none !important;
            }
            
            /* Spacing */
            .space-y-6 > * + * {
              margin-top: 1rem !important;
            }
            
            .p-8, .p-6, .p-5, .p-4 {
              padding: 0.75rem !important;
            }
            
            /* Hide icons */
            lucide-angular {
              display: none !important;
            }
            
            /* Page breaks */
            .page-break-before {
              page-break-before: always;
            }
            
            .page-break-after {
              page-break-after: always;
            }
            
            /* Print specific adjustments */
            .rounded-2xl {
              border-radius: 0 !important;
            }
            
            /* Ensure tables don't break */
            table, .grid {
              page-break-inside: avoid;
            }
            
            tr {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  resolveUsagePurpose(): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(
      {
        nameEn: this.orderSummary.requestPurposeNameEn,
        nameAr: this.orderSummary.requestPurposeNameAr
      },
      currentLang
    ) || this.orderSummary.usagePurpose || 'N/A';
  }
}

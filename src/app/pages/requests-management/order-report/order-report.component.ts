import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileDown, Printer, ArrowRight, CheckCircle2, Clock4, QrCode, ArrowLeft } from 'lucide-angular';
import { Subject, takeUntil, forkJoin, of, Observable, firstValueFrom } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
import { formatDate } from '@utils/format.utils';
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
  styleUrls: ['./order-report.component.css']
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
  isExportingPdf = false;
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
    private translate: TranslateService
  ) { }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  ngOnInit(): void {
    // Load roles first, then load orders to ensure roleMap is populated before use
    this.loadRoles().subscribe({
      next: () => {
        // Roles loaded successfully, now load orders
        this.loadOrders();
      },
      error: () => {
        // Even if roles fail to load, continue with orders (will show IDs if needed)
        this.loadOrders();
      }
    });
  }

  private loadRoles(): Observable<void> {
    return this.backendUserService.getRoles()
      .pipe(
        takeUntil(this.destroy$),
        tap((roles: RoleDto[]) => {
          this.roles = roles;
          // Create a map of role ID to localized role name for quick lookup
          const currentLang = getCurrentLang(this.translate);
          this.roleMap = new Map(
            roles.map(role => [
              role.id,
              getLocalizedName(role, currentLang) || role.name || role.id
            ])
          );
        }),
        map(() => void 0), // Convert to Observable<void>
        catchError((error) => {
          console.error('Failed to load roles', error);
          // Continue without roles - will show IDs if names not available
          return of(void 0);
        })
      );
  }

  private getRoleName(roleId?: string | null): string {
    if (!roleId) return 'N/A';
    return this.roleMap.get(roleId) || roleId;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.ordersLoading = true;
    this.ordersError = null;

    // Load all request types: Order, Return, and Discard
    forkJoin({
      orders: this.orderService.getAllOrders().pipe(catchError(() => of([] as OrderDto[]))),
      returns: this.returnService.getAllReturns().pipe(catchError(() => of([] as ReturnDto[]))),
      discards: this.discardService.getAllDiscards().pipe(catchError(() => of([] as DiscardDto[])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ orders, returns, discards }) => {
          const currentUser = this.authService.getCurrentUser();

          // Convert ReturnDto and DiscardDto to OrderDto format
          const convertedReturns = returns.map(ret => this.convertReturnToOrderDto(ret));
          const convertedDiscards = discards.map(disc => this.convertDiscardToOrderDto(disc));

          // Combine all requests
          const allRequests = [...orders, ...convertedReturns, ...convertedDiscards];

          // Filter by user's department
          const filteredRequests = filterRequestsByDepartment(allRequests, currentUser?.departmentId);

          // Sort by ID in ascending order (#1, #2, #3, etc.)
          this.orders = filteredRequests.sort((a, b) => (a.id || 0) - (b.id || 0));

          this.ordersLoading = false;
          if (this.orders.length > 0) {
            this.selectOrder(this.orders[0]);
          } else {
            this.selectedOrderId = null;
            this.resetReportData();
          }
        },
        error: (error) => {
          console.error('Failed to load requests', error);
          this.ordersError = 'Failed to load request list. Please try again.';
          this.toastService.error(this.ordersError);
          this.ordersLoading = false;
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
    // Clear previous data while loading
    this.approvalWorkflow = [];
    this.workflowDetails = [];
    this.approvalWorkflowStatus = '';

    // Find the request in the loaded list to determine its type
    const request = this.orders.find(r => r.id === id);
    if (!request) {
      this.errorMessage = 'Request not found.';
      this.toastService.error(this.errorMessage);
      this.detailsLoading = false;
      return;
    }

    // Determine request type and load accordingly
    const requestType = typeof request.requestType === 'number'
      ? request.requestType
      : (request.requestType === 'Return' ? RequestTypeEnum.Return :
        request.requestType === 'Discard' ? RequestTypeEnum.Discard : RequestTypeEnum.Order);

    let request$: Observable<OrderDto>;

    if (requestType === RequestTypeEnum.Return) {
      request$ = this.returnService.getReturnById(id).pipe(
        map(ret => this.convertReturnToOrderDto(ret))
      );
    } else if (requestType === RequestTypeEnum.Discard) {
      request$ = this.discardService.getDiscardById(id).pipe(
        map(disc => this.convertDiscardToOrderDto(disc))
      );
    } else {
      request$ = this.orderService.getOrderById(id);
    }

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order: OrderDto) => {
          this.mapOrderToReport(order);
          this.generateQrCode();
          this.detailsLoading = false;
        },
        error: (error) => {
          console.error('Failed to load request', error);
          this.errorMessage = 'Failed to load request details. Please try again.';
          this.toastService.error(this.errorMessage);
          this.detailsLoading = false;
        }
      });
  }

  private mapOrderToReport(order: OrderDto): void {
    this.orderSummary = mapOrderToSummary(order);
    this.orderItems = mapOrderItems(order);

    this.loadApprovalWorkflow(order.id);
    this.loadWorkflowDetails(order);
  }


  private loadApprovalWorkflow(orderId: number): void {
    this.apiService.getWithAuth<any>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    )
      .pipe(
        takeUntil(this.destroy$),
        map((response: any) => {
          // Handle both wrapped response and direct array response
          const data: BaseRequestDto[] = Array.isArray(response)
            ? response
            : (response?.data || []);

          // Find the base request that matches the order ID
          const baseRequest = data.find(r => r.id === orderId);

          // Update order summary status and requestDate with baseRequest data if available (authoritative source)
          if (baseRequest) {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
              const updatedSummary = mapOrderToSummary(order, baseRequest.status);

              // Set requestDate from baseRequest (with time)
              if (baseRequest.requestDate) {
                updatedSummary.requestDate = formatRequestDateTime(baseRequest.requestDate);
              }

              // If usage date (lastUpdated) is empty, use requestDate as fallback (date only, no time)
              if (!updatedSummary.lastUpdated || updatedSummary.lastUpdated.trim() === '') {
                updatedSummary.lastUpdated = formatRequestDate(baseRequest.requestDate) || 'N/A';
              }

              if (updatedSummary.orderId && updatedSummary.orderId.trim() !== '') {
                this.orderSummary = updatedSummary;
                this.generateQrCode();
              }
            }
          }

          // Get requester info - always show requester as first step
          const requesterStep: OrderReportApprovalStep = {
            step: '1',
            role: 'Requester',
            approver: baseRequest?.requesterName || this.orderSummary.requester || 'N/A',
            status: 'approved',
            date: baseRequest?.requestDate ? formatRequestDateTime(baseRequest.requestDate) : (this.orderSummary.requestDate || 'N/A'),
            notes: 'Request submitted'
          };

          if (!baseRequest || !baseRequest.approvalHistory || baseRequest.approvalHistory.length === 0) {
            // Return only requester step if no approval history
            return [requesterStep];
          }

          // Use the same mapping function as other components
          // Pass the request status to filter out pending steps if approved
          // Convert numeric status to RequestStatus string type using mapRequestStatus
          const requestStatus = mapRequestStatus(baseRequest.status);
          const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);

          // Convert WorkflowApprovalStep[] to OrderReportApprovalStep[]
          // Start numbering from 2 since requester is step 1
          const approvalSteps = workflowSteps.map((step, index) => ({
            step: (step.steporder ? (step.steporder + 1) : (index + 2)).toString(),
            role: step.applicationRoleName || this.getRoleName(step.applicationRoleId) || 'N/A',
            approver: step.approverName || 'N/A',
            status: step.status?.toLowerCase() as 'pending' | 'approved' | 'rejected' | 'in-progress' || 'pending',
            date: step.approvedDate || formatOrderDateTime(step.changedAt?.toString(), undefined),
            notes: step.comments || ''
          }));

          // Prepend requester step as the first step
          return [requesterStep, ...approvalSteps];
        }),
        catchError(error => {
          console.error('Failed to load approval workflow', error);
          // Fallback to mock data if API fails
          const order = this.orders.find(o => o.id === orderId);
          if (order) {
            const fallbackSteps = generateApprovalWorkflowFallback(order, (d, t) => formatOrderDateTime(d, t));
            // Add requester step as first step (step 1)
            // Adjust fallback steps to start from step 2
            const adjustedFallbackSteps = fallbackSteps.map((step, index) => ({
              ...step,
              step: (index + 2).toString()
            }));
            const requesterStep: OrderReportApprovalStep = {
              step: '1',
              role: 'Requester',
              approver: order.requesterName || this.orderSummary.requester || 'N/A',
              status: 'approved',
              date: this.orderSummary.requestDate || this.orderSummary.submittedOn || 'N/A',
              notes: 'Request submitted'
            };
            return of([requesterStep, ...adjustedFallbackSteps]);
          }
          return of([]);
        })
      )
      .subscribe({
        next: (steps) => {
          this.approvalWorkflow = steps;
          // If lastUpdated is still empty after loading workflow, try to use requestDate (date only, no time)
          if (!this.orderSummary.lastUpdated || this.orderSummary.lastUpdated.trim() === '') {
            // Extract date only from requestDate (remove time if present)
            const requestDateOnly = this.orderSummary.requestDate
              ? this.orderSummary.requestDate.split(' ').slice(0, 3).join(' ') // Take only first 3 parts (day month year)
              : 'N/A';
            this.orderSummary.lastUpdated = requestDateOnly;
          }
        },
        error: (error) => {
          console.error('Error loading approval workflow', error);
          // Only use fallback if API call fails completely
          const order = this.orders.find(o => o.id === orderId);
          if (order) {
            const fallbackSteps = generateApprovalWorkflowFallback(order, (d, t) => formatOrderDateTime(d, t));
            // Add requester step as first step (step 1)
            // Adjust fallback steps to start from step 2
            const adjustedFallbackSteps = fallbackSteps.map((step, index) => ({
              ...step,
              step: (index + 2).toString()
            }));
            const requesterStep: OrderReportApprovalStep = {
              step: '1',
              role: 'Requester',
              approver: order.requesterName || this.orderSummary.requester || 'N/A',
              status: 'approved',
              date: this.orderSummary.requestDate || this.orderSummary.submittedOn || 'N/A',
              notes: 'Request submitted'
            };
            this.approvalWorkflow = [requesterStep, ...adjustedFallbackSteps];
          } else {
            this.approvalWorkflow = [];
          }
        }
      });
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
      const qrData = generateQrCodeData(this.orderSummary);
      this.qrCodeDataUrl = await QRCode.toDataURL(
        qrData,
        {
          width: 320,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'M'
        }
      );
    } catch (error) {
      console.error('Failed to generate QR code', error);
      this.qrCodeDataUrl = null;
    }
  }

  async exportToPdf(): Promise<void> {
    if (this.isExportingPdf || !this.selectedOrderId) {
      return;
    }

    this.isExportingPdf = true;
    this.toastService.info('Exporting order to PDF...');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      // Load order details for selected order
      const orderData = await this.loadOrderDataForExport(this.selectedOrderId);
      if (!orderData) {
        this.toastService.error('Failed to load order data. Please try again.');
        this.isExportingPdf = false;
        return;
      }

      // Generate separate HTML sections
      const qrSectionHtml = this.generateQrCodeSectionHtml(orderData);
      const orderDetailsHtml = this.generateOrderDetailsSectionHtml(orderData);
      const approvalWorkflowHtml = this.generateApprovalWorkflowSectionHtml(orderData);

      // Page 1: QR Code Section
      await this.addSectionToPdf(pdf, qrSectionHtml, pdfWidth);

      // Page 2: Order Details Section
      pdf.addPage();
      await this.addSectionToPdf(pdf, orderDetailsHtml, pdfWidth);

      // Page 3: Approval Workflow Section
      pdf.addPage();
      await this.addSectionToPdf(pdf, approvalWorkflowHtml, pdfWidth);

      // Save PDF
      const orderId = orderData.summary.orderId.replace('#', '');
      const fileName = `order-report-${orderId}.pdf`;
      pdf.save(fileName);
      this.toastService.success('Successfully exported order to PDF');
    } catch (error) {
      console.error('Failed to export PDF', error);
      this.toastService.error('Failed to export PDF. Please try again.');
    } finally {
      this.isExportingPdf = false;
    }
  }

  private async loadOrderDataForExport(orderId: number): Promise<{
    order: OrderDto;
    summary: OrderSummary;
    items: OrderReportItem[];
    workflow: OrderReportApprovalStep[];
    qrCode: string | null;
  } | null> {
    try {
      // Find the request in the loaded list to determine its type
      const request = this.orders.find(r => r.id === orderId);
      if (!request) {
        return null;
      }

      // Determine request type and load accordingly
      const requestType = typeof request.requestType === 'number'
        ? request.requestType
        : (request.requestType === 'Return' ? RequestTypeEnum.Return :
          request.requestType === 'Discard' ? RequestTypeEnum.Discard : RequestTypeEnum.Order);

      let order$: Observable<OrderDto>;

      if (requestType === RequestTypeEnum.Return) {
        order$ = this.returnService.getReturnById(orderId).pipe(
          map(ret => this.convertReturnToOrderDto(ret))
        );
      } else if (requestType === RequestTypeEnum.Discard) {
        order$ = this.discardService.getDiscardById(orderId).pipe(
          map(disc => this.convertDiscardToOrderDto(disc))
        );
      } else {
        order$ = this.orderService.getOrderById(orderId);
      }

      const order = await firstValueFrom(order$.pipe(takeUntil(this.destroy$)));
      if (!order) {
        return null;
      }

      // Map order to report data
      const summary = mapOrderToSummary(order);
      const items = mapOrderItems(order);

      // Load approval workflow
      const workflow = await this.loadApprovalWorkflowForExport(orderId, order, summary);

      // Generate QR code
      const qrCode = await this.generateQrCodeForExport(summary);

      // Update summary with base request data if available
      try {
        const baseRequests = await firstValueFrom(
          this.apiService.getWithAuth<any>(API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS)
            .pipe(takeUntil(this.destroy$))
        );

        const data: BaseRequestDto[] = Array.isArray(baseRequests)
          ? baseRequests
          : (baseRequests?.data || []);

        const baseRequest = data.find(r => r.id === orderId);
        if (baseRequest) {
          const updatedSummary = mapOrderToSummary(order, baseRequest.status);
          if (baseRequest.requestDate) {
            updatedSummary.requestDate = formatRequestDateTime(baseRequest.requestDate);
          }
          if (!updatedSummary.lastUpdated || updatedSummary.lastUpdated.trim() === '') {
            updatedSummary.lastUpdated = formatRequestDate(baseRequest.requestDate) || 'N/A';
          }
          if (updatedSummary.orderId && updatedSummary.orderId.trim() !== '') {
            Object.assign(summary, updatedSummary);
          }
        }
      } catch (error) {
        console.error('Failed to load base request data', error);
      }

      return {
        order,
        summary,
        items,
        workflow,
        qrCode
      };
    } catch (error) {
      console.error(`Failed to load order data for export: ${orderId}`, error);
      return null;
    }
  }

  private async loadApprovalWorkflowForExport(
    orderId: number,
    order: OrderDto,
    summary: OrderSummary
  ): Promise<OrderReportApprovalStep[]> {
    try {
      const response = await firstValueFrom(
        this.apiService.getWithAuth<any>(API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS)
          .pipe(takeUntil(this.destroy$))
      );

      const data: BaseRequestDto[] = Array.isArray(response)
        ? response
        : (response?.data || []);

      const baseRequest = data.find(r => r.id === orderId);

      // Get requester info - always show requester as first step
      const requesterStep: OrderReportApprovalStep = {
        step: '1',
        role: 'Requester',
        approver: baseRequest?.requesterName || summary.requester || 'N/A',
        status: 'approved',
        date: baseRequest?.requestDate ? formatRequestDateTime(baseRequest.requestDate) : (summary.requestDate || 'N/A'),
        notes: 'Request submitted'
      };

      if (!baseRequest || !baseRequest.approvalHistory || baseRequest.approvalHistory.length === 0) {
        return [requesterStep];
      }

      const requestStatus = mapRequestStatus(baseRequest.status);
      const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);

      const approvalSteps = workflowSteps.map((step, index) => ({
        step: (step.steporder ? (step.steporder + 1) : (index + 2)).toString(),
        role: step.applicationRoleName || this.getRoleName(step.applicationRoleId) || 'N/A',
        approver: step.approverName || 'N/A',
        status: step.status?.toLowerCase() as 'pending' | 'approved' | 'rejected' | 'in-progress' || 'pending',
        date: step.approvedDate || formatOrderDateTime(step.changedAt?.toString(), undefined),
        notes: step.comments || ''
      }));

      return [requesterStep, ...approvalSteps];
    } catch (error) {
      console.error('Failed to load approval workflow', error);
      // Fallback to mock data
      const fallbackSteps = generateApprovalWorkflowFallback(order, (d, t) => formatOrderDateTime(d, t));
      const adjustedFallbackSteps = fallbackSteps.map((step, index) => ({
        ...step,
        step: (index + 2).toString()
      }));
      const requesterStep: OrderReportApprovalStep = {
        step: '1',
        role: 'Requester',
        approver: order.requesterName || summary.requester || 'N/A',
        status: 'approved',
        date: summary.requestDate || summary.submittedOn || 'N/A',
        notes: 'Request submitted'
      };
      return [requesterStep, ...adjustedFallbackSteps];
    }
  }

  private async generateQrCodeForExport(summary: OrderSummary): Promise<string | null> {
    try {
      if (!summary.orderId) {
        return null;
      }
      const qrData = generateQrCodeData(summary);
      return await QRCode.toDataURL(qrData, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
      });
    } catch (error) {
      console.error('Failed to generate QR code', error);
      return null;
    }
  }

  private async addSectionToPdf(pdf: jsPDF, sectionHtml: string, pdfWidth: number): Promise<void> {
    // Create temporary container
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '210mm'; // A4 width
    tempContainer.innerHTML = sectionHtml;
    document.body.appendChild(tempContainer);

    // Wait for images to load
    await this.waitForImages(tempContainer);

    // Capture as canvas
    const canvas = await html2canvas(tempContainer, {
      background: '#ffffff',
      scale: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2,
      useCORS: true,
      width: tempContainer.scrollWidth,
      height: tempContainer.scrollHeight
    } as any);

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Clean up temporary container
    document.body.removeChild(tempContainer);

    // If content fits on one page, add it directly
    if (pdfHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    } else {
      // Split content across multiple pages if needed
      let heightLeft = pdfHeight;
      let yPosition = 0;

      while (heightLeft > 0) {
        if (yPosition !== 0) {
          pdf.addPage();
        }
        
        // Calculate how much of the image to show on this page
        const pageContentHeight = Math.min(pageHeight, heightLeft);
        const sourceY = (yPosition / pdfHeight) * imgHeight;
        const sourceHeight = (pageContentHeight / pdfHeight) * imgHeight;
        
        // Create a temporary canvas for this page's content
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        if (pageCtx) {
          pageCtx.drawImage(
            canvas,
            0, sourceY,
            imgWidth, sourceHeight,
            0, 0,
            imgWidth, sourceHeight
          );
          const pageImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, pageContentHeight);
        } else {
          // Fallback: use negative positioning (may clip some content)
          pdf.addImage(imgData, 'PNG', 0, -yPosition, pdfWidth, pdfHeight);
        }
        
        heightLeft -= pageHeight;
        yPosition += pageHeight;
      }
    }
  }

  private generateQrCodeSectionHtml(data: {
    order: OrderDto;
    summary: OrderSummary;
    items: OrderReportItem[];
    workflow: OrderReportApprovalStep[];
    qrCode: string | null;
  }): string {
    const isRTL = this.isRTL;
    const direction = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';
    const flexDirection = isRTL ? 'row-reverse' : 'row';
    
    const qrCodeImg = data.qrCode
      ? `<img src="${data.qrCode}" alt="Order QR Code" style="width: 100px; height: 100px; display: block; margin: 0 auto;" />`
      : '<div style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.6rem;">QR Code</div>';

    const statusLabel = this.getStatusLabel(data.order.status);

    return `
      <div style="font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #000; background: #fff; padding: 1rem; min-height: 100vh; display: flex; flex-direction: column; direction: ${direction};">
        <!-- QR Code Section -->
        <section style="border: 1px solid #000; border-radius: 0; padding: 1rem; flex: 1; display: flex; flex-direction: column;">
          <div style="display: flex; flex-direction: ${flexDirection}; gap: 1rem; border-bottom: 2px solid #000; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            <div style="flex: 1;">
              <h3 style="font-size: 0.9rem; font-weight: bold; margin-bottom: 0.5rem; text-align: ${textAlign};">Order Report - QR Code</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; text-align: ${textAlign};">
                  <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Order ID</p>
                  <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.orderId}</p>
                </div>
                <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; text-align: ${textAlign};">
                  <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Department</p>
                  <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.department}</p>
                </div>
                <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; text-align: ${textAlign};">
                  <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Requester</p>
                  <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.requester}</p>
                </div>
                <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; text-align: ${textAlign};">
                  <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Status</p>
                  <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${statusLabel}</p>
                </div>
                <div style="border: 1px solid #e5e7eb; padding: 0.5rem; border-radius: 0.5rem; text-align: ${textAlign};">
                  <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Usage Date</p>
                  <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.lastUpdated || data.summary.requestDate || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div style="width: 120px; border: 1px solid #000; padding: 0.5rem; text-align: center; display: flex; align-items: center; justify-content: center;">
              ${qrCodeImg}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private generateOrderDetailsSectionHtml(data: {
    order: OrderDto;
    summary: OrderSummary;
    items: OrderReportItem[];
    workflow: OrderReportApprovalStep[];
    qrCode: string | null;
  }): string {
    const isRTL = this.isRTL;
    const direction = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';
    const textAlignReverse = isRTL ? 'left' : 'right';
    const flexDirection = isRTL ? 'row-reverse' : 'row';
    
    const statusLabel = this.getStatusLabel(data.order.status);
    const priorityLabel = this.getPriorityLabel(data.order.priority);

    const itemsHtml = data.items.length > 0
      ? data.items.map(item => `
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #e5e7eb; direction: ${direction};">
            <div style="font-weight: bold; color: #111827; font-size: 0.7rem; text-align: ${textAlign};">${item.name}</div>
            <div style="color: #4b5563; font-weight: 500; font-size: 0.7rem; text-align: ${textAlign};">${item.caliber}</div>
            <div style="color: #374151; font-weight: 600; text-align: ${textAlignReverse}; font-size: 0.7rem;">${item.quantity}</div>
          </div>
        `).join('')
      : `<div style="padding: 1.5rem; text-align: center; color: #6b7280; font-size: 0.7rem;">No items found</div>`;

    return `
      <div style="font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #000; background: #fff; padding: 1rem; min-height: 100vh; direction: ${direction};">
        <!-- Order Details Section -->
        <section style="border: 1px solid #000; border-radius: 0; padding: 1rem;">
          <h3 style="font-size: 0.9rem; font-weight: bold; margin-bottom: 0.5rem; text-align: ${textAlign};">Order Details - ${data.summary.usagePurpose}</h3>
          <div style="display: flex; flex-direction: ${flexDirection}; gap: 0.5rem; margin-bottom: 0.75rem;">
            <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.65rem; font-weight: bold; color: #374151;">
              Status: ${statusLabel}
            </span>
            <span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.65rem; font-weight: bold; color: #111827;">
              Priority: ${priorityLabel}
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.75rem;">
            <div style="border: 1px solid #e5e7eb; padding: 0.6rem; border-radius: 0.5rem; text-align: ${textAlign};">
              <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Department</p>
              <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.department}</p>
            </div>
            <div style="border: 1px solid #e5e7eb; padding: 0.6rem; border-radius: 0.5rem; text-align: ${textAlign};">
              <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Total Items</p>
              <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.totalItems}</p>
            </div>
            <div style="border: 1px solid #e5e7eb; padding: 0.6rem; border-radius: 0.5rem; text-align: ${textAlign};">
              <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Total Quantity</p>
              <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.totalQuantity}</p>
            </div>
            <div style="border: 1px solid #e5e7eb; padding: 0.6rem; border-radius: 0.5rem; text-align: ${textAlign};">
              <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Request Date</p>
              <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.requestDate || 'N/A'}</p>
            </div>
            <div style="border: 1px solid #e5e7eb; padding: 0.6rem; border-radius: 0.5rem; text-align: ${textAlign};">
              <p style="font-size: 0.6rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Usage Date</p>
              <p style="font-size: 0.75rem; font-weight: bold; color: #111827;">${data.summary.lastUpdated || data.summary.requestDate || 'N/A'}</p>
            </div>
          </div>
          <h4 style="font-size: 0.8rem; font-weight: bold; margin-bottom: 0.5rem; text-align: ${textAlign};">Items Included (${data.items.length})</h4>
          <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden;">
            <div style="background: linear-gradient(${isRTL ? 'to left' : 'to right'}, #1e293b, #334155); padding: 0.5rem; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; direction: ${direction};">
              <span style="font-size: 0.65rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlign};">Item Name</span>
              <span style="font-size: 0.65rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlign};">Item No</span>
              <span style="font-size: 0.65rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlignReverse};">Quantity</span>
            </div>
            <div>
              ${itemsHtml}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private generateApprovalWorkflowSectionHtml(data: {
    order: OrderDto;
    summary: OrderSummary;
    items: OrderReportItem[];
    workflow: OrderReportApprovalStep[];
    qrCode: string | null;
  }): string {
    const isRTL = this.isRTL;
    const direction = isRTL ? 'rtl' : 'ltr';
    const textAlign = isRTL ? 'right' : 'left';
    const textAlignReverse = isRTL ? 'left' : 'right';
    // Invert column order for RTL
    const gridColumns = isRTL ? '100px 140px 2fr 2fr 50px' : '50px 2fr 2fr 140px 100px';
    
    const workflowHtml = data.workflow.length > 0
      ? data.workflow.map(step => {
          const statusClass = step.status === 'approved' ? 'bg-green-100 text-green-800' :
                             step.status === 'rejected' ? 'bg-red-100 text-red-800' :
                             step.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                             step.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                             'bg-slate-100 text-slate-700';
          return `
            <div style="display: grid; grid-template-columns: ${gridColumns}; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #e5e7eb; direction: ${direction};">
              <div style="font-weight: bold; color: #111827; font-size: 0.65rem; text-align: ${textAlign};">${step.step}</div>
              <div style="color: #4b5563; font-size: 0.65rem; word-wrap: break-word; white-space: normal; text-align: ${textAlign};">${step.role}</div>
              <div style="font-weight: bold; color: #111827; font-size: 0.65rem; word-wrap: break-word; white-space: normal; text-align: ${textAlign};">${step.approver}</div>
              <div style="color: #4b5563; font-size: 0.6rem; white-space: normal; text-align: ${textAlign};">${step.date}</div>
              <div style="text-align: ${textAlignReverse};">
                <span style="display: inline-flex; align-items: center; gap: 0.25rem; border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.6rem; font-weight: bold; ${statusClass}">
                  ${step.status}
                </span>
              </div>
            </div>
          `;
        }).join('')
      : `<div style="padding: 1.5rem; text-align: center; color: #6b7280; font-size: 0.65rem;">No approval history</div>`;

    return `
      <div style="font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #000; background: #fff; padding: 1rem; min-height: 100vh; direction: ${direction};">
        <!-- Approval Workflow Section -->
        <section style="border: 1px solid #000; border-radius: 0; padding: 1rem;">
          <h3 style="font-size: 0.8rem; font-weight: bold; margin-bottom: 0.4rem; text-align: ${textAlign};">Approval Workflow</h3>
          <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden;">
            <div style="background: linear-gradient(${isRTL ? 'to left' : 'to right'}, #1e293b, #334155); padding: 0.4rem; display: grid; grid-template-columns: ${gridColumns}; gap: 0.5rem; direction: ${direction};">
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlign};">Step</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlign};">Role</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlign};">Approver</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlign};">Date</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: ${textAlignReverse};">Status</span>
            </div>
            <div>
              ${workflowHtml}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private async generateReportHtml(data: {
    order: OrderDto;
    summary: OrderSummary;
    items: OrderReportItem[];
    workflow: OrderReportApprovalStep[];
    qrCode: string | null;
  }): Promise<string> {
    // Generate HTML similar to the template but without Angular bindings
    const qrCodeImg = data.qrCode
      ? `<img src="${data.qrCode}" alt="Order QR Code" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />`
      : '<div style="width: 140px; height: 140px; display: flex; align-items: center; justify-content: center; color: #999;">QR Code</div>';

    const statusLabel = this.getStatusLabel(data.order.status);
    const priorityLabel = this.getPriorityLabel(data.order.priority);

    const itemsHtml = data.items.length > 0
      ? data.items.map(item => `
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; padding: 1rem; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: bold; color: #111827;">${item.name}</div>
            <div style="color: #4b5563; font-weight: 500;">${item.caliber}</div>
            <div style="color: #374151; font-weight: 600; text-align: right;">${item.quantity}</div>
          </div>
        `).join('')
      : '<div style="padding: 3rem; text-align: center; color: #6b7280;">No items found</div>';

    const workflowHtml = data.workflow.length > 0
      ? data.workflow.map(step => {
          const statusClass = step.status === 'approved' ? 'bg-green-100 text-green-800' :
                             step.status === 'rejected' ? 'bg-red-100 text-red-800' :
                             step.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                             step.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                             'bg-slate-100 text-slate-700';
          return `
            <div style="display: grid; grid-template-columns: 50px 2fr 2fr 140px 100px; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">
              <div style="font-weight: bold; color: #111827; font-size: 0.65rem;">${step.step}</div>
              <div style="color: #4b5563; font-size: 0.65rem; word-wrap: break-word; white-space: normal;">${step.role}</div>
              <div style="font-weight: bold; color: #111827; font-size: 0.65rem; word-wrap: break-word; white-space: normal;">${step.approver}</div>
              <div style="color: #4b5563; font-size: 0.6rem; white-space: normal;">${step.date}</div>
              <div>
                <span style="display: inline-flex; align-items: center; gap: 0.25rem; border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.6rem; font-weight: bold; ${statusClass}">
                  ${step.status}
                </span>
              </div>
            </div>
          `;
        }).join('')
      : '<div style="padding: 1.5rem; text-align: center; color: #6b7280; font-size: 0.65rem;">No approval history</div>';

    return `
      <div style="font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #000; background: #fff; padding: 2rem;">
        <!-- QR Code Section -->
        <section style="border: 1px solid #000; border-radius: 0; padding: 2rem; margin-bottom: 1.5rem; page-break-after: always;">
          <div style="display: flex; gap: 2rem; border-bottom: 3px solid #000; padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <div style="flex: 1;">
              <h3 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Order Report</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="border: 2px solid #e5e7eb; padding: 1rem; border-radius: 0.75rem;">
                  <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Order ID</p>
                  <p style="font-size: 1rem; font-weight: bold; color: #111827;">${data.summary.orderId}</p>
                </div>
                <div style="border: 2px solid #e5e7eb; padding: 1rem; border-radius: 0.75rem;">
                  <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Department</p>
                  <p style="font-size: 1rem; font-weight: bold; color: #111827;">${data.summary.department}</p>
                </div>
                <div style="border: 2px solid #e5e7eb; padding: 1rem; border-radius: 0.75rem;">
                  <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Requester</p>
                  <p style="font-size: 1rem; font-weight: bold; color: #111827;">${data.summary.requester}</p>
                </div>
                <div style="border: 2px solid #e5e7eb; padding: 1rem; border-radius: 0.75rem;">
                  <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Status</p>
                  <p style="font-size: 1rem; font-weight: bold; color: #111827;">${statusLabel}</p>
                </div>
              </div>
            </div>
            <div style="width: 180px; border: 2px solid #000; padding: 0.75rem; text-align: center;">
              ${qrCodeImg}
            </div>
          </div>
        </section>

        <!-- Order Details Section -->
        <section style="border: 1px solid #000; border-radius: 0; padding: 2rem; margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${data.summary.usagePurpose}</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="border: 2px solid #e5e7eb; padding: 1.25rem; border-radius: 0.75rem;">
              <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Department</p>
              <p style="font-size: 1rem; font-weight: bold; color: #111827;">${data.summary.department}</p>
            </div>
            <div style="border: 2px solid #e5e7eb; padding: 1.25rem; border-radius: 0.75rem;">
              <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Total Items</p>
              <p style="font-size: 1rem; font-weight: bold; color: #111827;">${data.summary.totalItems}</p>
            </div>
            <div style="border: 2px solid #e5e7eb; padding: 1.25rem; border-radius: 0.75rem;">
              <p style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 0.5rem;">Total Quantity</p>
              <p style="font-size: 1rem; font-weight: bold; color: #111827;">${data.summary.totalQuantity}</p>
            </div>
          </div>
          <h4 style="font-size: 1.125rem; font-weight: bold; margin-bottom: 1rem;">Items Included (${data.items.length})</h4>
          <div style="border: 2px solid #e5e7eb; border-radius: 0.75rem; overflow: hidden;">
            <div style="background: linear-gradient(to right, #1e293b, #334155); padding: 1rem; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
              <span style="font-size: 0.75rem; font-weight: bold; color: #fff; text-transform: uppercase;">Item Name</span>
              <span style="font-size: 0.75rem; font-weight: bold; color: #fff; text-transform: uppercase;">Item No</span>
              <span style="font-size: 0.75rem; font-weight: bold; color: #fff; text-transform: uppercase; text-align: right;">Quantity</span>
            </div>
            <div>
              ${itemsHtml}
            </div>
          </div>
        </section>

        <!-- Approval Workflow Section -->
        <section style="border: 1px solid #000; border-radius: 0; padding: 2rem;">
          <h3 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Approval Workflow</h3>
          <div style="border: 2px solid #e5e7eb; border-radius: 0.75rem; overflow: hidden;">
            <div style="background: linear-gradient(to right, #1e293b, #334155); padding: 0.4rem; display: grid; grid-template-columns: 50px 2fr 2fr 140px 100px; gap: 0.5rem;">
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase;">Step</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase;">Role</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase;">Approver</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase;">Date</span>
              <span style="font-size: 0.6rem; font-weight: bold; color: #fff; text-transform: uppercase;">Status</span>
            </div>
            <div>
              ${workflowHtml}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  private waitForImages(container: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const images = container.querySelectorAll('img');
      if (images.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const totalImages = images.length;

      const checkComplete = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          resolve();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkComplete();
        } else {
          img.onload = checkComplete;
          img.onerror = checkComplete;
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => resolve(), 5000);
    });
  }

  getStatusLabel(status: number | string): string {
    // mapOrderStatusFromApi already handles both number and string types
    return mapOrderStatusFromApi(status);
  }

  getPriorityLabel(priority: number | string): string {
    return mapOrderPriorityToString(priority);
  }

  getOrderDateLabel(order: OrderDto): string {
    if (!order.usageDateFrom) return '-';

    // Format time - handle military format (HHMM) and legacy format (HH:mm)
    const formatTime = (timeStr: string | null | undefined): string => {
      if (!timeStr) return '';
      // Military format (HHMM - 4 digits) - display as-is
      if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        return timeStr;
      }
      // Legacy format (HH:mm) - convert to military
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
    const fromTime = formatTime(order.usageTimeFrom);
    const toTime = formatTime(order.usageTimeTo);

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

  /**
   * Convert ReturnDto to OrderDto format for unified handling
   */
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
      usagePurpose: returnDto.requestPurposeName || undefined,
      departmentNameAr: returnDto.departmentName,
      departmentNameEn: returnDto.departmentName,
      requesterName: returnDto.requesterName,
      recieverName: returnDto.recieverName,
      depotNameAr: returnDto.depotName,
      depotNameEn: returnDto.depotName,
      requestPurposeNameAr: returnDto.requestPurposeName,
      requestPurposeNameEn: returnDto.requestPurposeName,
      requestItems: returnDto.requestItems?.map(item => ({
        id: item.id,
        itemId: item.itemId,
        quantity: item.quantity,
        notes: item.notes,
        itemName: item.itemName,
        itemNo: item.itemNo
      })) || []
    };
  }

  /**
   * Convert DiscardDto to OrderDto format for unified handling
   */
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
      usagePurpose: discardDto.requestPurposeName || undefined,
      departmentNameAr: discardDto.departmentName,
      departmentNameEn: discardDto.departmentName,
      requesterName: discardDto.requesterName,
      recieverName: discardDto.recieverName,
      depotNameAr: discardDto.depotName,
      depotNameEn: discardDto.depotName,
      requestPurposeNameAr: discardDto.requestPurposeName,
      requestPurposeNameEn: discardDto.requestPurposeName,
      requestItems: discardDto.requestItems?.map(item => ({
        id: item.id,
        itemId: item.itemId,
        quantity: item.quantity,
        notes: item.notes,
        itemName: item.itemName,
        itemNo: item.itemNo
      })) || []
    };
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
          <title>Order Report - ${this.orderSummary.orderId}</title>
          <style>
            @page {
              size: A4;
              margin: 1.5cm;
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
            
            /* Header section with QR */
            .print-header-section {
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: flex-start !important;
              border-bottom: 3px solid #000 !important;
              padding-bottom: 1rem !important;
              margin-bottom: 1.5rem !important;
              page-break-after: always;
            }
            
            .print-header-section > div {
              display: flex !important;
              flex-direction: row !important;
              width: 100% !important;
              gap: 2rem !important;
            }
            
            .print-header-section > div > div:first-child {
              flex: 1 !important;
            }
            
            .print-header-section > div > div:last-child {
              flex-shrink: 0 !important;
              width: 180px !important;
              border: 2px solid #000 !important;
              padding: 0.75rem !important;
              background: #ffffff !important;
              text-align: center !important;
            }
            
            /* QR Code */
            img[alt="Order QR Code"] {
              width: 140px !important;
              height: 140px !important;
              max-width: 140px !important;
              border: 1px solid #000 !important;
              padding: 0.5rem !important;
              background: #ffffff !important;
              display: block !important;
              margin: 0 auto !important;
            }
            
            /* Sections */
            section {
              break-inside: avoid;
              page-break-inside: avoid;
              border: 1px solid #000 !important;
              border-radius: 0 !important;
              padding: 1rem !important;
              margin-bottom: 1rem !important;
              background: #ffffff !important;
              box-shadow: none !important;
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
            
            /* Tables */
            .grid {
              width: 100% !important;
              display: grid !important;
            }
            
            .divide-y > div {
              border-bottom: 1px solid #ccc !important;
              page-break-inside: avoid;
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
}

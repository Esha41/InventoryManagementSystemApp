import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileDown, Printer, ArrowRight, CheckCircle2, Clock4, QrCode, ArrowLeft } from 'lucide-angular';
import { Subject, takeUntil, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { OrderService, OrderDto } from '@services/order.service';
import { ToastService } from '@services/toast.service';
import { ApiService } from '@services/api.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { BaseRequestDto } from '@models/workflow-approval.model';
import { mapOrderStatusFromApi } from '@utils/status.utils';
import { formatOrderDateTime } from '@utils/date.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { mapApprovalHistory, mapRequestStatus } from '@utils/request-mapper.utils';
import { filterRequestsByDepartment } from '@utils/dashboard.utils';
import {
  mapOrderToSummary,
  mapOrderItems,
  mapApprovalRecordsToSteps,
  generateApprovalWorkflowFallback,
  generateQrCodeData,
  filterApprovalRecordsByOrderId
} from '../utils/order-report.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';

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

  constructor(
    private router: Router,
    private orderService: OrderService,
    private toastService: ToastService,
    private apiService: ApiService,
    private authService: BackendAuthService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.ordersLoading = true;
    this.ordersError = null;
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          const currentUser = this.authService.getCurrentUser();
          // Filter orders by user's department
          this.orders = filterRequestsByDepartment(orders, currentUser?.departmentId);
          
          this.ordersLoading = false;
          if (this.orders.length > 0) {
            this.selectOrder(this.orders[0]);
          } else {
            this.selectedOrderId = null;
            this.resetReportData();
          }
        },
        error: (error) => {
          console.error('Failed to load orders', error);
          this.ordersError = 'Failed to load order list. Please try again.';
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
    this.orderService.getOrderById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order: OrderDto) => {
          this.mapOrderToReport(order);
          this.generateQrCode();
          this.detailsLoading = false;
        },
        error: (error) => {
          console.error('Failed to load order', error);
          this.errorMessage = 'Failed to load order details. Please try again.';
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
          
          // Update order summary status with baseRequest.status if available (authoritative source)
          if (baseRequest && baseRequest.status !== undefined && baseRequest.status !== null) {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
              const updatedSummary = mapOrderToSummary(order, baseRequest.status);
              
              if (updatedSummary.orderId && updatedSummary.orderId.trim() !== '') {
                this.orderSummary = updatedSummary;
                this.generateQrCode();
              }
            }
          }
          
          if (!baseRequest || !baseRequest.approvalHistory || baseRequest.approvalHistory.length === 0) {
            return [];
          }
          
          // Use the same mapping function as other components
          // Pass the request status to filter out pending steps if approved
          // Convert numeric status to RequestStatus string type using mapRequestStatus
          const requestStatus = mapRequestStatus(baseRequest.status);
          const workflowSteps = mapApprovalHistory(baseRequest.approvalHistory, requestStatus);
          
          // Convert WorkflowApprovalStep[] to OrderReportApprovalStep[]
          return workflowSteps.map((step, index) => ({
            step: step.steporder?.toString() || `Step ${index + 1}`,
            role: step.applicationRoleName || 'N/A',
            approver: step.approverName || 'N/A',
            status: step.status?.toLowerCase() as 'pending' | 'approved' | 'rejected' | 'in-progress' || 'pending',
            date: step.approvedDate || formatOrderDateTime(step.changedAt?.toString(), undefined),
            notes: step.comments || ''
          }));
        }),
        catchError(error => {
          console.error('Failed to load approval workflow', error);
          // Fallback to mock data if API fails
          const order = this.orders.find(o => o.id === orderId);
          if (order) {
            return of(generateApprovalWorkflowFallback(order, (d, t) => formatOrderDateTime(d, t)));
          }
          return of([]);
        })
      )
      .subscribe({
        next: (steps) => {
          this.approvalWorkflow = steps;
        },
        error: (error) => {
          console.error('Error loading approval workflow', error);
          // Only use fallback if API call fails completely
          const order = this.orders.find(o => o.id === orderId);
          if (order) {
            this.approvalWorkflow = generateApprovalWorkflowFallback(order, (d, t) => formatOrderDateTime(d, t));
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
    if (!this.reportContent || this.isExportingPdf) {
      return;
    }

    this.isExportingPdf = true;
    try {
      const canvas = await html2canvas(this.reportContent.nativeElement, {
        background: '#ffffff',
        scale: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2,
        useCORS: true
      } as any);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`order-report-${this.orderSummary.orderId.replace('#', '')}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF', error);
    } finally {
      this.isExportingPdf = false;
    }
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
    
    const fromDate = new Date(order.usageDateFrom).toLocaleDateString();
    const toDate = order.usageDateTo ? new Date(order.usageDateTo).toLocaleDateString() : '';
    const fromTime = formatTime(order.usageTimeFrom);
    const toTime = formatTime(order.usageTimeTo);
    
    return toDate 
      ? `${fromDate} ${fromTime} - ${toDate} ${toTime}` 
      : `${fromDate} ${fromTime}`;
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

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
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { mapOrderStatusFromApi } from '@utils/status.utils';
import { formatOrderDateTime } from '@utils/date.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import {
  mapOrderToSummary,
  mapOrderItems,
  mapApprovalRecordsToSteps,
  generateApprovalWorkflowFallback,
  generateQrCodeData,
  filterApprovalRecordsByOrderId
} from '../utils/order-report.utils';

@Component({
  selector: 'app-order-report',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
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
    workflowVersion: '',
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
    private apiService: ApiService
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
          this.orders = orders;
          this.ordersLoading = false;
          if (orders.length > 0) {
            this.selectOrder(orders[0]);
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
    // Map order summary using utility function
    this.orderSummary = mapOrderToSummary(order);
    
    // Map order items using utility function
    this.orderItems = mapOrderItems(order);

    // Load approval workflow and workflow details from API
    this.loadApprovalWorkflow(order.id);
    this.loadWorkflowDetails(order);
  }


  private loadApprovalWorkflow(orderId: number): void {
    console.log('loadApprovalWorkflow called with orderId:', orderId);
    this.apiService.getWithAuth<any>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    )
      .pipe(
        takeUntil(this.destroy$),
        map(response => {
          // Handle both wrapped response and direct array response
          let dataArray: any[] = [];
          
          if (Array.isArray(response)) {
            // Direct array response
            dataArray = response;
          } else if (response && response.succeeded && Array.isArray(response.data)) {
            // Wrapped APIOperationResponse
            dataArray = response.data;
          } else if (response && Array.isArray(response.data)) {
            // Alternative wrapped structure
            dataArray = response.data;
          } else {
            console.log('Unexpected API response structure:', response);
            return [];
          }
          
          console.log('Processing data array for orderId:', orderId, 'Array:', dataArray);
          console.log('Available request IDs:', dataArray.map((i: any) => ({ id: i.id, requestNo: i.requestNo })));
          
          // Filter approval records that match the order ID using utility function
          const approvalRecords = filterApprovalRecordsByOrderId(dataArray, orderId);
          
          if (approvalRecords.length === 0) {
            console.log('No matching approval records found for order ID:', orderId);
            return [];
          }
          
          console.log('Found approval records for orderId', orderId, ':', approvalRecords);
          
          // Map approval records to steps using utility function
          const steps = mapApprovalRecordsToSteps(approvalRecords, this.orders, formatOrderDateTime);
          
          // Set workflow status from the last record's status if available
          if (steps.length > 0) {
            const lastStatus = approvalRecords[approvalRecords.length - 1]?.oldRequestStatus;
            if (lastStatus) {
              this.approvalWorkflowStatus = mapOrderStatusFromApi(lastStatus);
            }
          }
          
          return steps;
        }),
        catchError(error => {
          console.error('Failed to load approval workflow', error);
          // Fallback to mock data if API fails
          const order = this.orders.find(o => o.id === orderId);
          if (order) {
            return of(generateApprovalWorkflowFallback(order, formatOrderDateTime));
          }
          return of([]);
        })
      )
      .subscribe({
        next: (steps) => {
          console.log('Loaded approval workflow steps:', steps);
          // Always use API data (even if empty) - only fallback on error
          this.approvalWorkflow = steps;
          // If no status was set and we have steps, try to get status from last step
          if (!this.approvalWorkflowStatus && steps.length > 0) {
            const lastStepStatus = steps[steps.length - 1]?.status;
            if (lastStepStatus === 'approved') {
              this.approvalWorkflowStatus = 'Approved';
            } else if (lastStepStatus === 'rejected') {
              this.approvalWorkflowStatus = 'Rejected';
            }
          }
        },
        error: (error) => {
          console.error('Error loading approval workflow', error);
          // Only use fallback if API call fails completely
          const order = this.orders.find(o => o.id === orderId);
          if (order) {
            this.approvalWorkflow = generateApprovalWorkflowFallback(order, formatOrderDateTime);
          } else {
            this.approvalWorkflow = [];
          }
        }
      });
  }


  private loadWorkflowDetails(order: OrderDto): void {
    // Try to get workflow details from API response
    // For now, set to empty array - only populate when API provides real data
    // If the API response includes workflow details, we can extract them here
    this.workflowDetails = [];
    
    // TODO: Fetch workflow details from API endpoint when available
    // Example: this.apiService.getWithAuth(...).subscribe(...)
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
        { width: 280, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } }
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

  getStatusLabel(status: number): string {
    return mapOrderStatusFromApi(status);
  }

  getPriorityLabel(priority: number): string {
    return mapOrderPriorityToString(priority);
  }

  getOrderDateLabel(order: OrderDto): string {
    return formatOrderDateTime(order.usageDate, order.usageTime);
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
      workflowVersion: '',
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
      <html>
        <head>
          <title>Order Report ${this.orderSummary.orderId}</title>
          <style>
            body {
              font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
              margin: 0;
              padding: 24px;
              color: #0f172a;
              background: #ffffff;
            }
            h1, h2, h3, h4 {
              margin: 0 0 12px 0;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 20px;
              margin-bottom: 20px;
            }
            .grid {
              display: grid;
              gap: 12px;
            }
            .grid-2 {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .muted {
              color: #64748b;
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


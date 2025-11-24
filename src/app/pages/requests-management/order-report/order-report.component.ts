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

interface OrderSummary {
  orderId: string;
  status: string;
  priority: string;
  submittedOn: string;
  department: string;
  requester: string;
  usagePurpose: string;
  totalItems: number;
  totalQuantity: number;
  workflowVersion: string;
  lastUpdated: string;
}

interface OrderItem {
  name: string;
  caliber: string;
  quantity: number;
  status: string;
}

interface ApprovalStep {
  step: string;
  role: string;
  approver: string;
  status: 'pending' | 'approved' | 'rejected' | 'in-progress';
  date: string;
  notes: string;
}

interface WorkflowDetail {
  phase: string;
  owner: string;
  description: string;
  sla: string;
  status: string;
}

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

  orderItems: OrderItem[] = [];
  approvalWorkflow: ApprovalStep[] = [];
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
    // Debug: Log priority value
    console.log('Order priority value:', order.priority, 'Type:', typeof order.priority);
    
    // Map order summary
    this.orderSummary = {
      orderId: order.orderNo || `#${order.id}`,
      status: this.mapStatusToString(order.status),
      priority: this.mapPriorityToString(order.priority),
      submittedOn: this.formatDateTime(order.usageDate, order.usageTime),
      department: order.departmentNameEn || order.departmentNameAr || 'N/A',
      requester: order.requesterName || 'N/A',
      usagePurpose: order.usagePurpose || 'N/A',
      totalItems: order.requestItems?.length || 0,
      totalQuantity: order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      workflowVersion: `WF-${order.requestType}-${order.id}`,
      lastUpdated: this.formatDateTime(order.usageDate, order.usageTime)
    };
    
    // Debug: Log mapped priority
    console.log('Mapped priority:', this.orderSummary.priority);

    // Map order items
    this.orderItems = (order.requestItems || []).map(item => ({
      name: item.itemName || 'Unknown Item',
      caliber: item.itemNo || 'N/A',
      quantity: item.quantity,
      status: this.mapItemStatus(order.status)
    }));

    // Load approval workflow and workflow details from API
    this.loadApprovalWorkflow(order.id);
    this.loadWorkflowDetails(order);
  }

  private mapStatusToString(status: number): string {
    switch (status) {
      case 0: return 'Pending';
      case 1: return 'Approved';
      case 2: return 'Rejected';
      default: return 'Pending';
    }
  }

  private mapStatusFromApi(status: any): string {
    if (status === 'Approved' || status === 'approved') {
      return 'Approved';
    }
    if (status === 'Rejected' || status === 'rejected') {
      return 'Rejected';
    }
    if (status === 'Pending' || status === 'pending') {
      return 'Pending';
    }
    // Handle numeric status
    if (typeof status === 'number') {
      return this.mapStatusToString(status);
    }
    return 'Pending';
  }

  private mapPriorityToString(priority: number | undefined | null): string {
    // Handle null, undefined, or invalid values
    if (priority === null || priority === undefined || isNaN(Number(priority))) {
      console.warn('Invalid priority value:', priority);
      return 'Medium';
    }
    
    // Convert to number in case it's a string
    const priorityNum = Number(priority);
    
    // Map priority values to match the order creation mapping:
    // 1 = High, 2 = Medium, 3 = Low (from mapPriorityToEnum in new-issue-request.component.ts)
    switch (priorityNum) {
      case 1: return 'High';
      case 2: return 'Medium';
      case 3: return 'Low';
      case 4: return 'Critical';
      default: 
        console.warn('Unknown priority value:', priorityNum);
        return 'Medium';
    }
  }

  private mapItemStatus(orderStatus: number): string {
    switch (orderStatus) {
      case 1: return 'Allocated';
      case 2: return 'Rejected';
      default: return 'Pending allocation';
    }
  }

  private formatDateTime(date?: string, time?: string): string {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const timeStr = time || '';
      return `${day} ${month} ${year}${timeStr ? ' · ' + timeStr : ''}`;
    } catch {
      return date;
    }
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
          
          // Filter approval records that match the order ID
          const approvalRecords = dataArray.filter((item: any) => {
            // Exact ID match (most reliable)
            if (item.id === orderId) {
              return true;
            }
            
            // Check other ID fields
            if (item.orderId === orderId || item.requestId === orderId) {
              return true;
            }
            
            // Check requestNo - extract order number from request number pattern
            if (item.requestNo) {
              const orderNumMatch = item.requestNo.match(/0*(\d+)/);
              if (orderNumMatch && parseInt(orderNumMatch[1]) === orderId) {
                return true;
              }
            }
            
            return false;
          });
          
          if (approvalRecords.length === 0) {
            console.log('No matching approval records found for order ID:', orderId);
            return [];
          }
          
          console.log('Found approval records for orderId', orderId, ':', approvalRecords);
          
          // Map approval records to ApprovalStep format using the specified field mappings
          const steps = approvalRecords.map((item: any, index: number) => {
            const step = item.higherApprovalRoleId || `Step ${index + 1}`;
            const role = item.applicationRoleName || 'N/A';
            const approver = item.changedBy || 'N/A';
            
            // Format date - handle both date-only and datetime strings
            let date = 'Pending';
            if (item.changedAt) {
              try {
                const dateObj = new Date(item.changedAt);
                if (!isNaN(dateObj.getTime())) {
                  // Extract time if it's a datetime string
                  const timeStr = item.changedAt.includes('T') 
                    ? dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  date = this.formatDateTime(item.changedAt, timeStr);
                }
              } catch {
                date = item.changedAt;
              }
            }
            
            const status = this.mapApprovalStatus(item.oldRequestStatus);
            
            return {
              step,
              role,
              approver,
              status,
              date,
              notes: item.comments || item.notes || item.comment || item.reason || ''
            };
          });
          
          // Set workflow status from the last record's status if available
          if (steps.length > 0) {
            const lastStatus = approvalRecords[approvalRecords.length - 1]?.oldRequestStatus;
            if (lastStatus) {
              this.approvalWorkflowStatus = this.mapStatusFromApi(lastStatus);
            }
          }
          
          return steps;
        }),
        catchError(error => {
          console.error('Failed to load approval workflow', error);
          // Fallback to mock data if API fails
          return of(this.generateApprovalWorkflowFallback(orderId));
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
          this.approvalWorkflow = this.generateApprovalWorkflowFallback(orderId);
        }
      });
  }

  private generateApprovalWorkflowFromRequest(request: any): ApprovalStep[] {
    // Generate approval workflow steps from request data when status is "Approved"
    const steps: ApprovalStep[] = [];
    
    // Get order data for requester name
    const orderId = request.id;
    const order = this.orders.find(o => o.id === orderId);
    const requesterName = order?.requesterName || request.requesterName || request.requester || 'N/A';
    const requestDate = request.requestDate || order?.usageDate;
    const requestTime = order?.usageTime;
    
    // Step 1: Submission
    steps.push({
      step: 'Submission',
      role: 'Request Owner',
      approver: requesterName,
      status: 'approved',
      date: requestDate ? this.formatDateTime(requestDate, requestTime) : 'Pending',
      notes: 'Initial request submitted.'
    });
    
    // Step 2: Review/Approval (based on status)
    const status = request.status;
    if (status === 'Approved' || status === 1 || status === 'approved') {
      steps.push({
        step: 'Review',
        role: 'Reviewer',
        approver: request.approverName || request.approver || 'System',
        status: 'approved',
        date: requestDate ? this.formatDateTime(requestDate, requestTime) : 'Pending',
        notes: request.reason || 'Order approved.'
      });
    } else if (status === 'Rejected' || status === 2 || status === 'rejected') {
      steps.push({
        step: 'Review',
        role: 'Reviewer',
        approver: request.approverName || request.approver || 'System',
        status: 'rejected',
        date: requestDate ? this.formatDateTime(requestDate, requestTime) : 'Pending',
        notes: request.reason || 'Order rejected.'
      });
    } else {
      steps.push({
        step: 'Review',
        role: 'Reviewer',
        approver: 'System',
        status: 'pending',
        date: 'Pending',
        notes: 'Awaiting review.'
      });
    }
    
    return steps;
  }

  private generateApprovalWorkflowFallback(orderId: number): ApprovalStep[] {
    // Fallback mock data if API fails or returns empty
    const order = this.orders.find(o => o.id === orderId);
    if (!order) {
      return [];
    }
    
    const steps: ApprovalStep[] = [
      {
        step: 'Submission',
        role: 'Request Owner',
        approver: order.requesterName || 'N/A',
        status: 'approved',
        date: this.formatDateTime(order.usageDate, order.usageTime),
        notes: 'Initial request submitted.'
      }
    ];

    if (order.status === 1) {
      steps.push({
        step: 'Review',
        role: 'Reviewer',
        approver: 'System',
        status: 'approved',
        date: this.formatDateTime(order.usageDate, order.usageTime),
        notes: 'Order approved.'
      });
    } else if (order.status === 2) {
      steps.push({
        step: 'Review',
        role: 'Reviewer',
        approver: 'System',
        status: 'rejected',
        date: this.formatDateTime(order.usageDate, order.usageTime),
        notes: order.reason || 'Order rejected.'
      });
    } else {
      steps.push({
        step: 'Review',
        role: 'Reviewer',
        approver: 'System',
        status: 'pending',
        date: 'Pending',
        notes: 'Awaiting review.'
      });
    }

    return steps;
  }

  private mapApprovalStatus(status: any): 'pending' | 'approved' | 'rejected' | 'in-progress' {
    if (!status) return 'pending';
    
    const statusStr = String(status).toLowerCase();
    if (statusStr.includes('approved') || statusStr === '1' || statusStr === 'true') {
      return 'approved';
    }
    if (statusStr.includes('rejected') || statusStr === '2' || statusStr === 'false') {
      return 'rejected';
    }
    if (statusStr.includes('progress') || statusStr.includes('processing')) {
      return 'in-progress';
    }
    return 'pending';
  }

  private loadWorkflowDetails(order: OrderDto): void {
    // Try to get workflow details from API response
    // For now, set to empty array - only populate when API provides real data
    // If the API response includes workflow details, we can extract them here
    this.workflowDetails = [];
    
    // TODO: Fetch workflow details from API endpoint when available
    // Example: this.apiService.getWithAuth(...).subscribe(...)
  }

  private generateWorkflowDetailsFallback(order: OrderDto): WorkflowDetail[] {
    // Fallback workflow details - can be enhanced when API provides this data
    return [
      {
        phase: 'Intake & Validation',
        owner: 'Request Management',
        description: 'Validate requester credentials and order details.',
        sla: '2 business hours',
        status: 'Completed'
      },
      {
        phase: 'Approval Process',
        owner: 'Approval System',
        description: 'Review and approve order request.',
        sla: '1 business day',
        status: order.status === 1 ? 'Completed' : order.status === 2 ? 'Rejected' : 'In progress'
      },
      {
        phase: 'Issuance & Tracking',
        owner: 'Depot',
        description: 'Issue order and register tracking information.',
        sla: 'Pending',
        status: order.status === 1 ? 'In progress' : 'Pending'
      }
    ];
  }

  goBack(): void {
    this.router.navigate(['/requests-management']);
  }

  async generateQrCode(): Promise<void> {
    if (!this.orderSummary.orderId) {
      return;
    }
    try {
      this.qrCodeDataUrl = await QRCode.toDataURL(
        JSON.stringify({
          orderId: this.orderSummary.orderId,
          workflow: this.orderSummary.workflowVersion,
          issuedOn: this.orderSummary.lastUpdated,
          totalItems: this.orderSummary.totalItems
        }),
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
    return this.mapStatusToString(status);
  }

  getPriorityLabel(priority: number): string {
    return this.mapPriorityToString(priority);
  }

  getOrderDateLabel(order: OrderDto): string {
    return this.formatDateTime(order.usageDate, order.usageTime);
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


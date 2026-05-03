import { Component, ElementRef, ViewChild, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileDown, Printer, ArrowRight, ArrowLeft } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { OrderDto } from '@models/order.model';
import { OrderSummary, OrderReportItem, OrderReportApprovalStep, WorkflowDetail } from '@models/order-report.model';
import { mapOrderStatusFromApi } from '@utils/status.utils';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { OrderReportService } from './services/order-report.service';
import { OrderReportPrintService } from './services/order-report-print.service';
import { OrderReportQrService } from './services/order-report-qr.service';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';
import { OrderListComponent } from './components/order-list/order-list.component';
import { OrderReportHeaderComponent } from './components/order-report-header/order-report-header.component';
import { OrderInfoSectionComponent } from './components/order-info-section/order-info-section.component';
import { OrderItemsTableComponent } from './components/order-items-table/order-items-table.component';
import { ApprovalWorkflowComponent } from './components/approval-workflow/approval-workflow.component';
import { OrderReportSupplySummaryComponent } from './components/order-report-supply-summary/order-report-supply-summary.component';
import { WorkflowApprovalPermissionsService } from '@requests/pages/management/workflow-approval-detail/services/workflow-approval-permissions.service';

@Component({
  selector: 'app-order-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent,
    OrderListComponent,
    OrderReportHeaderComponent,
    OrderInfoSectionComponent,
    OrderItemsTableComponent,
    ApprovalWorkflowComponent,
    OrderReportSupplySummaryComponent
  ],
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

  private destroy$ = new Subject<void>();
  ordersLoading = false;
  detailsLoading = false;
  ordersError: string | null = null;
  errorMessage: string | null = null;
  qrCodeDataUrl: string | null = null;
  orders: OrderDto[] = [];
  filteredOrders: OrderDto[] = [];
  selectedOrderId: number | null = null;
  searchTerm: string = '';

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
  currentDate: string = '';
  currentUser: string = '';
  constructor(
    private router: Router,
    private toastService: ToastService,
    private authService: BackendAuthService,
    private translationService: TranslationService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private orderReportService: OrderReportService,
    private orderReportPrintService: OrderReportPrintService,
    private orderReportQrService: OrderReportQrService,
    private workflowPermissionsService: WorkflowApprovalPermissionsService
  ) { }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  get showOrderReportSupplySummary(): boolean {
    return (
      this.selectedOrderId != null &&
      this.workflowPermissionsService.canViewWorkflowSupplySummaryForOrderReport(this.orderSummary)
    );
  }

  ngOnInit(): void {
    this.updateCurrentDate();
    const user = this.authService.getCurrentUser();
    this.currentUser = user?.userName || user?.email || 'N/A';

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateCurrentDate();
        if (this.selectedOrderId) {
          this.loadOrder(this.selectedOrderId);
        }
        this.cdr.markForCheck();
      });

    // Directly load orders; skip roles/me fetches to reduce calls
    this.loadOrders();
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.ordersLoading = true;
    this.ordersError = null;

    this.orderReportService.loadOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.filteredOrders = [...this.orders];
          this.ordersLoading = false;
          this.selectedOrderId = null;
          this.resetReportData();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load requests', error);
          this.ordersError = 'Failed to load request list. Please try again.';
          this.ordersLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Filter orders based on search term
   */
  filterOrders(): void {
    this.filteredOrders = this.orderReportService.filterOrders(
      this.orders,
      this.searchTerm,
      (order) => this.getDepartmentName(order),
      (status) => this.getStatusLabel(status),
      (priority) => this.getPriorityLabel(priority)
    );
    this.cdr.markForCheck();
  }

  /**
   * Handle search input change
   */
  onSearchChange(searchTerm?: string): void {
    if (searchTerm !== undefined) {
      this.searchTerm = searchTerm;
    }
    this.filterOrders();
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.filterOrders();
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
    const reportData = this.orderReportService.mapOrderToReport(order);
    this.orderSummary = reportData.summary;
    this.orderItems = reportData.items;
    this.cdr.markForCheck();

    this.loadApprovalWorkflow(order.id);
    this.loadWorkflowDetails(order);
  }


  private loadApprovalWorkflow(orderId: number): void {
    this.orderReportService.loadApprovalWorkflow(orderId, this.orders, this.orderSummary)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (steps) => {
          this.approvalWorkflow = steps;
          // lastUpdated is now a raw date, no need to format it here
          // The pipe will handle formatting in the template
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading approval workflow', error);
          this.cdr.markForCheck();
        }
      });
  }



  private loadWorkflowDetails(_order: OrderDto): void {
    this.workflowDetails = [];
  }

  goBack(): void {
    this.router.navigate(['/requests/requests-management']);
  }

  async generateQrCode(): Promise<void> {
    if (!this.orderSummary.orderId) {
      return;
    }
    this.qrCodeDataUrl = await this.orderReportQrService.generateQrCode(this.orderSummary.orderId);
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


  printReport(): void {
    if (!this.reportContent) {
      return;
    }

    this.orderReportPrintService.printReport(
      this.reportContent.nativeElement,
      this.orderSummary,
      this.isRTL
    );
  }

  private updateCurrentDate(): void {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.currentDate = `${day}/${month}/${year} ${hours}${minutes}`;
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

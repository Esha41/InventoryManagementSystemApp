import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Package } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { OrderService } from '@requests/services/order.service';
import { OrderDto } from '@models/order.model';
import { SupplyService } from '@requests/services/supply.service';
import { ToastService } from '@services/toast.service';
import { LoadingStateComponent } from '@components/index';
import { getPriorityKey, getPriorityText } from '@utils/priority.utils';
import { trackById } from '@utils/trackby.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-supply-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, LoadingStateComponent],
  templateUrl: './supply-order-list.component.html',
  styleUrls: ['./supply-order-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyOrderListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  readonly Package = Package;
  readonly trackById = trackById;
  
  orders: OrderDto[] = [];
  loading: boolean = true;

  constructor(
    private router: Router,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all orders to display in supply order list
   * For now, shows ALL orders regardless of status
   * TODO: Filter by approved status once auto-supply creation is implemented
   */
  loadOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (_error: unknown) => {
          this.showErrorToastKeys('toast.failedToLoadOrders', 'toast.error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Navigate to supply order detail page
   * Will create supply if it doesn't exist yet
   */
  viewOrder(order: OrderDto): void {
    // Check if supply exists for this order
    this.supplyService.getByOrderId(order.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supply) => {
          // Supply exists, navigate to it
          this.router.navigate(['/requests/supply-order', supply.id]);
        },
        error: () => {
          // Supply doesn't exist yet, navigate to supply-request-detail to create it
          // TODO: Later this should auto-create supply or show a better flow
          this.cdr.markForCheck();
          this.router.navigate(['/requests/requests-management', order.id, 'supply-request-detail']);
        }
      });
  }

  /**
   * Get status translation key
   * Handles both number and string status values
   */
  getStatusText(status: number): string {
    const statusMap: { [key: number]: string } = {
      1: 'dashboard.statusLabels.new',
      2: 'dashboard.statusLabels.underProcess',
      3: 'requestsManagement.orderReport.workflowStatus.completed',
      4: 'dashboard.statusLabels.rejected',
      5: 'dashboard.statusLabels.completed'
    };
    return statusMap[status] || 'dashboard.statusLabels.new';
  }

  getStatusClass(status: number): string {
    const classMap: { [key: number]: string } = {
      1: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
      2: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
      3: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
      4: 'bg-[var(--color-error)]/20 text-[var(--color-error)]',
      5: 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)]'
    };
    return classMap[status] || 'bg-[var(--color-background-muted)] text-[var(--color-text-muted)]';
  }

  /**
   * Get priority translation key
   * Handles both number and string priority values
   */
  getPriorityText(priority: number): string {
    return `common.priorityLevels.${getPriorityKey(priority)}`;
  }

  getPriorityDisplayText(priority?: number | null): string {
    return getPriorityText(priority);
  }

  private showSuccessToast(messageKey: string, titleKey: string = 'toast.success'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.success(translations[messageKey], translations[titleKey]);
      });
  }

  private showErrorToastKeys(messageKey: string, titleKey: string = 'toast.error'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(translations[messageKey], translations[titleKey]);
      });
  }

  private showWarningToast(messageKey: string, titleKey: string = 'toast.warning'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.warning(translations[messageKey], translations[titleKey]);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translateService);
    this.translateService
      .get('toast.error')
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(msg, translations['toast.error']);
      });
  }
}


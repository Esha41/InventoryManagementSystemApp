import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, Package } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { OrderService, OrderDto } from '@services/order.service';
import { SupplyService } from '@services/supply.service';
import { ToastService } from '@services/toast.service';
import { LoadingStateComponent } from '@components/index';

@Component({
  selector: 'app-supply-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, LoadingStateComponent],
  templateUrl: './supply-order-list.component.html',
  styleUrls: ['./supply-order-list.component.css']
})
export class SupplyOrderListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  readonly Package = Package;
  
  orders: OrderDto[] = [];
  loading: boolean = true;

  constructor(
    private router: Router,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private toastService: ToastService
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
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load orders:', error);
          this.toastService.error('Failed to load orders');
          this.loading = false;
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
          this.router.navigate(['/supply-order', supply.id]);
        },
        error: () => {
          // Supply doesn't exist yet, navigate to supply-request-detail to create it
          // TODO: Later this should auto-create supply or show a better flow
          this.router.navigate(['/requests-management', order.id, 'supply-request-detail']);
        }
      });
  }

  /**
   * Get status display text
   */
  getStatusText(status: number): string {
    const statusMap: { [key: number]: string } = {
      1: 'New',
      2: 'Under Process',
      3: 'Approved',
      4: 'Rejected',
      5: 'Completed'
    };
    return statusMap[status] || 'Unknown';
  }

  /**
   * Get status badge CSS classes
   */
  getStatusClass(status: number): string {
    const classMap: { [key: number]: string } = {
      1: 'bg-blue-100 text-blue-800',
      2: 'bg-yellow-100 text-yellow-800',
      3: 'bg-green-100 text-green-800',
      4: 'bg-red-100 text-red-800',
      5: 'bg-gray-100 text-gray-800'
    };
    return classMap[status] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Get priority display text
   */
  getPriorityText(priority: number): string {
    const priorityMap: { [key: number]: string } = {
      1: 'High',
      2: 'Medium',
      3: 'Low'
    };
    return priorityMap[priority] || 'Medium';
  }
}


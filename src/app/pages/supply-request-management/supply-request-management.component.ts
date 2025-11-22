import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderService, OrderDto } from '@services/order.service';
import { Subject, takeUntil } from 'rxjs';

export interface SupplyRequest {
  id: number;
  issueNo: string;
  requestType: 'Issue' | 'Return';
  quantity: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  requestDate: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Delivered' | 'Returned' | 'Cancelled';
}

@Component({
  selector: 'app-supply-request-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent],
  templateUrl: './supply-request-management.component.html',
  styleUrls: ['./supply-request-management.component.css']
})
export class SupplyRequestManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly Search = Search;
  readonly Calendar = Calendar;
  readonly ChevronDown = ChevronDown;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private orderService: OrderService
  ) {}

  requests: SupplyRequest[] = [];
  loading: boolean = true;

  filteredRequests: SupplyRequest[] = [];
  activeTab: string = 'Pending';
  
  tabs = ['Pending', 'New', 'Processing', 'Completed', 'Delivered', 'Returned', 'Cancelled'];
  
  searchTerm: string = '';
  dateFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 20;
  totalPages: number = 1;
  readonly itemsPerPageOptions = [1, 2, 5, 10, 20];

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOrders(): void {
    this.loading = true;
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          this.requests = orders.map(order => this.mapOrderToSupplyRequest(order));
          this.filterRequests();
          this.calculateTotalPages();
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load orders:', error);
          this.loading = false;
          // Still show empty state
          this.filterRequests();
          this.calculateTotalPages();
        }
      });
  }

  private mapOrderToSupplyRequest(order: OrderDto): SupplyRequest {
    // Map order status to supply request status
    const statusMap: { [key: number]: SupplyRequest['status'] } = {
      1: 'Pending',      // New
      2: 'Processing',   // InProgress
      3: 'Completed',    // Completed
      4: 'Delivered',    // Delivered
      5: 'Cancelled'     // Cancelled
    };

    // Map priority (assuming priority field is 1-4)
    const priorityMap: { [key: number]: SupplyRequest['priority'] } = {
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Critical'
    };

    // Calculate total quantity from request items
    const totalQuantity = order.requestItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    return {
      id: order.id,
      issueNo: order.requestNo || order.orderNo || `#${order.id}`,
      requestType: order.requestType === 1 ? 'Issue' : 'Return',
      quantity: totalQuantity,
      priority: priorityMap[order.priority] || 'Low',
      requestDate: this.formatDate(order.usageDate),
      status: statusMap[order.status] || 'Pending'
    };
  }

  private formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.filterRequests();
    this.calculateTotalPages();
  }

  filterRequests(): void {
    let filtered = [...this.requests];

    // Filter by active tab (status)
    if (this.activeTab !== 'New') {
      filtered = filtered.filter(req => req.status === this.activeTab);
    } else {
      // "New" tab shows all non-completed requests
      filtered = filtered.filter(req => 
        req.status === 'Pending' || req.status === 'Processing'
      );
    }

    // Filter by search term
    if (this.searchTerm) {
      filtered = filtered.filter(req =>
        req.issueNo.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    this.filteredRequests = filtered;
    this.calculateTotalPages();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.filterRequests();
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.filterRequests();
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredRequests.length / this.itemsPerPage);
  }

  onItemsPerPageChange(value: number | null): void {
    if (!value) {
      return;
    }
    this.itemsPerPage = value;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  get paginatedRequests(): SupplyRequest[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredRequests.slice(startIndex, endIndex);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  onStatusChange(issueNo: string, newStatus: string): void {
    const request = this.requests.find(r => r.issueNo === issueNo);
    if (request) {
      request.status = newStatus as any;
      this.filterRequests();
    }
  }

  onViewDetails(issueNo: string): void {
    const request = this.requests.find(r => r.issueNo === issueNo);
    if (request) {
      this.router.navigate(['/supply-request-management', request.id]);
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'Critical': return 'text-red-600';
      case 'High': return 'text-orange-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  }

  getStatusButtonClass(status: string): string {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'Processing': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Delivered': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Pending': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  // Return correct icon for previous button based on RTL/LTR
  get previousIcon() {
    return this.translationService.isRTL() ? ChevronRight : ChevronLeft;
  }

  // Return correct icon for next button based on RTL/LTR
  get nextIcon() {
    return this.translationService.isRTL() ? ChevronLeft : ChevronRight;
  }
}


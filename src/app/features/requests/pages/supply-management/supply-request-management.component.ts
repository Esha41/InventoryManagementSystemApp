import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderService } from '@services/order.service';
import { OrderDto } from '@models/order.model';
import { SupplyRequest } from '@models/supply-request.model';
import { Subject, takeUntil } from 'rxjs';
import { ErrorHandler } from '@utils/error-handler.utils';
import { mapOrderToSupplyRequest } from './utils/supply-request-mapper.utils';
import { getPriorityColor, getStatusButtonClass, getPageNumbers } from './utils/ui-helpers.utils';
import { formatNumber } from '@utils/format.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';

@Component({
  selector: 'app-supply-request-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './supply-request-management.component.html',
  styleUrls: ['./supply-request-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyRequestManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly Search = Search;
  readonly ChevronDown = ChevronDown;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private orderService: OrderService,
    private cdr: ChangeDetectorRef
  ) {}

  requests: SupplyRequest[] = [];
  loading: boolean = true;
  error: string | null = null;

  filteredRequests: SupplyRequest[] = [];
  activeTab: string = 'Pending';
  
  tabs = ['Pending', 'New', 'Processing', 'Completed', 'Delivered', 'Returned', 'Cancelled'] as const;
  
  searchTerm: string = '';
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 20;
  totalPages: number = 1;
  readonly itemsPerPageOptions: number[] = [1, 2, 5, 10, 20];
  
  // Expose utilities for template
  readonly getPriorityColor = getPriorityColor;
  readonly getStatusButtonClass = getStatusButtonClass;
  readonly formatNumber = formatNumber;

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOrders(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.orderService.getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders: OrderDto[]) => {
          this.requests = orders.map(order => mapOrderToSupplyRequest(order));
          this.filterRequests();
          this.calculateTotalPages();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load supply requests. Please try again.');
          this.loading = false;
          // Still show empty state
          this.filterRequests();
          this.calculateTotalPages();
          this.cdr.markForCheck();
        }
      });
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
    return getPageNumbers(this.currentPage, this.totalPages);
  }

  onStatusChange(issueNo: string, newStatus: string): void {
    const request = this.requests.find(r => r.issueNo === issueNo);
    if (request && this.isValidStatus(newStatus)) {
      request.status = newStatus as SupplyRequest['status'];
      this.filterRequests();
    }
  }

  private isValidStatus(status: string): status is SupplyRequest['status'] {
    return ['Pending', 'Processing', 'Completed', 'Delivered', 'Returned', 'Cancelled'].includes(status);
  }

  onViewDetails(issueNo: string): void {
    const request = this.requests.find(r => r.issueNo === issueNo);
    if (request) {
      this.router.navigate(['/supply-request-management', request.id]);
    }
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


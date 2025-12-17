import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown, Search } from 'lucide-angular';
import { PaginationComponent, RowsPerPageComponent, DropdownComponent, DropdownOption } from '@components/index';
import { OrderDetailsModalComponent } from './components/order-details-modal/order-details-modal.component';
import { RequestsManagementService } from './services/requests-management.service';
import { getRequestStatusClass } from './utils/ui-helpers.utils';
import { Request } from './models/requests-management.model';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { RequestStatusUpdateService } from '@services/request-status-update.service';
import { CardStatus } from '@utils/status.utils';


@Component({
  selector: 'app-requests-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent, OrderDetailsModalComponent, DropdownComponent],
  templateUrl: './requests-management.component.html',
  styleUrls: ['./requests-management.component.css']
})
export class RequestsManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly ChevronDown = ChevronDown;
  readonly Search = Search;

  requests: Request[] = [];
  filteredRequests: Request[] = [];
  loading = false;

  // Search functionality
  searchQuery: string = '';

  // Status filter
  selectedStatusFilter: CardStatus | 'all' = 'all';
  readonly statusFilterOptions: DropdownOption<CardStatus | 'all'>[] = [
    { label: 'dashboard.filters.all', value: 'all' },
    { label: 'dashboard.statusLabels.new', value: 'new' },
    { label: 'dashboard.statusLabels.underProcess', value: 'on-progress' },
    { label: 'dashboard.statusLabels.approved', value: 'completed' },
    { label: 'dashboard.statusLabels.rejected', value: 'declined' }
  ];

  // Priority filter
  selectedPriorityFilter: 'all' | 'High' | 'Medium' | 'Low' = 'all';
  readonly priorityFilterOptions: DropdownOption<'all' | 'High' | 'Medium' | 'Low'>[] = [
    { label: 'dashboard.filters.all', value: 'all' },
    { label: 'requestsManagement.priorities.high', value: 'High' },
    { label: 'requestsManagement.priorities.medium', value: 'Medium' },
    { label: 'requestsManagement.priorities.low', value: 'Low' }
  ];

  currentPage: number = 1;
  rowsPerPage: number = 10;
  totalItems: number = 0;

  isModalOpen = false;
  selectedOrder: Request | null = null;

  constructor(
    private requestsManagementService: RequestsManagementService,
    private router: Router,
    private requestStatusUpdateService: RequestStatusUpdateService,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    // Initial load
    this.loadRequests();

    this.requestStatusUpdateService.onRequestStatusUpdated$
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadRequests();
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        filter(() => this.router.url === '/requests-management' || this.router.url.startsWith('/requests-management')),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadRequests();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRequests(): void {
    this.loading = true;
    this.requestsManagementService.loadRequests()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          this.applyFilters();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.requests = [];
          this.filteredRequests = [];
        }
      });
  }

  /**
   * Map Request status string to CardStatus
   * Request model uses: 'New' | 'Pending' | 'Confirmed' | 'Rejected'
   * CardStatus uses: 'new' | 'on-progress' | 'completed' | 'declined'
   */
  private mapRequestStatusToCardStatus(status: string): CardStatus {
    const statusLower = status.toLowerCase().trim();
    switch (statusLower) {
      case 'new':
        return 'new';
      case 'pending':
        return 'on-progress';
      case 'confirmed':
        return 'completed';
      case 'rejected':
        return 'declined';
      default:
        return 'new';
    }
  }

  applyFilters(): void {
    let filtered = [...this.requests];

    // Apply status filter
    if (this.selectedStatusFilter !== 'all') {
      filtered = filtered.filter(request => {
        const cardStatus = this.mapRequestStatusToCardStatus(request.status);
        return cardStatus === this.selectedStatusFilter;
      });
    }

    // Apply priority filter
    if (this.selectedPriorityFilter !== 'all') {
      filtered = filtered.filter(request => {
        return request.priority === this.selectedPriorityFilter;
      });
    }

    // Apply search filter
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const query = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(request => {
        return (
          (request.orderId && request.orderId.toLowerCase().includes(query)) ||
          (request.requestDate && request.requestDate.toLowerCase().includes(query)) ||
          (request.creationDate && request.creationDate.toLowerCase().includes(query)) ||
          (request.priority && request.priority.toLowerCase().includes(query)) ||
          (request.requestType && request.requestType.toLowerCase().includes(query)) ||
          (request.status && request.status.toLowerCase().includes(query))
        );
      });
    }

    // Sort by priority (Critical > High > Medium > Low)
    filtered.sort((a, b) => {
      return this.getPriorityOrder(a.priority) - this.getPriorityOrder(b.priority);
    });

    this.filteredRequests = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1; // Reset to first page when filtering
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  onPriorityFilterChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  /**
   * Get priority order for sorting (lower number = higher priority)
   */
  private getPriorityOrder(priority: string): number {
    const priorityLower = priority.toLowerCase().trim();
    switch (priorityLower) {
      case 'high':
        return 0;
      case 'medium':
        return 1;
      case 'low':
        return 2;
      default:
        return 3;
    }
  }

  get paginatedRequests(): Request[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.filteredRequests.slice(start, end);
  }

  get filteredRequestsCount(): number {
    return this.filteredRequests.length;
  }

  readonly statusFilterLabelFn = (option: DropdownOption<CardStatus | 'all'> | CardStatus | 'all'): string => {
    if (typeof option === 'object' && option !== null && 'label' in option) {
      return this.translate.instant(option.label as string);
    }
    return '';
  };

  readonly priorityFilterLabelFn = (option: DropdownOption<'all' | 'High' | 'Medium' | 'Low'> | 'all' | 'High' | 'Medium' | 'Low'): string => {
    if (typeof option === 'object' && option !== null && 'label' in option) {
      return this.translate.instant(option.label as string);
    }
    return '';
  };

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1; // Reset to first page when changing rows per page
  }

  getStatusClass(status: string): string {
    return getRequestStatusClass(status);
  }

  getPriorityClass(priority: string): string {
    const priorityLower = priority.toLowerCase().trim();
    switch (priorityLower) {
      case 'high':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  }

  /**
   * Get priority translation key
   */
  getPriorityText(priority: string): string {
    const priorityLower = priority?.toLowerCase().trim() || '';
    switch (priorityLower) {
      case 'high':
        return 'dashboard.priorityLabels.high';
      case 'medium':
        return 'dashboard.priorityLabels.medium';
      case 'low':
        return 'dashboard.priorityLabels.low';
      default:
        return 'dashboard.priorityLabels.medium';
    }
  }

  /**
   * Get status translation key
   */
  getStatusText(status: string): string {
    const statusLower = status?.toLowerCase().trim() || '';
    switch (statusLower) {
      case 'new':
        return 'dashboard.statusLabels.new';
      case 'pending':
        return 'dashboard.statusLabels.underProcess';
      case 'confirmed':
        return 'requestsManagement.confirmed';
      case 'rejected':
        return 'dashboard.statusLabels.rejected';
      case 'returned':
      case 'returnedforreview':
        return 'dashboard.statusLabels.returnedForReview';
      default:
        return 'dashboard.statusLabels.new';
    }
  }

  /**
   * Get request type translation key
   */
  getRequestTypeText(requestType: string): string {
    const typeLower = requestType?.toLowerCase().trim() || '';
    switch (typeLower) {
      case 'order':
        return 'requestsManagement.order';
      case 'return':
        return 'requestsManagement.return';
      case 'discard':
        return 'requestsManagement.discard';
      default:
        return 'requestsManagement.order';
    }
  }

  openOrderDetails(order: Request): void {
    this.router.navigate(['/requests-management', order.id, 'workflow-approval']);
  }

  closeOrderDetails(): void {
    this.isModalOpen = false;
    this.selectedOrder = null;
  }
}

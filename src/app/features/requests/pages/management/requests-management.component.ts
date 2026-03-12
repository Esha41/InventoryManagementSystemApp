import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { PaginationComponent, RowsPerPageComponent, RequestFilterBarComponent, StatusFilter, PriorityFilter } from '@components/index';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { RequestsManagementService } from './services/requests-management.service';
import { getRequestStatusClass } from './utils/ui-helpers.utils';
import { Request } from './models/requests-management.model';
import { Subject, takeUntil } from 'rxjs';
import { filter } from 'rxjs/operators';
import { RequestStatusUpdateService } from '@services/request-status-update.service';


@Component({
  selector: 'app-requests-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent, RequestFilterBarComponent, AppDatePipe],
  templateUrl: './requests-management.component.html',
  styleUrls: ['./requests-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestsManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly Math = Math;

  readonly ChevronDown = ChevronDown;

  requests: Request[] = [];
  loading = false;

  // Filter state (managed by shared component)
  searchQuery: string = '';
  selectedStatusFilter: StatusFilter = 'all';
  selectedPriorityFilter: PriorityFilter = 'all';

  currentPage: number = 1;
  rowsPerPage: number = 10;
  totalItems: number = 0;

  constructor(
    private requestsManagementService: RequestsManagementService,
    private router: Router,
    private requestStatusUpdateService: RequestStatusUpdateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Initial load
    this.loadRequests();

    this.requestStatusUpdateService.onRequestStatusUpdated$
      .pipe(
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
    this.cdr.markForCheck();

    this.requestsManagementService.getRequests(
      this.currentPage,
      this.rowsPerPage,
      this.searchQuery,
      this.selectedStatusFilter,
      this.selectedPriorityFilter
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.requests = response.items;
          this.totalItems = response.totalCount;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.requests = [];
          this.totalItems = 0;
          this.cdr.markForCheck();
        }
      });
  }

  applyFilters(): void {
    // With server-side pagination, applyFilters just reloads
    this.currentPage = 1;
    this.loadRequests();
  }

  onStatusFilterChange(status: StatusFilter): void {
    this.selectedStatusFilter = status;
    this.applyFilters();
  }

  onPriorityFilterChange(priority: PriorityFilter): void {
    this.selectedPriorityFilter = priority;
    this.applyFilters();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  get paginatedRequests(): Request[] {
    return this.requests;
  }

  get filteredRequestsCount(): number {
    return this.totalItems;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  onPageChange(page: number): void {
    if (this.currentPage !== page) {
      this.currentPage = page;
      this.loadRequests();
    }
  }

  onRowsPerPageChange(rows: number): void {
    if (this.rowsPerPage !== rows) {
      this.rowsPerPage = rows;
      this.currentPage = 1;
      this.loadRequests();
    }
  }

  getStatusClass(status: string): string {
    return getRequestStatusClass(status);
  }

  getPriorityClass(priority: string): string {
    const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
    switch (priorityLower) {
      case 'normal':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'urgent':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'veryurgent':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  }

  /**
   * Get priority translation key
   */
  getPriorityText(priority: string): string {
    const priorityLower = priority?.toLowerCase().trim().replace(/\s+/g, '') || '';
    switch (priorityLower) {
      case 'normal':
        return 'dashboard.priorityLabels.normal';
      case 'urgent':
        return 'dashboard.priorityLabels.urgent';
      case 'veryurgent':
        return 'dashboard.priorityLabels.veryUrgent';
      default:
        return 'dashboard.priorityLabels.urgent';
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
}

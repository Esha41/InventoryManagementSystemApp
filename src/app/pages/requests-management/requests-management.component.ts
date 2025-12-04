import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { PaginationComponent, RowsPerPageComponent } from '@components/index';
import { OrderDetailsModalComponent } from './components/order-details-modal/order-details-modal.component';
import { RequestsManagementService } from './services/requests-management.service';
import { getRequestStatusClass } from './utils/ui-helpers.utils';
import { Request } from './models/requests-management.model';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { RequestStatusUpdateService } from '@services/request-status-update.service';


@Component({
  selector: 'app-requests-management',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, PaginationComponent, RowsPerPageComponent, OrderDetailsModalComponent],
  templateUrl: './requests-management.component.html',
  styleUrls: ['./requests-management.component.css']
})
export class RequestsManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  readonly ChevronDown = ChevronDown;

  requests: Request[] = [];
  loading = false;

  currentPage: number = 1;
  rowsPerPage: number = 5;
  totalItems: number = 0;

  isModalOpen = false;
  selectedOrder: Request | null = null;

  constructor(
    private requestsManagementService: RequestsManagementService,
    private router: Router,
    private requestStatusUpdateService: RequestStatusUpdateService
  ) {}

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
          this.totalItems = requests.length;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.requests = [];
        }
      });
  }

  get paginatedRequests(): Request[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.requests.slice(start, end);
  }

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

  openOrderDetails(order: Request): void {
    this.router.navigate(['/requests-management', order.id, 'workflow-approval']);
  }

  closeOrderDetails(): void {
    this.isModalOpen = false;
    this.selectedOrder = null;
  }
}

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { MonitoringService } from '@services/monitoring.service';
import { OrderAwaitingFulfillmentListItemDto } from '@models/inventory-dashboard-monitoring.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { defaultPageSize } from '@constants/app.constants';

@Component({
  selector: 'app-orders-awaiting-fulfillment',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    PaginationComponent,
    RowsPerPageComponent,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './orders-awaiting-fulfillment.component.html',
  styleUrls: ['./orders-awaiting-fulfillment.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersAwaitingFulfillmentComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  private readonly destroy$ = new Subject<void>();

  rows: OrderAwaitingFulfillmentListItemDto[] = [];
  loading = true;
  error: string | null = null;

  currentPage = 1;
  rowsPerPage = defaultPageSize;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  get paginatedRows(): OrderAwaitingFulfillmentListItemDto[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.rows.slice(start, start + this.rowsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.rows.length / this.rowsPerPage) || 1;
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private monitoringService: MonitoringService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(q => {
      const depotIds = q.getAll('depotIds').map(Number).filter(n => !Number.isNaN(n));
      this.load(depotIds.length > 0 ? depotIds : undefined);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(depotIds?: number[]): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.monitoringService
      .getOrdersAwaitingFulfillmentList(depotIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: items => {
          this.rows = items ?? [];
          this.loading = false;
          this.currentPage = 1;
          this.cdr.markForCheck();
        },
        error: err => {
          this.error = ErrorHandler.extractErrorMessage(err, 'Failed to load orders');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onBack(): void {
    this.router.navigate(['/inventory-dashboard']);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.cdr.markForCheck();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.cdr.markForCheck();
  }
}

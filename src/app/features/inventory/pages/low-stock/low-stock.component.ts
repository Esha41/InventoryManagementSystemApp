import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { MonitoringService, LowStockItemDto } from '@services/monitoring.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent, TableClampTooltipDirective } from '@components/index';
import { defaultPageSize } from '@constants/app.constants';

@Component({
  selector: 'app-low-stock',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    PaginationComponent,
    RowsPerPageComponent,
    LoadingStateComponent,
    ErrorStateComponent,
    TableClampTooltipDirective
  ],
  templateUrl: './low-stock.component.html',
  styleUrls: ['./low-stock.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LowStockComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  private readonly destroy$ = new Subject<void>();

  lowStockItems: LowStockItemDto[] = [];
  totalCount = 0;
  totalPages = 0;
  loading = true;
  error: string | null = null;

  // Pagination (server-side)
  currentPage = 1;
  rowsPerPage = defaultPageSize;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  constructor(
    private router: Router,
    private monitoringService: MonitoringService,
    private translationService: TranslationService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadLowStockItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadLowStockItems(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.monitoringService
      .getLowStockItemsPaginated(this.currentPage, this.rowsPerPage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paged) => {
          this.lowStockItems = paged.items ?? [];
          this.totalCount = paged.totalCount ?? 0;
          this.totalPages = paged.totalPages ?? 0;
          this.currentPage = paged.pageIndex ?? this.currentPage;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load low stock items');
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
    this.loadLowStockItems();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.loadLowStockItems();
  }
}

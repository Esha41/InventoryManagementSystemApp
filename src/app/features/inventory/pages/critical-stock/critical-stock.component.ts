import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { MonitoringService, CriticalStockItemDto } from '@services/monitoring.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent, TableClampTooltipDirective } from '@components/index';
import { defaultPageSize } from '@constants/app.constants';

@Component({
  selector: 'app-critical-stock',
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
  templateUrl: './critical-stock.component.html',
  styleUrls: ['./critical-stock.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CriticalStockComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  private readonly destroy$ = new Subject<void>();

  criticalStockItems: CriticalStockItemDto[] = [];
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

  get paginatedItems(): CriticalStockItemDto[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.criticalStockItems.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.criticalStockItems.length / this.rowsPerPage);
  }

  constructor(
    private router: Router,
    private monitoringService: MonitoringService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCriticalStockItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCriticalStockItems(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.monitoringService.getCriticalStockItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.criticalStockItems = items;
          this.loading = false;
          this.currentPage = 1;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load critical stock items');
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

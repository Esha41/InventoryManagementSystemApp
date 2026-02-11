import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { MonitoringService } from '@services/monitoring.service';
import { ErrorHandlingService } from '@services/error-handling.service';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';

export interface LowStockItemDto {
  itemId: number;
  itemName: string;
  itemNo?: string;
  nsn?: string;
  minimumQuantity?: number;
  totalStock: number;
  holdQuantity: number;
  suppliedQuantity: number;
  remaining: number;
}

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
    ErrorStateComponent
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
  loading = true;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  get paginatedItems(): LowStockItemDto[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    return this.lowStockItems.slice(startIndex, startIndex + this.rowsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.lowStockItems.length / this.rowsPerPage);
  }

  constructor(
    private router: Router,
    private monitoringService: MonitoringService,
    private errorHandlingService: ErrorHandlingService,
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

    this.monitoringService.getLowStockItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.lowStockItems = items;
          this.loading = false;
          this.currentPage = 1; // Reset to first page
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorHandlingService.resolveHttpErrorMessage(error);
          this.error = 'Failed to load low stock items';
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

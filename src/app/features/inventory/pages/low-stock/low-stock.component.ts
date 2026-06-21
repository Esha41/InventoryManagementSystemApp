import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { resolveInventoryReportReturnUrl } from '@inventory/pages/overview/inventory-dashboard.data-load';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { MonitoringService, type LowStockItemDto } from '@services/monitoring.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { defaultPageSize } from '@constants/app.constants';
import { PagedListRequest } from '@models/pagination.model';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';

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
    private route: ActivatedRoute,
    private monitoringService: MonitoringService,
    private translationService: TranslationService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadLowStockItems();
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  /** Item name for current UI language (Arabic when set and available, else English). */
  lowStockItemDisplayName(item: LowStockItemDto): string {
    const arRaw = item.itemNameAr ?? (item as { itemNameAR?: string | null }).itemNameAR;
    const ar = (arRaw ?? '').trim();
    const en = (item.itemName ?? '').trim();
    const label =
      getLocalizedName({ name: en, nameAr: ar || undefined }, getCurrentLang(this.translate))?.trim() || en;
    return label || 'N/A';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadLowStockItems(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const request: PagedListRequest = { page: this.currentPage, pageSize: this.rowsPerPage };

    this.monitoringService
      .getLowStockItemsPaginated(request)
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
    this.router.navigateByUrl(resolveInventoryReportReturnUrl(this.route.snapshot.queryParams['returnTo']));
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

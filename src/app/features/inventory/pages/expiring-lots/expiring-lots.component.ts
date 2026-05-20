import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { MonitoringService, ExpiringLotDto } from '@services/monitoring.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent, TableClampTooltipDirective } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { defaultPageSize } from '@constants/app.constants';
import { PagedListRequest } from '@models/pagination.model';

@Component({
  selector: 'app-expiring-lots',
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
  templateUrl: './expiring-lots.component.html',
  styleUrls: ['./expiring-lots.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpiringLotsComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  private readonly destroy$ = new Subject<void>();

  expiringLots: ExpiringLotDto[] = [];
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
    this.loadExpiringLots();
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  /** Item name for current UI language (Arabic when set and available, else English). */
  expiringLotItemDisplayName(lot: ExpiringLotDto): string {
    const arRaw = lot.itemNameAr ?? (lot as { itemNameAR?: string | null }).itemNameAR;
    const ar = (arRaw ?? '').trim();
    const en = (lot.itemName ?? '').trim();
    const label =
      getLocalizedName({ name: en, nameAr: ar || undefined }, getCurrentLang(this.translate))?.trim() || en;
    return label || 'N/A';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadExpiringLots(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const request: PagedListRequest = { page: this.currentPage, pageSize: this.rowsPerPage };

    this.monitoringService
      .getExpiringLotsPaginated(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paged) => {
          this.expiringLots = paged.items ?? [];
          this.totalCount = paged.totalCount ?? 0;
          this.totalPages = paged.totalPages ?? 0;
          this.currentPage = paged.pageIndex ?? this.currentPage;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load expiring lots');
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
    this.loadExpiringLots();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.loadExpiringLots();
  }

  getDepotName(lot: ExpiringLotDto): string {
    if (!lot.depot) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(lot.depot, currentLang) || 'N/A';
  }

  getSupplierName(lot: ExpiringLotDto): string {
    if (!lot.supplier) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(lot.supplier, currentLang) || 'N/A';
  }

  getManufacturerName(lot: ExpiringLotDto): string {
    if (!lot.manufacturer) return 'N/A';
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(lot.manufacturer, currentLang) || 'N/A';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return 'N/A';
    }
  }
}

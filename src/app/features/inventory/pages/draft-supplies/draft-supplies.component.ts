import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MonitoringService } from '@services/monitoring.service';
import { DraftSupplyListItemDto } from '@models/inventory-dashboard-monitoring.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { defaultPageSize } from '@constants/app.constants';

@Component({
  selector: 'app-draft-supplies',
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
  templateUrl: './draft-supplies.component.html',
  styleUrls: ['./draft-supplies.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DraftSuppliesComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  private readonly destroy$ = new Subject<void>();

  rows: DraftSupplyListItemDto[] = [];
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

  get paginatedRows(): DraftSupplyListItemDto[] {
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
    this.route.queryParamMap
      .pipe(
        switchMap(q => {
          const depotIds = q.getAll('depotIds').map(Number).filter(n => !Number.isNaN(n));
          this.loading = true;
          this.error = null;
          this.cdr.markForCheck();
          return this.monitoringService.getDraftSuppliesList(
            depotIds.length > 0 ? depotIds : undefined
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: items => {
          this.rows = items ?? [];
          this.loading = false;
          this.currentPage = 1;
          this.cdr.markForCheck();
        },
        error: err => {
          this.error = ErrorHandler.extractErrorMessage(err, 'Failed to load requests pending issuance');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

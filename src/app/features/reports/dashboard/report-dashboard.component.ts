import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, FileText } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ReportService, Report } from '@services/report.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-report-dashboard',
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
  templateUrl: './report-dashboard.component.html',
  styleUrls: ['./report-dashboard.component.css']
})
export class ReportDashboardComponent implements OnInit {
  readonly Eye = Eye;
  readonly FileText = FileText;

  reports: Report[] = [];
  filteredReports: Report[] = [];
  searchTerm = '';
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;
  totalItems = 0;

  constructor(
    private translationService: TranslationService,
    private translateService: TranslateService,
    private router: Router,
    private reportService: ReportService
  ) { }

  ngOnInit(): void {
    this.loadReports();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadReports(): void {
    this.loading = true;
    this.error = null;

    this.reportService.getPublicReports()
      .pipe(
        catchError((err) => {
          console.error('Error loading public reports:', err);
          this.error = this.translateService.instant('common.errorLoadingData');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((reports) => {
        this.reports = reports;
        this.filteredReports = [...this.reports];
        this.updatePagination();
      });
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    const normalized = term.toLowerCase().trim();

    if (!normalized) {
      this.filteredReports = [...this.reports];
    } else {
      this.filteredReports = this.reports.filter(report =>
        report.reportName?.toLowerCase().includes(normalized)
      );
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  onViewReport(report: Report): void {
    // Navigate to report viewer component with report URL and name as query parameters
    this.router.navigate(['/report-viewer'], {
      queryParams: {
        reportUrl: report.url,
        reportName: report.reportName
      }
    });
  }

  getStatusClass(status: string): string {
    // Map backend status names to CSS classes
    const statusLower = status.toLowerCase();
    if (statusLower.includes('published') || statusLower.includes('active')) {
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30';
    }
    if (statusLower.includes('draft') || statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (statusLower.includes('archived') || statusLower.includes('inactive')) {
      return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)] border-[var(--color-border)]';
    }
    return 'bg-[var(--color-background-active)] text-[var(--color-text-muted)] border-[var(--color-border)]';
  }

  getStatusDisplayName(report: Report): string {
    // Use the appropriate status name based on current language
    const isRTL = this.translationService.isRTL();
    return isRTL && report.reportStatusNameAr ? report.reportStatusNameAr : report.reportStatusNameEn;
  }

  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  }

  updatePagination(): void {
    this.totalItems = this.filteredReports.length;
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  onRowsPerPageChange(rows: number): void {
    this.rowsPerPage = rows;
    this.currentPage = 1;
    this.updatePagination();
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.rowsPerPage);
  }

  get paginatedReports(): Report[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
    return this.filteredReports.slice(startIndex, endIndex);
  }
}

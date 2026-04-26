import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, FileText } from 'lucide-angular';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ReportService, Report } from '@reports/services/report.service';
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
    private translateService: TranslateService,
    private router: Router,
    private reportService: ReportService
  ) { }

  ngOnInit(): void {
    this.loadReports();
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
    // Open report viewer in a new tab with report URL and name as query parameters
    const url = this.router.createUrlTree(['/reports/report-viewer'], {
      queryParams: {
        reportUrl: report.url,
        reportName: report.reportName
      }
    }).toString();
    
    // Open in new tab
    window.open(url, '_blank');
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

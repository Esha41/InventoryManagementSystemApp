import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Search, Edit, Trash2, Play, Calendar, Mail, Clock, FileText, Power, PowerOff, History } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ButtonComponent } from '@components/button/button.component';
import { ExecutionHistoryDialogComponent } from './execution-history-dialog/execution-history-dialog.component';
import { ReportService, ScheduledReport, ScheduledReportRecipient } from '@services/report.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-scheduled-reports-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    ExecutionHistoryDialogComponent,
    PaginationComponent,
    RowsPerPageComponent,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './scheduled-reports-list.component.html',
  styleUrls: ['./scheduled-reports-list.component.css']
})
export class ScheduledReportsListComponent implements OnInit {
  readonly Plus = Plus;
  readonly Search = Search;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Play = Play;
  readonly Calendar = Calendar;
  readonly Mail = Mail;
  readonly Clock = Clock;
  readonly FileText = FileText;
  readonly Power = Power;
  readonly PowerOff = PowerOff;
  readonly History = History;

  scheduledReports: ScheduledReport[] = [];
  filteredReports: ScheduledReport[] = [];
  searchTerm = '';
  loading = false;
  error: string | null = null;
  showHistoryDialog = false;
  selectedReportId: string | null = null;

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
    this.loadScheduledReports();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  loadScheduledReports(): void {
    this.loading = true;
    this.error = null;

    this.reportService.getScheduledReports()
      .pipe(
        catchError((err) => {
          console.error('Error loading scheduled reports:', err);
          this.error = this.translateService.instant('common.errorLoadingData');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((reports: ScheduledReport[]) => {
        this.scheduledReports = reports;
        this.filteredReports = [...this.scheduledReports];
        this.updatePagination();
      });
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    const normalized = term.toLowerCase().trim();

    if (!normalized) {
      this.filteredReports = [...this.scheduledReports];
    } else {
      this.filteredReports = this.scheduledReports.filter(report =>
        report.scheduleName?.toLowerCase().includes(normalized) ||
        report.reportName?.toLowerCase().includes(normalized)
      );
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  onCreateSchedule(): void {
    this.router.navigate(['/scheduled-reports/create']);
  }

  onEdit(report: ScheduledReport): void {
    this.router.navigate(['/scheduled-reports', report.id, 'edit']);
  }

  onDelete(report: ScheduledReport): void {
    if (confirm(this.translateService.instant('common.confirmDelete'))) {
      this.reportService.deleteScheduledReport(report.id)
        .pipe(
          catchError((err) => {
            console.error('Error deleting scheduled report:', err);
            alert(this.translateService.instant('common.errorDeleting'));
            return of(false);
          })
        )
        .subscribe((success: boolean) => {
          if (success) {
            this.loadScheduledReports();
          }
        });
    }
  }

  onToggleActive(report: ScheduledReport): void {
    this.reportService.toggleScheduledReportActive(report.id, !report.isActive)
      .pipe(
        catchError((err) => {
          console.error('Error toggling scheduled report:', err);
          alert(this.translateService.instant('common.errorUpdating'));
          return of(false);
        })
      )
      .subscribe((success: boolean) => {
        if (success) {
          this.loadScheduledReports();
        }
      });
  }

  onExecuteNow(report: ScheduledReport): void {
    this.reportService.executeScheduledReportNow(report.id)
      .pipe(
        catchError((err) => {
          console.error('Error executing scheduled report:', err);
          alert(this.translateService.instant('common.errorExecuting'));
          return of(false);
        })
      )
      .subscribe((success: boolean) => {
        if (success) {
          alert(this.translateService.instant('scheduledReports.executionStarted'));
          this.loadScheduledReports();
        }
      });
  }

  getFrequencyDisplay(frequency: string, dayOfWeek?: number, dayOfMonth?: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    switch (frequency.toLowerCase()) {
      case 'daily':
        return this.translateService.instant('scheduledReports.daily');
      case 'weekly':
        if (dayOfWeek !== undefined && dayOfWeek >= 0 && dayOfWeek < 7) {
          return `${this.translateService.instant('scheduledReports.weekly')} (${days[dayOfWeek]})`;
        }
        return this.translateService.instant('scheduledReports.weekly');
      case 'monthly':
        if (dayOfMonth !== undefined) {
          return `${this.translateService.instant('scheduledReports.monthly')} (Day ${dayOfMonth})`;
        }
        return this.translateService.instant('scheduledReports.monthly');
      default:
        return frequency;
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getRecipientCount(report: ScheduledReport): number {
    return report.recipients?.length || 0;
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

  get paginatedReports(): ScheduledReport[] {
    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
    const endIndex = startIndex + this.rowsPerPage;
    return this.filteredReports.slice(startIndex, endIndex);
  }

  onViewHistory(report: ScheduledReport): void {
    this.selectedReportId = report.id;
    this.showHistoryDialog = true;
  }

  onHistoryDialogClose(): void {
    this.showHistoryDialog = false;
    this.selectedReportId = null;
  }
}

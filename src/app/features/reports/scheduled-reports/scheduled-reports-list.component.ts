import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Search, Edit, Trash2, Play, Calendar, Mail, Clock, FileText, Power, PowerOff, History, Loader2, CheckCircle2, XCircle } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { PaginationComponent, RowsPerPageComponent, LoadingStateComponent, ErrorStateComponent, ConfirmDialogComponent } from '@components/index';
import { ButtonComponent } from '@components/button/button.component';
import { ExecutionHistoryDialogComponent } from './execution-history-dialog/execution-history-dialog.component';
import { ReportService, ScheduledReport, ScheduledReportRecipient } from '@reports/services/report.service';
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
    ErrorStateComponent,
    ConfirmDialogComponent
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
  readonly Loader2 = Loader2;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;

  scheduledReports: ScheduledReport[] = [];
  filteredReports: ScheduledReport[] = [];
  searchTerm = '';
  loading = false;
  error: string | null = null;
  showHistoryDialog = false;
  selectedReportId: string | null = null;
  showDeleteConfirm = false;
  reportToDelete: ScheduledReport | null = null;
  
  // Track execution state for each report: 'idle' | 'executing' | 'success' | 'failed'
  executingReports: Map<string, 'executing' | 'success' | 'failed'> = new Map();

  // Pagination
  currentPage = 1;
  rowsPerPage = 10;
  totalItems = 0;

  constructor(
    private translationService: TranslationService,
    private translateService: TranslateService,
    private router: Router,
    private reportService: ReportService,
    private toastService: ToastService
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
    this.reportToDelete = report;
    this.showDeleteConfirm = true;
  }

  onDeleteConfirm(): void {
    if (this.reportToDelete) {
      this.reportService.deleteScheduledReport(this.reportToDelete.id)
        .pipe(
          catchError((err) => {
            console.error('Error deleting scheduled report:', err);
            this.toastService.error(
              this.translateService.instant('common.errorDeleting'),
              this.translateService.instant('common.error')
            );
            return of(false);
          })
        )
        .subscribe((success: boolean) => {
          if (success) {
            this.showDeleteConfirm = false;
            const scheduleName = this.reportToDelete?.scheduleName || '';
            this.reportToDelete = null;
            this.toastService.success(
              this.translateService.instant('scheduledReports.scheduleDeleted', { scheduleName }),
              this.translateService.instant('common.success')
            );
            this.loadScheduledReports();
          }
        });
    }
  }

  onDeleteCancel(): void {
    this.showDeleteConfirm = false;
    this.reportToDelete = null;
  }

  onToggleActive(report: ScheduledReport): void {
    const newStatus = !report.isActive;
    this.reportService.toggleScheduledReportActive(report.id, newStatus)
      .pipe(
        catchError((err) => {
          console.error('Error toggling scheduled report:', err);
          this.toastService.error(
            this.translateService.instant('common.errorUpdating'),
            this.translateService.instant('common.error')
          );
          return of(false);
        })
      )
      .subscribe((success: boolean) => {
        if (success) {
          const message = newStatus
            ? this.translateService.instant('scheduledReports.scheduleEnabled', { scheduleName: report.scheduleName })
            : this.translateService.instant('scheduledReports.scheduleDisabled', { scheduleName: report.scheduleName });
          this.toastService.success(
            message,
            this.translateService.instant('common.success')
          );
          this.loadScheduledReports();
        }
      });
  }

  onExecuteNow(report: ScheduledReport): void {
    // Prevent execution if report is disabled
    if (!report.isActive) {
      this.toastService.error(
        this.translateService.instant('scheduledReports.cannotExecuteDisabled'),
        this.translateService.instant('common.error')
      );
      return;
    }

    // Prevent execution if already executing
    if (this.executingReports.get(report.id) === 'executing') {
      return;
    }

    // Set executing state
    this.executingReports.set(report.id, 'executing');

    // Show toast when execution starts
    this.toastService.info(
      this.translateService.instant('scheduledReports.executionStarted', { scheduleName: report.scheduleName }),
      this.translateService.instant('scheduledReports.executing')
    );

    this.reportService.executeScheduledReportNow(report.id)
      .pipe(
        catchError((err) => {
          console.error('Error executing scheduled report:', err);
          // Set failed state
          this.executingReports.set(report.id, 'failed');
          
          // Check if the error is because the report is disabled
          const errorMessage = err?.error?.message || err?.message || '';
          let errorToastMessage = '';
          if (errorMessage.includes('disabled') || errorMessage.includes('Cannot execute')) {
            errorToastMessage = this.translateService.instant('scheduledReports.cannotExecuteDisabled');
          } else {
            errorToastMessage = this.translateService.instant('scheduledReports.executionFailed', { scheduleName: report.scheduleName });
          }
          
          // Show error toast
          this.toastService.error(
            errorToastMessage,
            this.translateService.instant('common.error')
          );
          
          // Reset state after 3 seconds
          setTimeout(() => {
            this.executingReports.delete(report.id);
          }, 3000);
          return of(false);
        }),
        finalize(() => {
          // This will run after success or error
        })
      )
      .subscribe((success: boolean) => {
        if (success) {
          // Set success state
          this.executingReports.set(report.id, 'success');
          
          // Show success toast
          this.toastService.success(
            this.translateService.instant('scheduledReports.executionSuccess', { scheduleName: report.scheduleName }),
            this.translateService.instant('common.success')
          );
          
          // Reset to idle state after 3 seconds
          setTimeout(() => {
            this.executingReports.delete(report.id);
            // Refresh the list to get updated execution history
            this.loadScheduledReports();
          }, 3000);
        } else {
          // If success is false (but no error was thrown), set failed state
          this.executingReports.set(report.id, 'failed');
          this.toastService.error(
            this.translateService.instant('scheduledReports.executionFailed', { scheduleName: report.scheduleName }),
            this.translateService.instant('common.error')
          );
          setTimeout(() => {
            this.executingReports.delete(report.id);
          }, 3000);
        }
      });
  }

  getExecutionState(reportId: string): 'executing' | 'success' | 'failed' | null {
    return this.executingReports.get(reportId) || null;
  }

  getExecutionIcon(reportId: string): any {
    const state = this.getExecutionState(reportId);
    switch (state) {
      case 'executing':
        return this.Loader2;
      case 'success':
        return this.CheckCircle2;
      case 'failed':
        return this.XCircle;
      default:
        return this.Play;
    }
  }

  getExecutionColor(reportId: string): string {
    const state = this.getExecutionState(reportId);
    switch (state) {
      case 'executing':
        return 'text-[var(--color-info)]';
      case 'success':
        return 'text-[var(--color-success)]';
      case 'failed':
        return 'text-[var(--color-error)]';
      default:
        return 'text-[var(--color-info)]';
    }
  }

  getExecutionTitle(reportId: string): string {
    const state = this.getExecutionState(reportId);
    const report = this.scheduledReports.find(r => r.id === reportId);
    if (!report?.isActive) {
      return this.translateService.instant('scheduledReports.cannotExecuteDisabled');
    }
    switch (state) {
      case 'executing':
        return this.translateService.instant('scheduledReports.executing');
      case 'success':
        return this.translateService.instant('scheduledReports.executionSuccess');
      case 'failed':
        return this.translateService.instant('scheduledReports.executionFailed');
      default:
        return this.translateService.instant('scheduledReports.executeNow');
    }
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

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Clock, CheckCircle, XCircle, Mail, File } from 'lucide-angular';
import { ModalComponent } from '@components/modal/modal.component';
import { ReportService } from '@reports/services/report.service';
import { ScheduledReportExecution } from '@models/report.model';
import { ConfigService } from '@services/config.service';
import { Subject, of, takeUntil } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-execution-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    ModalComponent
  ],
  templateUrl: './execution-history-dialog.component.html',
  styleUrls: ['./execution-history-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionHistoryDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() scheduledReportId: string = '';
  @Output() closed = new EventEmitter<void>();

  executions: ScheduledReportExecution[] = [];
  loading = false;
  error: string | null = null;

  readonly Clock = Clock;
  readonly CheckCircle = CheckCircle;
  readonly XCircle = XCircle;
  readonly Mail = Mail;
  readonly File = File;

  private destroy$ = new Subject<void>();

  constructor(
    private reportService: ReportService,
    private translateService: TranslateService,
    private config: ConfigService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    if (this.scheduledReportId) {
      this.loadHistory();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scheduledReportId'] && this.scheduledReportId && this.isOpen) {
      this.loadHistory();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadHistory(): void {
    if (!this.scheduledReportId) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.reportService.getExecutionHistory(this.scheduledReportId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.config.logError('Error loading execution history', err);
          this.error = this.translateService.instant('common.error');
          this.cdr.markForCheck();
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((executions) => {
        this.executions = executions;
        this.cdr.markForCheck();
      });
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString();
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  getStatusIcon(status: string) {
    return status === 'Success' ? this.CheckCircle : this.XCircle;
  }

  getStatusClass(status: string): string {
    if (status === 'Success') {
      return 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30';
    }
    return 'bg-[var(--color-error)]/20 text-[var(--color-error)] border-[var(--color-error)]/30';
  }

  onClose(): void {
    this.closed.emit();
  }
}

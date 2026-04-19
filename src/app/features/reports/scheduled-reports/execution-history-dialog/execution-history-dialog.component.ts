import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Clock, CheckCircle, XCircle, Mail, File } from 'lucide-angular';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ReportService, ScheduledReportExecution } from '@services/report.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

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
  styleUrls: ['./execution-history-dialog.component.css']
})
export class ExecutionHistoryDialogComponent implements OnInit, OnChanges {
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

  constructor(
    private reportService: ReportService,
    private translateService: TranslateService
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

  loadHistory(): void {
    if (!this.scheduledReportId) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.reportService.getExecutionHistory(this.scheduledReportId)
      .pipe(
        catchError((err) => {
          console.error('Error loading execution history:', err);
          this.error = this.translateService.instant('common.error');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((executions) => {
        this.executions = executions;
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

import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Package } from 'lucide-angular';
import { SupplyService, WorkflowSupplySummaryDto } from '@services/supply.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-workflow-supply-summary',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe],
  templateUrl: './workflow-supply-summary.component.html',
  styleUrls: ['./workflow-supply-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowSupplySummaryComponent implements OnInit {
  readonly Package = Package;

  @Input({ required: true }) orderId!: number;
  @Input({ required: true }) destroy$!: Subject<void>;

  loading = true;
  error: string | null = null;
  summary: WorkflowSupplySummaryDto | null = null;

  constructor(
    private supplyService: SupplyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.supplyService.getWorkflowSupplySummary(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.summary = data;
          this.loading = false;
          this.error = null;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = ErrorHandler.extractErrorMessage(err, 'workflowApprovalDetail.workflowSupplySummary.loadError');
          this.loading = false;
          this.summary = null;
          this.cdr.markForCheck();
        }
      });
  }

  submissionLabelKey(status: number): string {
    if (status === 2) {
      return 'workflowApprovalDetail.workflowSupplySummary.submissionSubmitted';
    }
    return 'workflowApprovalDetail.workflowSupplySummary.submissionDraft';
  }

  fulfillmentLabelKey(status: number): string {
    if (status === 2) {
      return 'workflowApprovalDetail.workflowSupplySummary.fulfillmentFull';
    }
    return 'workflowApprovalDetail.workflowSupplySummary.fulfillmentPartial';
  }

  depotDisplay(line: { depotName?: string | null; depotCode?: string | null }): string {
    const name = (line.depotName || '').trim();
    const code = (line.depotCode || '').trim();
    if (name && code) {
      return `${name} (${code})`;
    }
    return name || code || '—';
  }
}

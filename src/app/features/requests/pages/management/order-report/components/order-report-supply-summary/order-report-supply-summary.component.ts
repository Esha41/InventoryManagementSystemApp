import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { SupplyService, WorkflowSupplySummaryDto } from '@requests/services/supply.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-order-report-supply-summary',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDateTimePipe],
  templateUrl: './order-report-supply-summary.component.html',
  styleUrls: ['./order-report-supply-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderReportSupplySummaryComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) orderId!: number;

  loading = true;
  error: string | null = null;
  summary: WorkflowSupplySummaryDto | null = null;

  private loadSub?: Subscription;

  constructor(
    private supplyService: SupplyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchSummary();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] && !changes['orderId'].firstChange && this.orderId != null) {
      this.fetchSummary();
    }
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
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

  suppliedColumnKey(): string {
    return this.summary?.isOrderCompleted
      ? 'requestsManagement.orderReport.table.suppliedQty'
      : 'requestsManagement.orderReport.table.shouldBeSuppliedQty';
  }

  depotDisplay(line: { depotName?: string | null; depotCode?: string | null }): string {
    const name = (line.depotName || '').trim();
    const code = (line.depotCode || '').trim();
    if (name && code) {
      return `${name} (${code})`;
    }
    return name || code || '—';
  }

  showSupplyDateRow(): boolean {
    return !!this.summary?.supplyDate && this.summary.isOrderCompleted === true;
  }

  isSuppliedPhase(): boolean {
    return this.summary?.phase === 'Supplied';
  }

  isAmmoPhase(): boolean {
    return !this.summary?.isWeaponOrder || this.summary?.phase === 'None' || !this.summary?.phase;
  }

  hasWeaponSuppliedLines(): boolean {
    return !!this.summary?.weaponLines?.length;
  }

  private fetchSummary(): void {
    if (this.orderId == null) {
      return;
    }
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = null;
    this.summary = null;
    this.cdr.markForCheck();

    this.loadSub = this.supplyService.getWorkflowSupplySummary(this.orderId).subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
        this.error = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = ErrorHandler.extractErrorMessage(
          err,
          'requestsManagement.orderReport.supplySummary.loadError'
        );
        this.loading = false;
        this.summary = null;
        this.cdr.markForCheck();
      }
    });
  }
}

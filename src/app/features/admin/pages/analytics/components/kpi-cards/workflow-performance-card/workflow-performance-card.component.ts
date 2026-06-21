import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ClipboardList, AlertTriangle } from 'lucide-angular';
import { AdminAnalyticsService } from '@admin/services/admin-analytics.service';
import type { AgingBucketsDto, WorkflowPerformance } from '@admin/models/admin-analytics.model';
import { LoggingService } from '@services/logging.service';

interface AgingSegment {
  key: string;
  count: number;
  labelKey: string;
  dotClass: string;
}

/**
 * Workflow Performance KPI card.
 * Completed throughput (top) and open queue (bottom) are separate sections — never mixed.
 */
@Component({
  selector: 'app-workflow-performance-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './workflow-performance-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }
})
export class WorkflowPerformanceCardComponent {
  readonly ClipboardList = ClipboardList;
  readonly AlertTriangle = AlertTriangle;

  private perf$ = this.analyticsService.getWorkflowPerformance().pipe(
    catchError((error) => {
      this.loggingService.error('Error loading workflow performance', error);
      return of(null as WorkflowPerformance | null);
    })
  );

  readonly perf = toSignal(this.perf$);

  readonly loading = computed(() => this.perf() === undefined);
  readonly errored = computed(() => this.perf() === null);
  readonly data = computed(() => this.perf() ?? null);

  readonly approvalTime = computed(() => this.formatDuration(this.data()?.medianCycleHours));
  readonly delayedApprovalTime = computed(() => this.formatDuration(this.data()?.p90CycleHours));

  readonly hasCompleted = computed(() => (this.data()?.completedCount ?? 0) > 0);
  readonly hasDecisions = computed(() => {
    const d = this.data();
    return !!d && (d.approvedCount + d.rejectedCount) > 0;
  });
  readonly hasPending = computed(() => (this.data()?.totalPending ?? 0) > 0);

  readonly completedSegments = computed(() => buildAgingSegments(this.data()?.completedAging));
  readonly pendingSegments = computed(() => buildAgingSegments(this.data()?.pendingAging));

  constructor(
    private analyticsService: AdminAnalyticsService,
    private loggingService: LoggingService
  ) { }

  private formatDuration(hours: number | undefined): { value: string; unitKey: string } {
    if (hours == null || hours <= 0) {
      return { value: '0', unitKey: 'adminDashboard.workflow.hoursShort' };
    }
    if (hours >= 24) {
      return { value: (hours / 24).toFixed(1), unitKey: 'adminDashboard.workflow.daysShort' };
    }
    return { value: hours.toFixed(1), unitKey: 'adminDashboard.workflow.hoursShort' };
  }
}

function buildAgingSegments(aging: AgingBucketsDto | undefined | null): AgingSegment[] {
  return [
    { key: 'up3', count: aging?.upTo3Days ?? 0, labelKey: 'adminDashboard.workflow.age0to3', dotClass: 'bg-emerald-500' },
    { key: 'd3to7', count: aging?.from3To7Days ?? 0, labelKey: 'adminDashboard.workflow.age3to7', dotClass: 'bg-amber-400' },
    { key: 'd7to14', count: aging?.from7To14Days ?? 0, labelKey: 'adminDashboard.workflow.age7to14', dotClass: 'bg-orange-500' },
    { key: 'over14', count: aging?.over14Days ?? 0, labelKey: 'adminDashboard.workflow.age14plus', dotClass: 'bg-red-500' }
  ];
}

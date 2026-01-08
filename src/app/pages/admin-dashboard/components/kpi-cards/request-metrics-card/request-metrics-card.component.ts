import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileText, Clock, CheckCircle2, Target } from 'lucide-angular';
import { RequestMetrics } from '@services/admin-analytics.service';

/**
 * Request Metrics Card Component
 * Displays request management statistics
 */
@Component({
    selector: 'app-request-metrics-card',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    template: `
    <div class="request-card">
      <div class="card-header">
        <lucide-icon [img]="FileText" class="card-icon"></lucide-icon>
        <h3 class="card-title">{{ 'adminDashboard.requests.title' | translate }}</h3>
      </div>

      <div class="total-pending">
        <div class="pending-value">{{ metrics.totalPending }}</div>
        <div class="pending-label">{{ 'adminDashboard.requests.totalPending' | translate }}</div>
      </div>

      <div class="request-types">
        <div class="type-item">
          <div class="type-dot orders"></div>
          <div class="type-content">
            <div class="type-value">{{ metrics.pendingOrders }}</div>
            <div class="type-label">{{ 'adminDashboard.requests.orders' | translate }}</div>
          </div>
        </div>

        <div class="type-item">
          <div class="type-dot returns"></div>
          <div class="type-content">
            <div class="type-value">{{ metrics.pendingReturns }}</div>
            <div class="type-label">{{ 'adminDashboard.requests.returns' | translate }}</div>
          </div>
        </div>

        <div class="type-item">
          <div class="type-dot discards"></div>
          <div class="type-content">
            <div class="type-value">{{ metrics.pendingDiscards }}</div>
            <div class="type-label">{{ 'adminDashboard.requests.discards' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="performance-metrics">
        <div class="perf-item">
          <lucide-icon [img]="Clock" class="perf-icon"></lucide-icon>
          <div class="perf-content">
            <div class="perf-value">{{ metrics.avgApprovalTime }}h</div>
            <div class="perf-label">{{ 'adminDashboard.requests.avgApprovalTime' | translate }}</div>
          </div>
        </div>

        <div class="perf-item">
          <lucide-icon [img]="Target" class="perf-icon"></lucide-icon>
          <div class="perf-content">
            <div class="perf-value">{{ metrics.slaCompliance }}%</div>
            <div class="perf-label">{{ 'adminDashboard.requests.slaCompliance' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="last-updated">
          {{ 'adminDashboard.lastUpdated' | translate }}: {{ metrics.lastUpdated | date:'short' }}
        </div>
      </div>
    </div>
  `,
    styles: [`
    .request-card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .card-icon {
      width: 1.5rem;
      height: 1.5rem;
      color: var(--color-primary);
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0;
    }

    .total-pending {
      text-align: center;
      padding: 1.5rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);
      border-radius: 12px;
      margin-bottom: 1.5rem;
    }

    .pending-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--color-primary);
      line-height: 1;
    }

    .pending-label {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin-top: 0.5rem;
    }

    .request-types {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .type-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--color-background);
      border-radius: 8px;
    }

    .type-dot {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
    }

    .type-dot.orders {
      background: rgb(59, 130, 246);
    }

    .type-dot.returns {
      background: rgb(168, 85, 247);
    }

    .type-dot.discards {
      background: rgb(249, 115, 22);
    }

    .type-content {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .type-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .type-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }

    .performance-metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .perf-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--color-background);
      border-radius: 8px;
    }

    .perf-icon {
      width: 1.5rem;
      height: 1.5rem;
      color: var(--color-primary);
    }

    .perf-content {
      text-align: center;
    }

    .perf-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .perf-label {
      font-size: 0.625rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }

    .card-footer {
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
    }

    .last-updated {
      color: var(--color-text-muted);
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestMetricsCardComponent {
    @Input() metrics!: RequestMetrics;

    readonly FileText = FileText;
    readonly Clock = Clock;
    readonly CheckCircle2 = CheckCircle2;
    readonly Target = Target;
}

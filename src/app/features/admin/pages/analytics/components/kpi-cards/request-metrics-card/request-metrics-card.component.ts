import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileText } from 'lucide-angular';
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

      <div class="status-breakdown">
        <div class="status-item new">
          <div class="status-value">{{ metrics.newRequests }}</div>
          <div class="status-label">{{ 'adminDashboard.requests.new' | translate }}</div>
        </div>

        <div class="status-item inprogress">
          <div class="status-value">{{ metrics.inProgressRequests }}</div>
          <div class="status-label">{{ 'adminDashboard.requests.inProgress' | translate }}</div>
        </div>

        <div class="status-item completed">
          <div class="status-value">{{ metrics.completedRequests }}</div>
          <div class="status-label">{{ 'adminDashboard.requests.completed' | translate }}</div>
        </div>

        <div class="status-item rejected">
          <div class="status-value">{{ metrics.rejectedRequests }}</div>
          <div class="status-label">{{ 'adminDashboard.requests.rejected' | translate }}</div>
        </div>
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

    .status-breakdown {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .status-item {
      text-align: center;
      padding: 1rem;
      border-radius: 8px;
      border: 2px solid;
    }

    .status-item.new {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgb(59, 130, 246);
    }

    .status-item.inprogress {
      background: rgba(249, 115, 22, 0.1);
      border-color: rgb(249, 115, 22);
    }

    .status-item.completed {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgb(34, 197, 94);
    }

    .status-item.rejected {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgb(239, 68, 68);
    }

    .status-value {
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1;
    }

    .status-item.new .status-value {
      color: rgb(59, 130, 246);
    }

    .status-item.inprogress .status-value {
      color: rgb(249, 115, 22);
    }

    .status-item.completed .status-value {
      color: rgb(34, 197, 94);
    }

    .status-item.rejected .status-value {
      color: rgb(239, 68, 68);
    }

    .status-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.5rem;
      font-weight: 500;
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
}

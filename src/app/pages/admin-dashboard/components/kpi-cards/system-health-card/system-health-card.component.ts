import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Activity, Zap, Clock, AlertTriangle, CheckCircle } from 'lucide-angular';
import { SystemHealthMetrics } from '@services/admin-analytics.service';

/**
 * System Health Card Component
 * Displays real-time system health metrics
 */
@Component({
    selector: 'app-system-health-card',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    template: `
    <div class="health-card" *ngIf="metrics">
      <div class="card-header">
        <div class="header-left">
          <lucide-icon [img]="Activity" class="card-icon"></lucide-icon>
          <h3 class="card-title">{{ 'adminDashboard.systemHealth.title' | translate }}</h3>
        </div>
        <div class="status-badge" [ngClass]="getStatusClass()">
          <lucide-icon [img]="getStatusIcon()" class="status-icon"></lucide-icon>
          <span>{{ getStatusLabel() | translate }}</span>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-icon-wrapper blue">
            <lucide-icon [img]="Activity" class="metric-icon"></lucide-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics?.activeUsers || 0 }}</div>
            <div class="metric-label">{{ 'adminDashboard.systemHealth.activeUsers' | translate }}</div>
          </div>
        </div>

        <div class="metric-item">
          <div class="metric-icon-wrapper green">
            <lucide-icon [img]="CheckCircle" class="metric-icon"></lucide-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics?.systemUptime || 0 }}%</div>
            <div class="metric-label">{{ 'adminDashboard.systemHealth.uptime' | translate }}</div>
          </div>
        </div>

        <div class="metric-item">
          <div class="metric-icon-wrapper purple">
            <lucide-icon [img]="Zap" class="metric-icon"></lucide-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics?.avgResponseTime || 0 }}ms</div>
            <div class="metric-label">{{ 'adminDashboard.systemHealth.responseTime' | translate }}</div>
          </div>
        </div>

        <div class="metric-item">
          <div class="metric-icon-wrapper orange">
            <lucide-icon [img]="Clock" class="metric-icon"></lucide-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics?.activeRequests || 0 }}</div>
            <div class="metric-label">{{ 'adminDashboard.systemHealth.activeRequests' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="error-rate" [ngClass]="getErrorRateClass()">
          <lucide-icon [img]="AlertTriangle" class="footer-icon"></lucide-icon>
          <span>{{ 'adminDashboard.systemHealth.errorRate' | translate }}: {{ (metrics?.errorRate || 0).toFixed(2) }}%</span>
        </div>
        <div class="last-updated">
          {{ 'adminDashboard.lastUpdated' | translate }}: {{ metrics?.lastUpdated | date:'short' }}
        </div>
      </div>
    </div>
    <div class="loading-state" *ngIf="!metrics">
      <p>Loading system health metrics...</p>
    </div>
  `,
    styles: [`
    .health-card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
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

    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-badge.healthy {
      background: rgba(34, 197, 94, 0.1);
      color: rgb(34, 197, 94);
    }

    .status-badge.degraded {
      background: rgba(234, 179, 8, 0.1);
      color: rgb(234, 179, 8);
    }

    .status-badge.critical {
      background: rgba(239, 68, 68, 0.1);
      color: rgb(239, 68, 68);
    }

    .status-icon {
      width: 1rem;
      height: 1rem;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      flex: 1;
    }

    .metric-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--color-background);
      border-radius: 8px;
    }

    .metric-icon-wrapper {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .metric-icon-wrapper.blue {
      background: rgba(59, 130, 246, 0.1);
      color: rgb(59, 130, 246);
    }

    .metric-icon-wrapper.green {
      background: rgba(34, 197, 94, 0.1);
      color: rgb(34, 197, 94);
    }

    .metric-icon-wrapper.purple {
      background: rgba(168, 85, 247, 0.1);
      color: rgb(168, 85, 247);
    }

    .metric-icon-wrapper.orange {
      background: rgba(249, 115, 22, 0.1);
      color: rgb(249, 115, 22);
    }

    .metric-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .metric-content {
      flex: 1;
    }

    .metric-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.2;
    }

    .metric-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.125rem;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .error-rate {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-weight: 600;
    }

    .error-rate.low {
      color: rgb(34, 197, 94);
    }

    .error-rate.medium {
      color: rgb(234, 179, 8);
    }

    .error-rate.high {
      color: rgb(239, 68, 68);
    }

    .footer-icon {
      width: 0.875rem;
      height: 0.875rem;
    }

    .last-updated {
      color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SystemHealthCardComponent {
    @Input() metrics!: SystemHealthMetrics;

    readonly Activity = Activity;
    readonly Zap = Zap;
    readonly Clock = Clock;
    readonly AlertTriangle = AlertTriangle;
    readonly CheckCircle = CheckCircle;

    getStatusClass(): string {
        return this.metrics.status;
    }

    getStatusLabel(): string {
        return `adminDashboard.status.${this.metrics.status}`;
    }

    getStatusIcon() {
        switch (this.metrics.status) {
            case 'healthy':
                return CheckCircle;
            case 'degraded':
            case 'critical':
                return AlertTriangle;
            default:
                return Activity;
        }
    }

    getErrorRateClass(): string {
        if (this.metrics.errorRate < 1) return 'low';
        if (this.metrics.errorRate < 5) return 'medium';
        return 'high';
    }
}

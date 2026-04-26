import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Users, TrendingUp } from 'lucide-angular';
import { UserActivityMetrics } from '@admin/services/admin-analytics.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

/**
 * User Activity Card Component
 * Displays user activity and department statistics
 */
@Component({
  selector: 'app-user-activity-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe],
  template: `
    <div class="activity-card">
      <div class="card-header">
        <lucide-icon [img]="Users" class="card-icon"></lucide-icon>
        <h3 class="card-title">{{ 'adminDashboard.userActivity.title' | translate }}</h3>
      </div>

      <div class="stats-grid">
        <div class="stat-box primary">
          <lucide-icon [img]="Users" class="stat-icon"></lucide-icon>
          <div class="stat-content">
            <div class="stat-value">{{ metrics.dailyActiveUsers }}</div>
            <div class="stat-label">{{ 'adminDashboard.userActivity.dailyActive' | translate }}</div>
          </div>
        </div>

        <div class="stat-box info">
          <lucide-icon [img]="TrendingUp" class="stat-icon"></lucide-icon>
          <div class="stat-content">
            <div class="stat-value">{{ metrics.totalUsers }}</div>
            <div class="stat-label">{{ 'adminDashboard.userActivity.totalUsers' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="departments-section">
        <h4 class="section-title">{{ 'adminDashboard.userActivity.topDepartments' | translate }}</h4>
        <div class="departments-list">
          <div *ngFor="let dept of metrics.topDepartments" class="dept-item">
            <div class="dept-name">{{ dept.name }}</div>
            <div class="dept-count">{{ dept.userCount }}</div>
          </div>
          <div *ngIf="metrics.topDepartments.length === 0" class="no-data">
            {{ 'adminDashboard.userActivity.noDepartments' | translate }}
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="last-updated">
          {{ 'adminDashboard.lastUpdated' | translate }}: {{ metrics.lastUpdated | appDateTime }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .activity-card {
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .stat-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem 0.5rem;
      border-radius: 8px;
    }

    .stat-box.primary {
      background: rgba(59, 130, 246, 0.1);
    }

    .stat-box.success {
      background: rgba(34, 197, 94, 0.1);
    }

    .stat-box.info {
      background: rgba(168, 85, 247, 0.1);
    }

    .stat-icon {
      width: 1.5rem;
      height: 1.5rem;
    }

    .stat-box.primary .stat-icon {
      color: rgb(59, 130, 246);
    }

    .stat-box.success .stat-icon {
      color: rgb(34, 197, 94);
    }

    .stat-box.info .stat-icon {
      color: rgb(168, 85, 247);
    }

    .stat-content {
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.625rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }

    .departments-section {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0 0 0.75rem 0;
    }

    .departments-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .dept-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.625rem 0.75rem;
      background: var(--color-background);
      border-radius: 6px;
    }

    .dept-name {
      font-size: 0.8125rem;
      color: var(--color-text);
      font-weight: 500;
    }

    .dept-count {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--color-primary);
      background: rgba(59, 130, 246, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .no-data {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }

    .card-footer {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
    }

    .last-updated {
      color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserActivityCardComponent {
  @Input() metrics!: UserActivityMetrics;

  readonly Users = Users;
  readonly TrendingUp = TrendingUp;
}

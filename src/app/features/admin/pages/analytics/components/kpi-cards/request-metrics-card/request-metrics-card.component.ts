import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileText } from 'lucide-angular';
import { RequestMetrics } from '@services/admin-analytics.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

/**
 * Request Metrics Card Component
 * Displays request management statistics
 */
@Component({
  selector: 'app-request-metrics-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe],
  template: `
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <lucide-icon [img]="FileText" class="w-6 h-6 text-[var(--color-brand)]"></lucide-icon>
        <h3 class="text-lg font-semibold text-[var(--color-text)] m-0">{{ 'adminDashboard.requests.title' | translate }}</h3>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div class="p-2 sm:p-3 rounded-lg text-center border-2 border-blue-500/20 bg-blue-500/10 overflow-hidden">
          <div class="text-xl sm:text-2xl font-bold text-blue-500 leading-none truncate">{{ metrics.newRequests }}</div>
          <div class="text-xs font-medium text-[var(--color-text-muted)] mt-2 truncate">{{ 'adminDashboard.requests.new' | translate }}</div>
        </div>

        <div class="p-2 sm:p-3 rounded-lg text-center border-2 border-orange-500/20 bg-orange-500/10 overflow-hidden">
          <div class="text-xl sm:text-2xl font-bold text-orange-500 leading-none truncate">{{ metrics.inProgressRequests }}</div>
          <div class="text-xs font-medium text-[var(--color-text-muted)] mt-2 truncate">{{ 'adminDashboard.requests.inProgress' | translate }}</div>
        </div>

        <div class="p-2 sm:p-3 rounded-lg text-center border-2 border-green-500/20 bg-green-500/10 overflow-hidden">
          <div class="text-xl sm:text-2xl font-bold text-green-500 leading-none truncate">{{ metrics.completedRequests }}</div>
          <div class="text-xs font-medium text-[var(--color-text-muted)] mt-2 truncate">{{ 'adminDashboard.requests.completed' | translate }}</div>
        </div>

        <div class="p-2 sm:p-3 rounded-lg text-center border-2 border-red-500/20 bg-red-500/10 overflow-hidden">
          <div class="text-xl sm:text-2xl font-bold text-red-500 leading-none truncate">{{ metrics.rejectedRequests }}</div>
          <div class="text-xs font-medium text-[var(--color-text-muted)] mt-2 truncate">{{ 'adminDashboard.requests.rejected' | translate }}</div>
        </div>
      </div>

      <div class="flex flex-col gap-3 mb-6 flex-1">
        <div class="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
          <div class="w-3 h-3 rounded-full bg-blue-500"></div>
          <div class="flex-1 flex justify-between items-center">
            <div class="text-xs text-[var(--color-text-muted)]">{{ 'adminDashboard.requests.orders' | translate }}</div>
            <div class="text-lg font-bold text-[var(--color-text)]">{{ metrics.pendingOrders }}</div>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
          <div class="w-3 h-3 rounded-full bg-purple-500"></div>
          <div class="flex-1 flex justify-between items-center">
            <div class="text-xs text-[var(--color-text-muted)]">{{ 'adminDashboard.requests.returns' | translate }}</div>
            <div class="text-lg font-bold text-[var(--color-text)]">{{ metrics.pendingReturns }}</div>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
          <div class="w-3 h-3 rounded-full bg-orange-500"></div>
          <div class="flex-1 flex justify-between items-center">
            <div class="text-xs text-[var(--color-text-muted)]">{{ 'adminDashboard.requests.discards' | translate }}</div>
            <div class="text-lg font-bold text-[var(--color-text)]">{{ metrics.pendingDiscards }}</div>
          </div>
        </div>
      </div>

      <div class="mt-auto pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        {{ 'adminDashboard.lastUpdated' | translate }}: {{ metrics.lastUpdated | appDateTime }}
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestMetricsCardComponent {
  @Input() metrics!: RequestMetrics;

  readonly FileText = FileText;
}

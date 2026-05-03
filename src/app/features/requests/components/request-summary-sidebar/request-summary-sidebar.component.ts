import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RequestDetail } from '@models/workflow-approval.model';
import { getRequestStatusBadgeClass } from '@utils/status-class.utils';

@Component({
    selector: 'app-request-summary-sidebar',
    standalone: true,
    imports: [CommonModule, TranslateModule],
    template: `
    <div class="space-y-6">
      <!-- Status Card -->
      <div class="bg-[var(--color-background)] rounded-xl shadow-custom-sm p-6 border-2 border-[var(--color-border)]">
        <h3 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">{{
          'supplyRequestManagement.detail.status' | translate }}</h3>
        <div class="space-y-4">
          <div
            class="flex items-center gap-3 p-3 bg-[var(--color-background-muted)] rounded-lg border-2 border-[var(--color-border)]">
            <div class="flex-1">
              <p class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">{{
                'supplyRequestManagement.detail.currentStatus' | translate }}</p>
              <p class="text-sm font-semibold text-[var(--color-text)]">
                {{ ('common.statuses.' + requestDetail.status) | translate }}
              </p>
            </div>
            <div [ngClass]="getStatusClass(requestDetail.status)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border shadow-custom-sm">
              {{ ('common.statuses.' + requestDetail.status) | translate }}
            </div>
          </div>
        </div>
      </div>

      <!-- Request Summary -->
      <div class="bg-[var(--color-background)] rounded-xl shadow-custom-sm p-6 border-2 border-[var(--color-border)]">
        <h3 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">{{
          'supplyRequestManagement.detail.summary' | translate }}</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center py-2 border-b-2 border-[var(--color-border)] last:border-0">
            <span class="text-sm text-[var(--color-text-muted)]">{{ 'supplyRequestManagement.detail.requestId' |
              translate }}</span>
            <span class="text-sm font-semibold text-[var(--color-text)]">#{{ requestDetail.id }}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b-2 border-[var(--color-border)] last:border-0">
            <span class="text-sm text-[var(--color-text-muted)]">{{ 'supplyRequestManagement.detail.type' | translate
              }}</span>
            <span class="text-sm font-semibold text-[var(--color-text)]">
              {{ ('common.requestTypes.' + requestDetail.requestType) | translate }}
            </span>
          </div>
          <div class="flex justify-between items-center py-2 border-b-2 border-[var(--color-border)] last:border-0">
            <span class="text-sm text-[var(--color-text-muted)]">{{ 'supplyRequestManagement.detail.prioritySuffix' |
              translate }}</span>
            <span class="text-sm font-semibold text-[var(--color-text)]">
              {{ ('common.priorityLevels.' + requestDetail.priority) | translate }}
            </span>
          </div>
          <div class="flex justify-between items-center py-2" *ngIf="requestDetail.requestItems">
            <span class="text-sm text-[var(--color-text-muted)]">{{ 'supplyRequestManagement.detail.itemsLabel' |
              translate }}</span>
            <span class="text-sm font-semibold text-[var(--color-text)]">{{ requestDetail.requestItems.length
              }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestSummarySidebarComponent {
    @Input() requestDetail!: RequestDetail;

    getStatusClass(status: string): string {
        return getRequestStatusBadgeClass(status);
    }
}

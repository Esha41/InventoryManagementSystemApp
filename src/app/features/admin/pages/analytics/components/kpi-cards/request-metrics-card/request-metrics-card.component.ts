import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, FileText } from 'lucide-angular';
import { RequestMetrics } from '@admin/services/admin-analytics.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

interface RequestStatusTile {
  value: (m: RequestMetrics) => number;
  labelKey: string;
  boxClass: string;
  valueClass: string;
}

@Component({
  selector: 'app-request-metrics-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe],
  templateUrl: './request-metrics-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full min-h-0' }
})
export class RequestMetricsCardComponent {
  @Input({ required: true }) metrics!: RequestMetrics;

  readonly FileText = FileText;

  readonly statusTiles: RequestStatusTile[] = [
    {
      value: m => m.newRequests,
      labelKey: 'adminDashboard.requests.new',
      boxClass: 'border-blue-200 bg-blue-50',
      valueClass: 'text-blue-600'
    },
    {
      value: m => m.inProgressRequests,
      labelKey: 'adminDashboard.requests.inProgress',
      boxClass: 'border-orange-200 bg-orange-50',
      valueClass: 'text-orange-600'
    },
    {
      value: m => m.completedRequests,
      labelKey: 'adminDashboard.requests.completed',
      boxClass: 'border-green-200 bg-green-50',
      valueClass: 'text-green-600'
    },
    {
      value: m => m.rejectedRequests,
      labelKey: 'adminDashboard.requests.rejected',
      boxClass: 'border-red-200 bg-red-50',
      valueClass: 'text-red-600'
    }
  ];
}

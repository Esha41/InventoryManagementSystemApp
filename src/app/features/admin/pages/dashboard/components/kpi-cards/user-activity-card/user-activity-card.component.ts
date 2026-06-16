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
  templateUrl: './user-activity-card.component.html',
  styleUrl: './user-activity-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserActivityCardComponent {
  @Input() metrics!: UserActivityMetrics;

  readonly Users = Users;
  readonly TrendingUp = TrendingUp;
}

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, LayoutDashboard, Users, Badge, Settings, Mail, Upload, GitBranch, Timer } from 'lucide-angular';
import { AdminAnalyticsService, UserActivityMetrics } from '@admin/services/admin-analytics.service';
import { UserActivityCardComponent } from './components/kpi-cards/user-activity-card/user-activity-card.component';
import { AdminDelegationsComponent } from './admin-delegations/admin-delegations.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

/**
 * Admin Dashboard Component
 * Main dashboard for system administrators
 */
@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        TranslateModule,
        FormsModule,
        LucideAngularModule,
        UserActivityCardComponent,
        AdminDelegationsComponent,
        HasPermissionDirective,
    ],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

    private readonly destroy$ = new Subject<void>();

    // Icons
    readonly Users = Users;
    readonly LayoutDashboard = LayoutDashboard;
    readonly Badge = Badge;
    readonly Settings = Settings;
    readonly Mail = Mail;
    readonly Upload = Upload;
    readonly GitBranch = GitBranch;
    readonly Timer = Timer;

    // Metrics
    userActivityMetrics: UserActivityMetrics | null = null;

    // Loading states
    isLoading = true;

    constructor(
        private adminAnalyticsService: AdminAnalyticsService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Start auto-refresh timer BEFORE subscribing to ensure it's active
        this.adminAnalyticsService.startAutoRefresh();

        // Subscribe to the observable stream - this will automatically update on refresh
        this.adminAnalyticsService.getUserActivityMetrics()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (metrics) => {
                    this.userActivityMetrics = metrics;
                    this.isLoading = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Error loading dashboard metrics:', error);
                    this.isLoading = false;
                    this.cdr.markForCheck();
                }
            });
    }

    ngOnDestroy(): void {
        this.adminAnalyticsService.stopAutoRefresh();
        this.destroy$.next();
        this.destroy$.complete();
    }

}

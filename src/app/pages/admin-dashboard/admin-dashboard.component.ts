import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, LayoutDashboard, Users, RefreshCw, Badge, Settings, Mail, Upload, GitBranch } from 'lucide-angular';
import { AdminAnalyticsService, UserActivityMetrics } from '@services/admin-analytics.service';
import { UserActivityCardComponent } from './components/kpi-cards/user-activity-card/user-activity-card.component';
// import { AdminDelegationsComponent } from './admin-delegations/admin-delegations.component';

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
        LucideAngularModule,
        UserActivityCardComponent,
        // AdminDelegationsComponent,
    ],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject<void>();

    // Icons
    readonly Users = Users;
    readonly RefreshCw = RefreshCw;
    readonly LayoutDashboard = LayoutDashboard;
    readonly Badge = Badge;
    readonly Settings = Settings;
    readonly Mail = Mail;
    readonly Upload = Upload;
    readonly GitBranch = GitBranch;



    // Metrics
    userActivityMetrics: UserActivityMetrics | null = null;

    // Loading states
    isLoading = true;
    isRefreshing = false;

    constructor(
        private adminAnalyticsService: AdminAnalyticsService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Load metrics initially
        this.loadMetrics();

        // Start auto-refresh timer (30 seconds)
        this.adminAnalyticsService.startAutoRefresh();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Load dashboard metrics
     */
    private loadMetrics(): void {
        this.isLoading = true;

        this.adminAnalyticsService.getUserActivityMetrics()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (metrics) => {
                    this.userActivityMetrics = metrics;
                    this.isLoading = false;
                    this.isRefreshing = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Error loading dashboard metrics:', error);
                    this.isLoading = false;
                    this.isRefreshing = false;
                    this.cdr.markForCheck();
                }
            });
    }

    /**
     * Manually refresh metrics
     */
    onRefresh(): void {
        this.isRefreshing = true;
        this.adminAnalyticsService.refresh();
        this.cdr.markForCheck();
    }


}

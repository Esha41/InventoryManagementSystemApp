import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, LayoutDashboard, Users, RefreshCw, Badge, Settings, Mail, Upload, GitBranch, Construction } from 'lucide-angular';
import { AdminAnalyticsService, UserActivityMetrics } from '@services/admin-analytics.service';
import { MaintenanceService } from '@services/maintenance.service';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { UserActivityCardComponent } from './components/kpi-cards/user-activity-card/user-activity-card.component';
import { AdminDelegationsComponent } from './admin-delegations/admin-delegations.component';

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
    readonly Construction = Construction;

    // Maintenance mode
    maintenanceEnabled = false;
    maintenanceLoading = false;
    maintenanceToggling = false;

    // Metrics
    userActivityMetrics: UserActivityMetrics | null = null;

    // Loading states
    isLoading = true;
    isRefreshing = false;

    constructor(
        private adminAnalyticsService: AdminAnalyticsService,
        private maintenanceService: MaintenanceService,
        private toastService: ToastService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Start auto-refresh timer BEFORE subscribing to ensure it's active
        this.adminAnalyticsService.startAutoRefresh();

        // Load maintenance status
        this.maintenanceLoading = true;
        this.maintenanceService.getStatus()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (status) => {
                    this.maintenanceEnabled = status.isEnabled;
                    this.maintenanceLoading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.maintenanceLoading = false;
                    this.cdr.markForCheck();
                }
            });

        // Subscribe to the observable stream - this will automatically update on refresh
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

    onMaintenanceToggle(): void {
        if (this.maintenanceToggling) return;
        this.maintenanceToggling = true;
        const valueToSet = this.maintenanceEnabled; // ngModel already updated
        this.maintenanceService.setEnabled(valueToSet)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (success) => {
                    this.maintenanceToggling = false;
                    if (success) {
                        this.maintenanceEnabled = valueToSet;
                        const msg = this.translate.instant(valueToSet ? 'adminDashboard.maintenanceEnabled' : 'adminDashboard.maintenanceDisabled');
                        this.toastService.success(msg);
                    } else {
                        this.maintenanceEnabled = !valueToSet; // Revert on failure
                        this.toastService.error(this.translate.instant('adminDashboard.maintenanceToggleError'));
                    }
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.maintenanceToggling = false;
                    this.maintenanceEnabled = !valueToSet; // Revert on error
                    this.toastService.error(this.translate.instant('adminDashboard.maintenanceToggleError'));
                    this.cdr.markForCheck();
                }
            });
    }

    ngOnDestroy(): void {
        this.adminAnalyticsService.stopAutoRefresh();
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Manually refresh metrics
     */
    onRefresh(): void {
        this.isRefreshing = true;
        this.cdr.markForCheck(); // Update UI immediately to show loading state
        this.adminAnalyticsService.refresh();
        // The subscription will automatically pick up the new data via refresh$ subject
    }


}

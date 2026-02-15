import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Megaphone, X } from 'lucide-angular';
import { filter, takeUntil } from 'rxjs';
import { Subject } from 'rxjs';
import { AnnouncementService } from '@services/announcement.service';
import { ToastService } from '@services/toast.service';
import { ErrorHandlingService } from '@services/error-handling.service';
import { ActiveAnnouncement } from '@models/announcement.model';

@Component({
    selector: 'app-announcement-banner',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    templateUrl: './announcement-banner.component.html',
    styleUrls: ['./announcement-banner.component.css']
})
export class AnnouncementBannerComponent implements OnInit, OnDestroy {
    private readonly announcementService = inject(AnnouncementService);
    private readonly toastService = inject(ToastService);
    private readonly errorService = inject(ErrorHandlingService);
    private readonly router = inject(Router);
    private readonly destroy$ = new Subject<void>();
    private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    Megaphone = Megaphone;
    X = X;
    announcements = signal<ActiveAnnouncement[]>([]);
    loading = signal(false);

    ngOnInit(): void {
        this.loadActiveAnnouncements();

        // Refresh when create/update/delete emits
        this.announcementService.refreshActiveAnnouncements$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                if (!this.loading()) {
                    this.loadActiveAnnouncements();
                }
            });

        // Retry when empty on navigation (e.g. auth timing on first load)
        this.router.events.pipe(
            filter((e): e is NavigationEnd => e instanceof NavigationEnd),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            if (this.announcements().length === 0 && !this.loading()) {
                this.loadActiveAnnouncements();
            }
        });
    }

    ngOnDestroy(): void {
        if (this.retryTimeoutId != null) {
            clearTimeout(this.retryTimeoutId);
            this.retryTimeoutId = null;
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadActiveAnnouncements(): void {
        this.loading.set(true);
        this.announcementService.getActive().subscribe({
            next: (response) => {
                // Handle both camelCase (data) and PascalCase (Data) from backend
                const data = response?.data ?? (response as any)?.Data ?? [];
                this.announcements.set(Array.isArray(data) ? data : []);
                this.loading.set(false);
            },
            error: (error) => {
                console.error('Failed to load announcements:', error);
                this.announcements.set([]);
                this.loading.set(false);
                // Retry once after delay - fixes auth timing (user just logged in, token not yet processed)
                if (error?.status === 401) {
                    this.retryTimeoutId = setTimeout(() => {
                        this.retryTimeoutId = null;
                        if (this.announcements().length === 0) {
                            this.loadActiveAnnouncements();
                        }
                    }, 2000);
                }
            }
        });
    }

    dismiss(announcement: ActiveAnnouncement): void {
        this.announcementService.dismiss(announcement.id).subscribe({
            next: () => {
                this.announcements.update(list =>
                    list.filter(a => a.id !== announcement.id)
                );
            },
            error: (error) => {
                const message = this.errorService.resolveHttpErrorMessage(error);
                this.toastService.error(message);
            }
        });
    }

    getBannerClass(priority: number | string | undefined | null): string {
        // API returns enum as string (e.g. "Normal", "Urgent") via JsonStringEnumConverter
        const p = this.normalizePriority(priority);
        switch (p) {
            case 1: return 'banner-normal';
            case 2: return 'banner-urgent';
            case 3: return 'banner-very-urgent';
            case 4: return 'banner-critical';
            default: return 'banner-default';
        }
    }

    private normalizePriority(priority: number | string | undefined | null): number {
        if (priority === null || priority === undefined) return 0;
        if (typeof priority === 'number') return priority;
        const s = String(priority).toLowerCase();
        if (s === 'normal' || s === '1') return 1;
        if (s === 'urgent' || s === '2') return 2;
        if (s === 'veryurgent' || s === 'very urgent' || s === '3') return 3;
        if (s === 'critical' || s === '4') return 4;
        const n = parseInt(String(priority), 10);
        return isNaN(n) ? 0 : n;
    }
}

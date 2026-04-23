import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Megaphone, X } from 'lucide-angular';
import { filter, takeUntil } from 'rxjs';
import { Subject } from 'rxjs';
import { AnnouncementService } from '@admin/services/announcement.service';
import { ActiveAnnouncement, AnnouncementDeliveryType } from '@models/announcement.model';

@Component({
    selector: 'app-announcement-banner',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    templateUrl: './announcement-banner.component.html',
    styleUrls: ['./announcement-banner.component.css']
})
export class AnnouncementBannerComponent implements OnInit, OnDestroy {
    private readonly announcementService = inject(AnnouncementService);
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
                const data: ActiveAnnouncement[] = response?.data ?? (response as any)?.Data ?? [];
                const all = Array.isArray(data) ? data : [];

                const bannerAnnouncements = all.filter(a => {
                    const dt = this.normalizeDeliveryType(a.deliveryType);
                    return (dt & AnnouncementDeliveryType.Banner) !== 0;
                });
                this.announcements.set(bannerAnnouncements);

                this.loading.set(false);
            },
            error: (error) => {
                console.error('Failed to load announcements:', error);
                this.announcements.set([]);
                this.loading.set(false);
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

    private normalizeDeliveryType(dt: number | string | undefined | null): number {
        if (dt === null || dt === undefined) return AnnouncementDeliveryType.Banner;
        if (typeof dt === 'number') return dt;
        const s = String(dt).toLowerCase();
        if (s === 'banner' || s === '1') return AnnouncementDeliveryType.Banner;
        if (s === 'notification' || s === '2') return AnnouncementDeliveryType.Notification;
        if (s === 'both' || s === '3') return AnnouncementDeliveryType.Both;
        const n = parseInt(String(dt), 10);
        return isNaN(n) ? AnnouncementDeliveryType.Banner : n;
    }

    dismiss(announcement: ActiveAnnouncement): void {
        this.announcementService.dismiss(announcement.id).subscribe({
            next: () => {
                this.announcements.update(list =>
                    list.filter(a => a.id !== announcement.id)
                );
            },
            error: (error) => {
                console.error('Failed to dismiss announcement:', error);
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

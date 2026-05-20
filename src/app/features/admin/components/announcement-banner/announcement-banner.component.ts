import {
    Component,
    OnInit,
    OnDestroy,
    signal,
    computed,
    inject,
    HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Megaphone, X, ChevronLeft, ChevronRight } from 'lucide-angular';
import { filter, takeUntil, interval, Subscription } from 'rxjs';
import { Subject } from 'rxjs';
import { AnnouncementService } from '@admin/services/announcement.service';
import { TranslationService } from '@services/translation.service';
import { ActiveAnnouncement, AnnouncementDeliveryType } from '@models/announcement.model';

const AUTO_ROTATE_MS = 9000;

@Component({
    selector: 'app-announcement-banner',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    templateUrl: './announcement-banner.component.html',
    styleUrls: ['./announcement-banner.component.css'],
})
export class AnnouncementBannerComponent implements OnInit, OnDestroy {
    private readonly announcementService = inject(AnnouncementService);
    private readonly router = inject(Router);
    private readonly translationService = inject(TranslationService);
    private readonly destroy$ = new Subject<void>();

    readonly Megaphone = Megaphone;
    readonly X = X;
    readonly ChevronLeft = ChevronLeft;
    readonly ChevronRight = ChevronRight;

    announcements = signal<ActiveAnnouncement[]>([]);
    currentIndex = signal(0);
    loading = signal(false);
    paused = signal(false);
    prefersReducedMotion = signal(false);

    currentAnnouncement = computed(() => {
        const list = this.announcements();
        if (!list.length) {
            return null;
        }
        const idx = Math.min(this.currentIndex(), list.length - 1);
        return list[idx] ?? null;
    });

    hasMultiple = computed(() => this.announcements().length > 1);
    slideCount = computed(() => this.announcements().length);

    private rotationSub?: Subscription;
    private reducedMotionQuery?: MediaQueryList;
    private reducedMotionListener?: (e: MediaQueryListEvent) => void;

    ngOnInit(): void {
        this.setupReducedMotionPreference();
        this.loadActiveAnnouncements();

        this.announcementService.refreshActiveAnnouncements$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                if (!this.loading()) {
                    this.loadActiveAnnouncements();
                }
            });

        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntil(this.destroy$)
            )
            .subscribe(() => {
                if (this.announcements().length === 0 && !this.loading()) {
                    this.loadActiveAnnouncements();
                }
            });
    }

    ngOnDestroy(): void {
        this.stopRotation();
        if (this.reducedMotionQuery && this.reducedMotionListener) {
            this.reducedMotionQuery.removeEventListener('change', this.reducedMotionListener);
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    get isRTL(): boolean {
        return this.translationService.isRTL();
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
        if (!this.hasMultiple() || !this.currentAnnouncement()) {
            return;
        }
        const target = event.target as HTMLElement | null;
        if (!target?.closest?.('[data-announcement-broadcast]')) {
            return;
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.isRTL ? this.next() : this.prev();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.isRTL ? this.prev() : this.next();
        }
    }

    loadActiveAnnouncements(): void {
        this.loading.set(true);
        this.announcementService.getActive().subscribe({
            next: response => {
                const data: ActiveAnnouncement[] = response?.data ?? (response as any)?.Data ?? [];
                const all = Array.isArray(data) ? data : [];

                const bannerAnnouncements = all.filter(a => {
                    const dt = this.normalizeDeliveryType(a.deliveryType);
                    return (dt & AnnouncementDeliveryType.Banner) !== 0;
                });
                this.announcements.set(bannerAnnouncements);
                this.clampCurrentIndex();
                this.loading.set(false);
                this.syncRotation();
            },
            error: error => {
                console.error('Failed to load announcements:', error);
                this.announcements.set([]);
                this.currentIndex.set(0);
                this.loading.set(false);
                this.stopRotation();
            },
        });
    }

    onPause(): void {
        this.paused.set(true);
        this.stopRotation();
    }

    onResume(): void {
        this.paused.set(false);
        this.syncRotation();
    }

    onBarFocusOut(event: FocusEvent): void {
        const bar = event.currentTarget as HTMLElement;
        const related = event.relatedTarget as Node | null;
        if (related && bar.contains(related)) {
            return;
        }
        this.onResume();
    }

    prev(): void {
        const len = this.announcements().length;
        if (len <= 1) {
            return;
        }
        this.currentIndex.update(i => (i - 1 + len) % len);
    }

    next(): void {
        const len = this.announcements().length;
        if (len <= 1) {
            return;
        }
        this.currentIndex.update(i => (i + 1) % len);
    }

    goTo(index: number): void {
        const len = this.announcements().length;
        if (index < 0 || index >= len) {
            return;
        }
        this.currentIndex.set(index);
    }

    dismiss(announcement: ActiveAnnouncement): void {
        this.announcementService.dismiss(announcement.id).subscribe({
            next: () => {
                this.announcements.update(list => list.filter(a => a.id !== announcement.id));
                this.clampCurrentIndex();
                this.syncRotation();
            },
            error: error => {
                console.error('Failed to dismiss announcement:', error);
            },
        });
    }

    getBannerClass(priority: number | undefined | null): string {
        const p = this.normalizePriority(priority);
        switch (p) {
            case 1:
                return 'banner-normal';
            case 2:
                return 'banner-urgent';
            case 3:
                return 'banner-very-urgent';
            case 4:
                return 'banner-critical';
            default:
                return 'banner-default';
        }
    }

    private setupReducedMotionPreference(): void {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return;
        }
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.prefersReducedMotion.set(this.reducedMotionQuery.matches);
        this.reducedMotionListener = (e: MediaQueryListEvent) => {
            this.prefersReducedMotion.set(e.matches);
            this.syncRotation();
        };
        this.reducedMotionQuery.addEventListener('change', this.reducedMotionListener);
    }

    private clampCurrentIndex(): void {
        const len = this.announcements().length;
        if (len === 0) {
            this.currentIndex.set(0);
            return;
        }
        if (this.currentIndex() >= len) {
            this.currentIndex.set(len - 1);
        }
    }

    private syncRotation(): void {
        this.stopRotation();
        if (
            this.announcements().length <= 1 ||
            this.prefersReducedMotion() ||
            this.paused()
        ) {
            return;
        }
        this.rotationSub = interval(AUTO_ROTATE_MS).subscribe(() => {
            if (!this.paused() && this.announcements().length > 1) {
                this.next();
            }
        });
    }

    private stopRotation(): void {
        this.rotationSub?.unsubscribe();
        this.rotationSub = undefined;
    }

    private normalizeDeliveryType(dt: number | undefined | null): number {
        if (dt == null) return AnnouncementDeliveryType.Banner;
        return dt;
    }

    private normalizePriority(priority: number | undefined | null): number {
        return priority ?? 0;
    }
}

import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Pencil, Trash2, Megaphone, Calendar, AlertCircle } from 'lucide-angular';
import { AnnouncementService } from '@admin/services/announcement.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { Subject, takeUntil } from 'rxjs';
import { ErrorHandler } from '@utils/error-handler.utils';
import { Announcement, AnnouncementDeliveryType } from '@models/announcement.model';
import { RoleDto } from '@models/backend-user.model';
import { getPriorityText, getPriorityClass, getPriorityKey } from '@utils/priority.utils';
import { getLocalizedName } from '@utils/localization.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-announcements',
    standalone: true,
    imports: [CommonModule, TranslatePipe, LucideAngularModule, ConfirmDialogComponent],
    templateUrl: './announcements.component.html',
    styleUrls: ['./announcements.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementsComponent implements OnInit, OnDestroy {
    private readonly announcementService = inject(AnnouncementService);
    private readonly userService = inject(BackendUserService);
    private readonly toastService = inject(ToastService);
    private readonly translationService = inject(TranslationService);
    private readonly router = inject(Router);
    private readonly cdr = inject(ChangeDetectorRef);

    private readonly destroy$ = new Subject<void>();

    readonly Plus = Plus;
    readonly Pencil = Pencil;
    readonly Trash2 = Trash2;
    readonly Megaphone = Megaphone;
    readonly Calendar = Calendar;
    readonly AlertCircle = AlertCircle;

    announcements = signal<Announcement[]>([]);
    roles = signal<RoleDto[]>([]);
    loading = signal(false);
    filter = signal<'all' | 'active' | 'inactive'>('all');

    showDeleteDialog = false;
    announcementToDelete: Announcement | null = null;

    ngOnInit(): void {
        this.loadAnnouncements();
        this.loadRoles();
    }

    loadRoles(): void {
        this.userService.getRoles().pipe(takeUntil(this.destroy$)).subscribe({
            next: (roles) => {
                this.roles.set(roles);
                this.cdr.markForCheck();
            },
            error: () => this.cdr.markForCheck()
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadAnnouncements(): void {
        this.loading.set(true);
        this.cdr.markForCheck();
        this.announcementService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
            next: (response) => {
                this.announcements.set(response.data);
                this.loading.set(false);
                this.cdr.markForCheck();
            },
            error: (error) => {
                const message = ErrorHandler.extractErrorMessage(error, 'Failed to load announcements');
                this.toastService.error(message);
                this.loading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    filteredAnnouncements(): Announcement[] {
        const all = this.announcements();
        const filterValue = this.filter();
        const now = new Date();

        if (filterValue === 'all') {
            return all;
        }

        return all.filter(a => {
            const startDate = new Date(a.startDate);
            const endDate = a.endDate ? new Date(a.endDate) : null;
            const isActive = a.isActive && startDate <= now && (!endDate || endDate >= now);

            return filterValue === 'active' ? isActive : !isActive;
        });
    }

    setFilter(filter: 'all' | 'active' | 'inactive'): void {
        this.filter.set(filter);
    }

    getPriorityText(priority: number): string {
        return getPriorityText(priority);
    }

    /** For `announcements.priorityLevels.*` keys (VeryUrgent, not "Very Urgent"). */
    getPriorityI18nKey(priority: number): string {
        return getPriorityKey(priority);
    }

    getPriorityClass(priority: number): string {
        return getPriorityClass(priority);
    }

    getStatusText(announcement: Announcement): string {
        const now = new Date();
        const startDate = new Date(announcement.startDate);
        const endDate = announcement.endDate ? new Date(announcement.endDate) : null;
        const isActive = announcement.isActive && startDate <= now && (!endDate || endDate >= now);

        return isActive ?
            this.translationService.getTranslation('announcements.active') :
            this.translationService.getTranslation('announcements.inactive');
    }

    getStatusClass(announcement: Announcement): string {
        const now = new Date();
        const startDate = new Date(announcement.startDate);
        const endDate = announcement.endDate ? new Date(announcement.endDate) : null;
        const isActive = announcement.isActive && startDate <= now && (!endDate || endDate >= now);

        return isActive ? 'badge-success' : 'badge-muted';
    }

    getPriorityBadgeClass(priority: number): string {
        const cls = getPriorityClass(priority);
        if (cls.includes('green')) return 'badge-priority-normal';
        if (cls.includes('orange')) return 'badge-priority-urgent';
        if (cls.includes('red')) return 'badge-priority-very-urgent';
        return 'badge-priority-default';
    }

    createAnnouncement(): void {
        this.router.navigate(['/settings/announcements/create']);
    }

    editAnnouncement(id: number): void {
        this.router.navigate(['/settings/announcements/edit', id]);
    }

    deleteAnnouncement(announcement: Announcement): void {
        this.announcementToDelete = announcement;
        this.showDeleteDialog = true;
    }

    onDeleteConfirm(): void {
        if (!this.announcementToDelete) return;

        const announcement = this.announcementToDelete;
        this.showDeleteDialog = false;
        this.announcementToDelete = null;

        this.announcementService.delete(announcement.id).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
                this.announcementService.notifyActiveAnnouncementsChanged();
                this.toastService.success(
                    this.translationService.getTranslation('announcements.deleteSuccess')
                );
                this.loadAnnouncements();
                this.cdr.markForCheck();
            },
            error: (error) => {
                const message = ErrorHandler.extractErrorMessage(error, 'Failed to load announcements');
                this.toastService.error(message);
                this.cdr.markForCheck();
            }
        });
    }

    onDeleteCancel(): void {
        this.showDeleteDialog = false;
        this.announcementToDelete = null;
    }

    formatDate(date: Date | string): string {
        return new Date(date).toLocaleDateString();
    }

    getDeliveryTypeText(deliveryType: AnnouncementDeliveryType | number | undefined | null): string {
        const dt =
            deliveryType == null ? AnnouncementDeliveryType.Banner : Number(deliveryType);

        switch (dt) {
            case AnnouncementDeliveryType.Banner:
                return this.translationService.getTranslation('announcements.deliveryTypes.banner');
            case AnnouncementDeliveryType.Notification:
                return this.translationService.getTranslation('announcements.deliveryTypes.notification');
            case AnnouncementDeliveryType.Both:
                return this.translationService.getTranslation('announcements.deliveryTypes.both');
            default:
                return this.translationService.getTranslation('announcements.deliveryTypes.banner');
        }
    }

    getDeliveryTypeBadgeClass(deliveryType: AnnouncementDeliveryType | number | undefined | null): string {
        const dt = deliveryType ?? AnnouncementDeliveryType.Banner;
        switch (dt) {
            case AnnouncementDeliveryType.Banner:
                return 'badge-delivery-banner';
            case AnnouncementDeliveryType.Notification:
                return 'badge-delivery-notification';
            case AnnouncementDeliveryType.Both:
                return 'badge-delivery-both';
            default:
                return 'badge-delivery-banner';
        }
    }

    getRolesText(targetRoles: string[] | null | undefined): string {
        if (!targetRoles || targetRoles.length === 0) {
            return this.translationService.getTranslation('announcements.allRoles');
        }
        const roleList = this.roles();
        const lang = this.translationService.getCurrentLanguage();
        const names = targetRoles.map(id => {
            const role = roleList.find(r => String(r.id) === String(id));
            return role ? (getLocalizedName(role, lang) || role.name || id) : id;
        });
        return names.join(', ');
    }
}

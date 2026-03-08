import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Pencil, Trash2, Megaphone, Calendar, AlertCircle } from 'lucide-angular';
import { AnnouncementService } from '@services/announcement.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { Subject, takeUntil } from 'rxjs';
import { ErrorHandler } from '@utils/error-handler.utils';
import { Announcement } from '@models/announcement.model';
import { getPriorityText, getPriorityClass } from '@utils/priority.utils';
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
    loading = signal(false);
    filter = signal<'all' | 'active' | 'inactive'>('all');

    showDeleteDialog = false;
    announcementToDelete: Announcement | null = null;

    ngOnInit(): void {
        this.loadAnnouncements();
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
        this.router.navigate(['/admin/announcements/create']);
    }

    editAnnouncement(id: number): void {
        this.router.navigate(['/admin/announcements/edit', id]);
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

    getRolesText(targetRoles: string[] | null | undefined): string {
        if (!targetRoles || targetRoles.length === 0) {
            return this.translationService.getTranslation('announcements.allRoles');
        }
        return targetRoles.join(', ');
    }
}

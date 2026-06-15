import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AnnouncementService } from '@admin/services/announcement.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { Subject, takeUntil } from 'rxjs';
import { ErrorHandler } from '@utils/error-handler.utils';
import { formatDateForInput } from '@utils/format.utils';
import { Priority } from '@utils/priority.utils';
import { AnnouncementDeliveryType } from '@models/announcement.model';
import { RoleDto } from '@models/backend-user.model';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

@Component({
    selector: 'app-announcement-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslatePipe, DropdownComponent],
    templateUrl: './announcement-form.component.html',
    styleUrls: ['./announcement-form.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnouncementFormComponent implements OnInit, OnDestroy {
    private readonly fb = inject(FormBuilder);
    private readonly announcementService = inject(AnnouncementService);
    private readonly userService = inject(BackendUserService);
    private readonly toastService = inject(ToastService);
    private readonly translationService = inject(TranslationService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);

    private readonly destroy$ = new Subject<void>();

    form!: FormGroup;
    loading = signal(false);
    submitting = signal(false);
    isEditMode = signal(false);
    announcementId: number | null = null;
    roles = signal<RoleDto[]>([]);

    priorities = [
        { value: Priority.Normal, label: 'Normal', colorClass: 'text-green-600' },
        { value: Priority.Urgent, label: 'Urgent', colorClass: 'text-orange-600' },
        { value: Priority.VeryUrgent, label: 'VeryUrgent', colorClass: 'text-red-600' }
    ];

    deliveryTypes = [
        { value: AnnouncementDeliveryType.Banner, label: 'Banner', labelKey: 'announcements.deliveryTypes.banner' },
        { value: AnnouncementDeliveryType.Notification, label: 'Notification', labelKey: 'announcements.deliveryTypes.notification' },
        { value: AnnouncementDeliveryType.Both, label: 'Both', labelKey: 'announcements.deliveryTypes.both' }
    ];

    ngOnInit(): void {
        this.initForm();
        this.loadRoles();

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode.set(true);
            this.announcementId = +id;
            this.loadAnnouncement(+id);
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    initForm(): void {
        this.form = this.fb.group({
            message: ['', [Validators.required, Validators.maxLength(500)]],
            priority: [Priority.Normal, Validators.required],
            deliveryType: [AnnouncementDeliveryType.Banner, Validators.required],
            isDismissable: [true],
            startDate: [formatDateForInput(new Date()), Validators.required],
            endDate: [''],
            targetRoles: [ [] ],
            isActive: [true]
        });
    }

    loadRoles(): void {
        this.userService.getRoles().pipe(takeUntil(this.destroy$)).subscribe({
            next: (roles) => {
                this.roles.set(roles);
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('Failed to load roles:', error);
                this.cdr.markForCheck();
            }
        });
    }

    loadAnnouncement(id: number): void {
        this.loading.set(true);
        this.cdr.markForCheck();
        this.announcementService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
            next: (announcement) => {
                this.form.patchValue({
                    message: announcement.message,
                    priority: announcement.priority,
                    deliveryType: announcement.deliveryType ?? AnnouncementDeliveryType.Banner,
                    isDismissable: announcement.isDismissable,
                    startDate: formatDateForInput(announcement.startDate),
                    endDate: announcement.endDate ? formatDateForInput(announcement.endDate) : '',
                    targetRoles: announcement.targetRoles ?? [],
                    isActive: announcement.isActive
                });
                this.loading.set(false);
                this.cdr.markForCheck();
            },
            error: (error) => {
                const message = ErrorHandler.extractErrorMessage(error, 'Failed to load announcement');
                this.toastService.error(message);
                this.loading.set(false);
                this.cdr.markForCheck();
                this.router.navigate(['/settings/announcements']);
            }
        });
    }

    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.submitting.set(true);
        this.cdr.markForCheck();
        const formValue = this.form.value;

        const rawRoles = Array.isArray(formValue.targetRoles) ? formValue.targetRoles : [];
        const targetRoles = rawRoles
            .filter((id: unknown): id is string => id != null && String(id).trim() !== '')
            .map((id: unknown) => String(id));
        const dto = {
            message: formValue.message,
            priority: formValue.priority,
            deliveryType: formValue.deliveryType,
            isDismissable: formValue.isDismissable,
            startDate: formValue.startDate,
            endDate: formValue.endDate || null,
            targetRoles: targetRoles.length > 0 ? targetRoles : null,
            isActive: formValue.isActive
        };

        const request$ = this.isEditMode() && this.announcementId
            ? this.announcementService.update(this.announcementId, dto)
            : this.announcementService.create(dto);

        request$.pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
                this.announcementService.notifyActiveAnnouncementsChanged();
                const message = this.isEditMode()
                    ? this.translationService.getTranslation('announcements.updateSuccess')
                    : this.translationService.getTranslation('announcements.createSuccess');
                this.toastService.success(message);
                this.cdr.markForCheck();
                this.router.navigate(['/settings/announcements']);
            },
            error: (error) => {
                const message = ErrorHandler.extractErrorMessage(error, 'Failed to save announcement');
                this.toastService.error(message);
                this.submitting.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    cancel(): void {
        this.router.navigate(['/settings/announcements']);
    }

    getPriorityColorClass(priority: Priority): string {
        switch (priority) {
            case Priority.Normal:
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case Priority.Urgent:
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
            case Priority.VeryUrgent:
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    }

    getPriorityLabel(priority: Priority): string {
        const p = this.priorities.find(p => p.value === priority);
        return p?.label || 'Normal';
    }

    getPriorityOptionLabel(option: { value?: number; label?: string } | number): string {
        const opt = option as { value?: number; label?: string };
        const label = opt?.label ?? 'Normal';
        return this.translationService.getTranslation('announcements.priorityLevels.' + label);
    }

    getDeliveryTypeOptionLabel = (option: { value?: number; label?: string; labelKey?: string } | number): string => {
        const opt = option as { value?: number; label?: string; labelKey?: string };
        const key = opt?.labelKey ?? 'announcements.deliveryTypes.banner';
        return this.translationService.getTranslation(key);
    }

    private readonly appDatePipe = new AppDatePipe();

    openDatePicker(input: HTMLInputElement | null): void {
        if (!input) return;
        if (input.showPicker) {
            input.showPicker();
            return;
        }
        input.focus();
    }

    getDateDisplay(value?: Date | string | null): string {
        const formatted = this.appDatePipe.transform(value);
        return formatted === 'N/A' ? '' : formatted;
    }
}

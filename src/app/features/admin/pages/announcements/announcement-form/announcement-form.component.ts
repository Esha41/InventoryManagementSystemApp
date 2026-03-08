import { Component, OnInit, OnDestroy, signal, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AnnouncementService } from '@services/announcement.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { Subject, takeUntil } from 'rxjs';
import { ErrorHandler } from '@utils/error-handler.utils';
import { Priority } from '@utils/priority.utils';
import { RoleDto } from '@models/backend-user.model';
import { DropdownComponent } from '@components/dropdown/dropdown.component';

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

    // Priority options
    priorities = [
        { value: Priority.Normal, label: 'Normal', colorClass: 'text-green-600' },
        { value: Priority.Urgent, label: 'Urgent', colorClass: 'text-orange-600' },
        { value: Priority.VeryUrgent, label: 'VeryUrgent', colorClass: 'text-red-600' }
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
            isDismissable: [true],
            startDate: [new Date().toISOString().split('T')[0], Validators.required],
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
            next: (response) => {
                const announcement = response.data;
                this.form.patchValue({
                    message: announcement.message,
                    priority: announcement.priority,
                    isDismissable: announcement.isDismissable,
                    startDate: new Date(announcement.startDate).toISOString().split('T')[0],
                    endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().split('T')[0] : '',
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
                this.router.navigate(['/admin/announcements']);
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

        const targetRoles = Array.isArray(formValue.targetRoles) ? formValue.targetRoles : [];
        const dto = {
            message: formValue.message,
            priority: formValue.priority,
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
                this.router.navigate(['/admin/announcements']);
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
        this.router.navigate(['/admin/announcements']);
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
        return this.translationService.getTranslation('common.priorityLevels.' + label);
    }
}

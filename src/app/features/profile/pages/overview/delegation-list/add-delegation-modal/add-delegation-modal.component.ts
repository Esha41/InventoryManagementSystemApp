import { Component, OnInit, Output, EventEmitter, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { UserDelegationService } from '@admin/services/user-delegation.service';
import { BackendUserDto } from '@models/backend-user.model';
import { CreateUserDelegation } from '@models/user-delegation';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LucideAngularModule, X } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';

@Component({
    selector: 'app-add-delegation-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule,
        DropdownComponent,
        LucideAngularModule
    ],
    templateUrl: './add-delegation-modal.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddDelegationModalComponent implements OnInit {
    @Input() isOpen = false;
    @Output() closeModal = new EventEmitter<boolean>();

    readonly X = X;
    form: FormGroup;
    users: BackendUserDto[] = [];
    userOptions: DropdownOption<string>[] = [];
    loading = false;
    minDate = new Date().toISOString().split('T')[0]; // Current date as string YYYY-MM-DD

    constructor(
        private fb: FormBuilder,
        private delegationService: UserDelegationService,
        private translationService: TranslationService,
        private cdr: ChangeDetectorRef
    ) {
        this.form = this.fb.group({
            delegateeUserId: ['', Validators.required],
            startDate: [this.minDate, Validators.required],
            endDate: ['', Validators.required],
            reason: ['', Validators.required]
        });
    }

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(): void {
        this.delegationService.getAvailableUsers().subscribe({
            next: (users) => {
                if (users && users.length > 0) {
                    this.users = users;
                    this.userOptions = users.map(user => ({
                        label: this.getUserDisplayLabel(user),
                        value: user.id
                    }));
                    this.cdr.markForCheck();
                }
            }
        });
    }

    private getUserDisplayLabel(user: BackendUserDto): string {
        const isArabic = this.translationService.getCurrentLanguage() === 'ar';
        const name = isArabic
            ? (user.nameAr || user.fullNameAR || user.nameEn || user.fullNameEN || user.userName)
            : (user.nameEn || user.fullNameEN || user.nameAr || user.fullNameAR || user.userName);

        const militaryId = user.militaryId || user.militoryId;
        return militaryId ? `${name} (${militaryId})` : (name || 'Unknown User');
    }

    submit(): void {
        if (this.form.valid) {
            this.loading = true;
            this.cdr.markForCheck();
            const dto: CreateUserDelegation = {
                delegateeUserId: this.form.value.delegateeUserId,
                startDate: new Date(this.form.value.startDate).toISOString(),
                endDate: new Date(this.form.value.endDate).toISOString(),
                reason: this.form.value.reason
            };

            this.delegationService.create(dto).subscribe({
                next: (success) => {
                    this.loading = false;
                    this.cdr.markForCheck();
                    if (success) {
                        this.closeModal.emit(true);
                        this.form.reset({
                            startDate: this.minDate
                        });
                    }
                },
                error: () => {
                    this.loading = false;
                    this.cdr.markForCheck();
                }
            });
        }
    }

    cancel(): void {
        this.closeModal.emit(false);
    }
}

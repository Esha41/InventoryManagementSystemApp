import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { UserDelegationService } from '../../../../core/services/user-delegation.service';
import { BackendUserDto } from '../../../../core/models/backend-user.model';
import { CreateUserDelegation } from '../../../../core/models/user-delegation';
import { DropdownComponent, DropdownOption } from '../../../../shared/components/dropdown/dropdown.component';
import { LucideAngularModule, X } from 'lucide-angular';

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
    templateUrl: './add-delegation-modal.component.html'
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
        private delegationService: UserDelegationService
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
            next: (response) => {
                if (response && response.succeeded && response.data) {
                    this.users = response.data;
                    this.userOptions = response.data.map(user => ({
                        label: user.nameEn || user.userName || 'Unknown User',
                        value: user.id
                    }));
                }
            }
        });
    }

    submit(): void {
        if (this.form.valid) {
            this.loading = true;
            const dto: CreateUserDelegation = {
                delegateeUserId: this.form.value.delegateeUserId,
                startDate: new Date(this.form.value.startDate).toISOString(),
                endDate: new Date(this.form.value.endDate).toISOString(),
                reason: this.form.value.reason
            };

            this.delegationService.create(dto).subscribe({
                next: (res) => {
                    this.loading = false;
                    if (res && res.succeeded) {
                        this.closeModal.emit(true);
                        this.form.reset({ startDate: this.minDate });
                    }
                },
                error: () => {
                    this.loading = false;
                }
            });
        }
    }

    cancel(): void {
        this.closeModal.emit(false);
    }
}

import { Component, OnInit, Output, EventEmitter, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { UserDelegationService } from '@services/user-delegation.service';
import { BackendUserDto } from '@models/backend-user.model';
import { CreateUserDelegation } from '@models/user-delegation';
import { DelegationScope, getAvailableDelegationScopes } from '@models/delegation-scope.enum';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
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

    // Delegation scopes
    availableScopes: DelegationScope[] = getAvailableDelegationScopes();

    constructor(
        private fb: FormBuilder,
        private delegationService: UserDelegationService,
        private cdr: ChangeDetectorRef
    ) {
        this.form = this.fb.group({
            delegateeUserId: ['', Validators.required],
            startDate: [this.minDate, Validators.required],
            endDate: ['', Validators.required],
            reason: ['', Validators.required],
            delegationScopes: [[], Validators.required]
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
                        label: user.nameEn || user.userName || 'Unknown User',
                        value: user.id
                    }));
                    this.cdr.markForCheck();
                }
            }
        });
    }

    submit(): void {
        if (this.form.valid && this.form.value.delegationScopes?.length > 0) {
            this.loading = true;
            this.cdr.markForCheck();
            const dto: CreateUserDelegation = {
                delegateeUserId: this.form.value.delegateeUserId,
                startDate: new Date(this.form.value.startDate).toISOString(),
                endDate: new Date(this.form.value.endDate).toISOString(),
                reason: this.form.value.reason,
                delegationScopes: this.form.value.delegationScopes
            };

            this.delegationService.create(dto).subscribe({
                next: (success) => {
                    this.loading = false;
                    this.cdr.markForCheck();
                    if (success) {
                        this.closeModal.emit(true);
                        this.form.reset({ 
                            startDate: this.minDate,
                            delegationScopes: []
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

    /**
     * Toggle a scope selection on/off
     */
    toggleScope(scope: DelegationScope, event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        const currentScopes: string[] = this.form.value.delegationScopes || [];
        
        if (checked) {
            this.form.patchValue({
                delegationScopes: [...currentScopes, scope]
            });
        } else {
            this.form.patchValue({
                delegationScopes: currentScopes.filter((s: string) => s !== scope)
            });
        }
    }

    /**
     * Check if a scope is currently selected
     */
    isScopeSelected(scope: DelegationScope): boolean {
        const currentScopes: string[] = this.form.value.delegationScopes || [];
        return currentScopes.includes(scope);
    }

    cancel(): void {
        this.closeModal.emit(false);
    }
}

import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X, Lock, Eye, EyeOff } from 'lucide-angular';
import { ChangePasswordRequest } from '@models/change-password.model';

@Component({
    selector: 'app-change-password-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule,
        LucideAngularModule
    ],
    templateUrl: './change-password-modal.component.html',
    styleUrls: ['./change-password-modal.component.css']
})
export class ChangePasswordModalComponent implements OnInit {
    @Input() isOpen = false;
    @Output() closeModal = new EventEmitter<void>();
    @Output() submitPassword = new EventEmitter<ChangePasswordRequest>();

    // Lucide icons
    readonly X = X;
    readonly Lock = Lock;
    readonly Eye = Eye;
    readonly EyeOff = EyeOff;

    changePasswordForm!: FormGroup;
    showOldPassword = false;
    showNewPassword = false;
    showConfirmPassword = false;

    constructor(private fb: FormBuilder) { }

    ngOnInit(): void {
        this.initializeForm();
    }

    private initializeForm(): void {
        this.changePasswordForm = this.fb.group({
            oldPassword: ['', [Validators.required, Validators.minLength(6)]],
            newPassword: ['', [Validators.required, Validators.minLength(6), this.passwordStrengthValidator]],
            confirmPassword: ['', [Validators.required]]
        }, {
            validators: this.passwordMatchValidator
        });
    }

    private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
        const value = control.value as string | null | undefined;
        if (!value) {
            return null;
        }

        const hasLetter = /[a-zA-Z]/.test(value);
        const hasNumber = /[0-9]/.test(value);
        const hasSymbol = /[!@#$%^&*()_+\-=\\[\]{};':"|,./?]/.test(value);

        const valid = hasLetter && hasNumber && hasSymbol;

        if (!valid) {
            return { passwordStrength: true };
        }

        return null;
    }

    private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
        const newPassword = group.get('newPassword')?.value;
        const confirmPassword = group.get('confirmPassword')?.value;

        if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            return { passwordMismatch: true };
        }
        return null;
    }

    toggleOldPasswordVisibility(): void {
        this.showOldPassword = !this.showOldPassword;
    }

    toggleNewPasswordVisibility(): void {
        this.showNewPassword = !this.showNewPassword;
    }

    toggleConfirmPasswordVisibility(): void {
        this.showConfirmPassword = !this.showConfirmPassword;
    }

    onClose(): void {
        this.changePasswordForm.reset();
        this.showOldPassword = false;
        this.showNewPassword = false;
        this.showConfirmPassword = false;
        this.closeModal.emit();
    }

    onSubmit(): void {
        if (this.changePasswordForm.valid) {
            const formValue = this.changePasswordForm.value;
            const request: ChangePasswordRequest = {
                oldPassword: formValue.oldPassword,
                newPassword: formValue.newPassword,
                confirmPassword: formValue.confirmPassword
            };
            this.submitPassword.emit(request);
        } else {
            // Mark all fields as touched to show validation errors
            Object.keys(this.changePasswordForm.controls).forEach(key => {
                this.changePasswordForm.get(key)?.markAsTouched();
            });
        }
    }

    get oldPassword() {
        return this.changePasswordForm.get('oldPassword');
    }

    get newPassword() {
        return this.changePasswordForm.get('newPassword');
    }

    get confirmPassword() {
        return this.changePasswordForm.get('confirmPassword');
    }

    get passwordMismatch(): boolean {
        return this.changePasswordForm.hasError('passwordMismatch') &&
            this.confirmPassword?.touched || false;
    }
}

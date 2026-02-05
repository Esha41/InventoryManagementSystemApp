import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Lock, Eye, EyeOff, CheckCircle, KeyRound, LogIn, ArrowLeft, AlertCircle, Info } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { ToastService } from '@services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule,
        LucideAngularModule,
        RouterLink
    ],
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
    readonly Lock = Lock;
    readonly Eye = Eye;
    readonly EyeOff = EyeOff;
    readonly CheckCircle = CheckCircle;
    readonly KeyRound = KeyRound;
    readonly LogIn = LogIn;
    readonly ArrowLeft = ArrowLeft;
    readonly AlertCircle = AlertCircle;
    readonly Info = Info;

    resetForm: FormGroup;
    isLoading = false;
    resetSuccess = false;
    showNewPassword = false;
    showConfirmPassword = false;
    isRTL = false;
    email = '';
    token = '';
    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private authService: BackendAuthService,
        private toastService: ToastService,
        private translateService: TranslateService,
        private router: Router,
        private route: ActivatedRoute
    ) {
        this.resetForm = this.fb.group({
            newPassword: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', [Validators.required]]
        }, {
            validators: this.passwordMatchValidator
        });
    }


    ngOnInit(): void {
        // Detect RTL
        this.isRTL = this.translateService.currentLang === 'ar';
        this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(event => {
            this.isRTL = event.lang === 'ar';
        });

        // Get email and token from URL query parameters
        this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
            this.email = params['email'] || '';
            this.token = params['token'] || '';

            if (!this.email || !this.token) {
                this.toastService.error(
                    this.translateService.instant('auth.resetPassword.invalidLink'),
                    this.translateService.instant('common.error')
                );
                this.router.navigate(['/auth/login']);
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
        const newPassword = group.get('newPassword')?.value;
        const confirmPassword = group.get('confirmPassword')?.value;

        if (newPassword && confirmPassword && newPassword !== confirmPassword) {
            return { passwordMismatch: true };
        }
        return null;
    }

    toggleNewPasswordVisibility(): void {
        this.showNewPassword = !this.showNewPassword;
    }

    toggleConfirmPasswordVisibility(): void {
        this.showConfirmPassword = !this.showConfirmPassword;
    }

    getFieldError(fieldName: string): string | null {
        const field = this.resetForm.get(fieldName);
        if (field?.invalid && field?.touched) {
            if (field.errors?.['required']) {
                return this.translateService.instant(`auth.resetPassword.${fieldName}Required`);
            }
            if (field.errors?.['minlength']) {
                return this.translateService.instant('auth.resetPassword.passwordMinLength');
            }
        }
        if (fieldName === 'confirmPassword' && this.passwordMismatch) {
            return this.translateService.instant('auth.resetPassword.passwordMismatch');
        }
        return null;
    }

    onSubmit(): void {
        if (this.resetForm.invalid) {
            Object.keys(this.resetForm.controls).forEach(key => {
                this.resetForm.get(key)?.markAsTouched();
            });
            return;
        }

        this.isLoading = true;
        const newPassword = this.resetForm.value.newPassword;

        this.authService.resetPassword(this.email, this.token, newPassword)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.isLoading = false;
                    this.resetSuccess = true;
                    this.toastService.success(
                        this.translateService.instant('auth.resetPassword.success'),
                        this.translateService.instant('common.success')
                    );
                },
                error: (error) => {
                    this.isLoading = false;
                    const errorMessage = error?.message || this.translateService.instant('auth.resetPassword.error');
                    this.toastService.error(
                        errorMessage,
                        this.translateService.instant('common.error')
                    );
                }
            });
    }

    goToLogin(): void {
        this.router.navigate(['/auth/login']);
    }

    get newPassword() {
        return this.resetForm.get('newPassword');
    }

    get confirmPassword() {
        return this.resetForm.get('confirmPassword');
    }

    get passwordMismatch(): boolean {
        return this.resetForm.hasError('passwordMismatch') &&
            this.confirmPassword?.touched || false;
    }
}

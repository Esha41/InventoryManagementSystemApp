import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Mail, ArrowLeft, Send } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { FormUtils } from '@utils/form-utils';
import { ToastService } from '@services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TranslateModule,
        LucideAngularModule,
        RouterLink
    ],
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
    readonly Mail = Mail;
    readonly ArrowLeft = ArrowLeft;
    readonly Send = Send;

    forgotPasswordForm: FormGroup;
    isSubmitting = false;
    emailSent = false;
    isRTL = false;
    private destroy$ = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        private authService: BackendAuthService,
        private toastService: ToastService,
        private translateService: TranslateService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) {
        this.forgotPasswordForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]]
        });
    }

    ngOnInit(): void {
        // Detect RTL
        this.isRTL = this.translateService.currentLang === 'ar';
        this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(event => {
            this.isRTL = event.lang === 'ar';
            this.cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onSubmit(): void {
        if (this.forgotPasswordForm.invalid) {
            FormUtils.markFormGroupTouched(this.forgotPasswordForm);
            return;
        }

        this.isSubmitting = true;
        this.cdr.markForCheck();
        const email = this.forgotPasswordForm.value.email;

        this.authService.forgotPassword(email)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.isSubmitting = false;
                    this.emailSent = true;
                    this.cdr.markForCheck();
                    this.toastService.success(
                        this.translateService.instant('auth.forgotPassword.emailSent'),
                        this.translateService.instant('common.success')
                    );
                },
                error: (error: unknown) => {
                    this.isSubmitting = false;
                    this.cdr.markForCheck();
                    const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, this.translateService.instant('auth.forgotPassword.error'), this.translateService);
                    this.toastService.error(
                        errorMessage,
                        this.translateService.instant('common.error')
                    );
                }
            });
    }

    get email() {
        return this.forgotPasswordForm.get('email');
    }

    backToLogin(): void {
        this.router.navigate(['/auth/login']);
    }
}

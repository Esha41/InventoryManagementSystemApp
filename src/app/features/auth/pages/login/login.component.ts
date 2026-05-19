import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, EyeOff, Lock, User, AlertCircle, RefreshCw } from 'lucide-angular';

import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';
import { ConfigService } from '@services/config.service';
import { StorageService } from '@services/storage.service';
import { environment } from '@environments/environment';
import { LoginRequest, LoginResponse } from '@models/auth.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getDefaultLandingUrl } from '@utils/default-landing-route.utils';
import { TermsAcceptanceFacade } from '@features/help/facades/terms-acceptance.facade';

import { TakeOverDialogComponent } from '../../components/take-over-dialog/take-over-dialog.component';
import { CaptchaService } from '../../services/captcha.service';
import { analyzeLoginError } from '../../utils/login-error-mapper.util';
import {
  incrementFailedAttempts,
  readFailedAttempts,
  resetFailedAttempts,
  shouldShowCaptcha
} from '../../utils/login-attempts.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    RouterLink,
    TakeOverDialogComponent
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Lock = Lock;
  readonly User = User;
  readonly AlertCircle = AlertCircle;
  readonly RefreshCw = RefreshCw;

  private readonly destroyRef = inject(DestroyRef);

  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;
  loginError = '';
  isLdapMode = false;
  failedLoginAttempts = 0;
  showTakeOverDialog = false;
  takeOverExistingSessionUser = '';
  takeOverRequestingUser = '';
  pendingLoginCredentials: {
    username: string;
    password: string;
    captchaId?: string;
    captchaCode?: string;
  } | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly backendAuth: BackendAuthService,
    private readonly translate: TranslateService,
    public readonly translationService: TranslationService,
    private readonly configService: ConfigService,
    private readonly cdr: ChangeDetectorRef,
    private readonly storageService: StorageService,
    public readonly captchaService: CaptchaService,
    private readonly termsAcceptance: TermsAcceptanceFacade
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      captcha: ['']
    });
  }

  ngOnInit(): void {
    if (!environment.production) {
      this.isLdapMode = false;
    } else {
      this.isLdapMode = true;
    }

    this.applyPasswordValidators();

    if (this.backendAuth.isAuthenticated()) {
      this.navigateAfterSessionRestored();
      return;
    }

    this.backendAuth
      .restoreSessionSilently()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(restored => {
        if (restored) {
          this.navigateAfterSessionRestored();
          return;
        }
        this.initLoginFormState();
        this.cdr.markForCheck();
      });
  }

  private navigateAfterSessionRestored(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    const url =
      returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
        ? returnUrl
        : getDefaultLandingUrl(this.backendAuth);
    void this.router.navigateByUrl(url);
  }

  private initLoginFormState(): void {
    this.captchaService.reset();
    this.captcha?.setValue('');
    this.captcha?.clearValidators();
    this.captcha?.updateValueAndValidity();

    this.failedLoginAttempts = readFailedAttempts(this.storageService);
    if (this.failedLoginAttempts > 0 && shouldShowCaptcha(this.failedLoginAttempts)) {
      this.loadCaptcha();
    }

    const sessionConflict = this.route.snapshot.queryParams['sessionConflict'];
    if (sessionConflict === 'true') {
      this.loginError = this.translate.instant('auth.login.errors.singleSession');
    }
  }

  get username() {
    return this.loginForm.get('username');
  }
  get password() {
    return this.loginForm.get('password');
  }
  get captcha() {
    return this.loginForm.get('captcha');
  }
  get isRTL(): boolean {
    return this.translationService.isRTL();
  }
  get isDevelopment(): boolean {
    return !environment.production;
  }
  get showCaptcha(): boolean {
    return this.captchaService.flowActive;
  }
  get captchaId(): string {
    return this.captchaService.captchaId;
  }

  get isLoginDisabled(): boolean {
    if (this.isLoading) {
      return true;
    }
    if (this.showCaptcha) {
      return !this.loginForm.valid || !this.captcha?.value || this.captcha.invalid;
    }
    return !this.loginForm.valid;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  loadCaptcha(): void {
    this.cdr.markForCheck();
    this.captcha?.setValidators([Validators.required]);
    this.captcha?.updateValueAndValidity();

    this.captchaService
      .loadCaptcha()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
          if (this.loginError && this.loginError.toLowerCase().includes('captcha')) {
            this.loginError = '';
          }
        },
        error: error => {
          this.cdr.markForCheck();
          this.configService.logError('Failed to load captcha', error);
          const errorMessage = ErrorHandler.extractErrorMessage(
            error,
            'Failed to load captcha. Please try again.'
          );
          this.loginError =
            this.translate.instant('auth.login.errors.captchaLoadFailed') || errorMessage;
        }
      });
  }

  refreshCaptcha(): void {
    this.captcha?.setValue('');
    this.captchaService
      .refreshCaptcha()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.cdr.markForCheck(),
        error: error => {
          this.cdr.markForCheck();
          this.configService.logError('Failed to refresh captcha', error);
          const errorMessage = ErrorHandler.extractErrorMessage(
            error,
            'Failed to refresh captcha. Please try again.'
          );
          this.loginError =
            this.translate.instant('auth.login.errors.captchaLoadFailed') || errorMessage;
        }
      });
  }

  onCaptchaImageError(): void {
    this.configService.logError('Captcha image failed to load', { captchaId: this.captchaId });
    this.refreshCaptcha();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      return;
    }
    if (this.showCaptcha && !this.captcha?.value) {
      this.captcha?.markAsTouched();
      return;
    }

    this.isLoading = true;
    this.loginError = '';
    this.cdr.markForCheck();

    const formValue = this.loginForm.value as {
      username: string;
      password: string;
      captcha: string;
    };
    const loginRequest = this.buildLoginRequest(formValue, false);

    this.backendAuth
      .login(loginRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => this.onPrimaryLoginSuccess(response),
        error: error => this.onPrimaryLoginError(error, formValue)
      });
  }

  private buildLoginRequest(
    formValue: { username: string; password: string; captcha: string },
    forceLogin: boolean
  ): LoginRequest {
    return {
      username: formValue.username,
      password: formValue.password,
      isLdap: this.isLdapMode,
      ...(forceLogin && { forceLogin: true }),
      ...(this.showCaptcha && {
        captchaId: this.captchaId,
        captchaCode: formValue.captcha
      })
    };
  }

  private onPrimaryLoginSuccess(response: LoginResponse): void {
    this.isLoading = false;
    this.cdr.markForCheck();
    this.failedLoginAttempts = 0;
    resetFailedAttempts(this.storageService);
    this.captchaService.reset();
    this.loginForm.get('captcha')?.setValue('');

    if (response.requiresRoleSelection) {
      setTimeout(() => void this.router.navigate(['/auth/select-role']), 200);
      return;
    }

    setTimeout(() => {
      void this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth)).then(navigated => {
        if (navigated) {
          this.termsAcceptance.beginPostLoginFlow();
        }
      });
    }, 400);
  }

  private onPrimaryLoginError(
    error: unknown,
    formValue: { username: string; password: string; captcha: string }
  ): void {
    this.isLoading = false;
    this.cdr.markForCheck();

    const analyzed = analyzeLoginError(error, {
      isLdapMode: this.isLdapMode,
      username: formValue.username,
      translate: (key, params) => this.translate.instant(key, params)
    });

    if (analyzed.isAlreadyLoggedIn) {
      this.handleAlreadyLoggedIn(formValue);
      return;
    }

    this.loginError = analyzed.message;
    this.cdr.markForCheck();

    this.failedLoginAttempts = incrementFailedAttempts(this.storageService, this.failedLoginAttempts);

    const shouldForceCaptcha = analyzed.requiresCaptcha || shouldShowCaptcha(this.failedLoginAttempts);
    if (shouldForceCaptcha && !this.showCaptcha) {
      this.loadCaptcha();
    } else if (this.showCaptcha) {
      this.refreshCaptcha();
    }
  }

  private handleAlreadyLoggedIn(formValue: { username: string; password: string; captcha: string }): void {
    const wasSessionExpired = this.storageService.get<boolean>('sessionExpired') === true;
    this.storageService.remove('sessionExpired');

    this.pendingLoginCredentials = {
      username: formValue.username,
      password: formValue.password,
      captchaId: this.showCaptcha ? this.captchaId : undefined,
      captchaCode: this.showCaptcha ? formValue.captcha : undefined
    };

    if (wasSessionExpired) {
      this.loginError = '';
      this.cdr.markForCheck();
      this.takeOverSession();
      return;
    }

    this.takeOverExistingSessionUser = formValue.username;
    this.takeOverRequestingUser = formValue.username;
    this.loginError = '';
    this.showTakeOverDialog = true;
    this.cdr.markForCheck();
  }

  takeOverSession(): void {
    if (!this.pendingLoginCredentials) {
      return;
    }
    this.showTakeOverDialog = false;
    this.isLoading = true;
    this.loginError = '';
    this.cdr.markForCheck();

    const cred = this.pendingLoginCredentials;
    this.pendingLoginCredentials = null;

    const loginRequest: LoginRequest = {
      ...cred,
      isLdap: this.isLdapMode,
      forceLogin: true
    };

    this.backendAuth
      .login(loginRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.onTakeOverSuccess(),
        error: err => this.onTakeOverError(err, loginRequest.username)
      });
  }

  private onTakeOverSuccess(): void {
    this.isLoading = false;
    this.cdr.markForCheck();
    this.failedLoginAttempts = 0;
    resetFailedAttempts(this.storageService);
    this.captchaService.reset();
    this.loginForm.get('captcha')?.setValue('');
    setTimeout(() => {
      void this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth)).then(navigated => {
        if (navigated) {
          this.termsAcceptance.beginPostLoginFlow();
        }
      });
    }, 400);
  }

  private onTakeOverError(error: unknown, username: string): void {
    this.isLoading = false;
    const analyzed = analyzeLoginError(error, {
      isLdapMode: this.isLdapMode,
      username,
      translate: (key, params) => this.translate.instant(key, params)
    });
    this.loginError = analyzed.message;
    this.cdr.markForCheck();
  }

  cancelTakeOver(): void {
    this.showTakeOverDialog = false;
    this.pendingLoginCredentials = null;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);

    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        if (fieldName === 'username') {
          return this.translate.instant('auth.login.errors.usernameRequired');
        }
        if (fieldName === 'password') {
          return this.translate.instant('auth.login.errors.invalidCredentials');
        }
        if (fieldName === 'captcha') {
          return this.translate.instant('auth.login.errors.captchaRequired') || 'Captcha is required';
        }
      }
      if (field.errors['minlength'] && fieldName === 'username') {
        return this.translate.instant('auth.login.errors.usernameMinLength');
      }
    }
    return '';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.loginForm.valid && !this.isLoading) {
      this.onSubmit();
    }
  }

  setLoginMode(mode: 'password' | 'ldap'): void {
    const shouldUseLdap = mode === 'ldap';
    if (this.isLdapMode === shouldUseLdap) {
      return;
    }
    this.isLdapMode = shouldUseLdap;

    if (this.showCaptcha) {
      this.captchaService.reset();
      this.captcha?.setValue('');
      this.captcha?.clearValidators();
      this.captcha?.updateValueAndValidity();
    }
  }

  private applyPasswordValidators(): void {
    const passwordControl = this.password;
    if (!passwordControl) {
      return;
    }
    passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
    passwordControl.updateValueAndValidity({ emitEvent: false });
  }
}

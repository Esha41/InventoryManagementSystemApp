import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, EyeOff, Lock, User, AlertCircle, RefreshCw } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';
import { ConfigService } from '@services/config.service';
import { environment } from '@environments/environment';
import { LoginRequest } from '@models/auth.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getDefaultLandingUrl } from '@utils/default-landing-route.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    RouterLink
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

  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;
  loginError = '';
  isLdapMode = false;
  failedLoginAttempts = 0;
  showCaptcha = false;
  captchaImage = '';
  captchaId = '';
  isLoadingCaptcha = false;
  showTakeOverDialog = false;
  pendingLoginCredentials: { username: string; password: string; captchaId?: string; captchaCode?: string } | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private backendAuth: BackendAuthService,
    private translate: TranslateService,
    public translationService: TranslationService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef
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

    this.backendAuth.restoreSessionSilently().subscribe(restored => {
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
    this.showCaptcha = false;
    this.captchaImage = '';
    this.captchaId = '';
    this.captcha?.setValue('');
    this.captcha?.clearValidators();
    this.captcha?.updateValueAndValidity();

    this.failedLoginAttempts = 0;
    sessionStorage.removeItem('loginFailedAttempts');

    const sessionConflict = this.route.snapshot.queryParams['sessionConflict'];
    if (sessionConflict === 'true') {
      this.loginError = this.translate.instant('auth.login.errors.singleSession');
    }
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
  get captcha() { return this.loginForm.get('captcha'); }
  get isRTL(): boolean { return this.translationService.isRTL(); }
  get isDevelopment(): boolean { return !environment.production; }

  /**
   * Check if login button should be disabled
   */
  get isLoginDisabled(): boolean {
    if (this.isLoading) {
      return true;
    }

    // If captcha is shown, it must be filled
    if (this.showCaptcha) {
      return !this.loginForm.valid || !this.captcha?.value || this.captcha?.invalid;
    }

    // Otherwise, just check if form is valid
    return !this.loginForm.valid;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Load captcha from API
   */
  loadCaptcha(): void {
    this.isLoadingCaptcha = true;
    this.showCaptcha = true;
    this.cdr.markForCheck();

    // Add required validator to captcha field
    this.captcha?.setValidators([Validators.required]);
    this.captcha?.updateValueAndValidity();

    this.backendAuth.generateCaptcha().subscribe({
      next: (response) => {
        this.configService.log('Captcha loaded successfully', response);
        if (!response || !response.captchaId) {
          throw new Error('Invalid captcha response: missing captchaId');
        }
        this.captchaId = response.captchaId;
        // Generate captcha image from the captchaCode
        if (response.captchaCode) {
          this.captchaImage = this.generateCaptchaImage(response.captchaCode);
        } else {
          throw new Error('Invalid captcha response: missing captchaCode');
        }
        this.isLoadingCaptcha = false;
        this.cdr.markForCheck();
        // Clear any previous errors
        if (this.loginError && this.loginError.includes('captcha')) {
          this.loginError = '';
        }
      },
      error: (error) => {
        this.isLoadingCaptcha = false;
        this.cdr.markForCheck();
        this.configService.logError('Failed to load captcha', error);

        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load captcha. Please try again.');
        this.loginError = this.translate.instant('auth.login.errors.captchaLoadFailed') || errorMessage;
      }
    });
  }

  /**
   * Refresh captcha
   */
  refreshCaptcha(): void {
    this.captcha?.setValue('');
    this.loadCaptcha();
  }

  /**
   * Generate captcha image from text code using Canvas
   * Enhanced with more security features to make it harder to read
   */
  private generateCaptchaImage(captchaCode: string): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Set canvas dimensions (larger for better distortion)
    canvas.width = 180;
    canvas.height = 60;

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(0.5, '#e8e8e8');
    gradient.addColorStop(1, '#f5f5f5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add complex noise pattern (dots of varying sizes)
    ctx.fillStyle = '#d0d0d0';
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      const size = Math.random() * 2 + 0.5;
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        size,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }

    // Add random circles for additional noise
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 5 + 2,
        0,
        2 * Math.PI
      );
      ctx.stroke();
    }

    // Add wavy lines across the background
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const y = Math.random() * canvas.height;
      ctx.moveTo(0, y);
      for (let x = 0; x < canvas.width; x += 10) {
        ctx.lineTo(x, y + Math.sin(x * 0.1 + i) * 3);
      }
      ctx.stroke();
    }

    // Draw text with enhanced distortion
    const charSpacing = canvas.width / (captchaCode.length + 1);
    const baseY = canvas.height / 2;

    for (let i = 0; i < captchaCode.length; i++) {
      const char = captchaCode[i];
      const baseX = charSpacing * (i + 1);

      // Random vertical offset for each character
      const yOffset = (Math.random() - 0.5) * 8;
      const x = baseX + (Math.random() - 0.5) * 3;
      const y = baseY + yOffset;

      // Random rotation (more extreme)
      const rotation = (Math.random() - 0.5) * 0.5; // -0.25 to 0.25 radians

      // Random font size variation
      const fontSize = 24 + Math.random() * 8; // 24-32px
      ctx.font = `bold ${fontSize}px Arial`;

      // Random color with more variation
      const colorVariation = Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgb(${40 + colorVariation}, ${40 + colorVariation}, ${40 + colorVariation})`;

      // Draw character with transformation
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // Add slight skew for more distortion
      ctx.transform(1, Math.random() * 0.2 - 0.1, Math.random() * 0.1 - 0.05, 1, 0, 0);

      // Draw character with shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(char, 0, 0);
      ctx.restore();
    }

    // Add multiple crossing lines (more complex)
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      const endX = Math.random() * canvas.width;
      const endY = Math.random() * canvas.height;

      // Create curved line
      ctx.moveTo(startX, startY);
      const cpX = (startX + endX) / 2 + (Math.random() - 0.5) * 20;
      const cpY = (startY + endY) / 2 + (Math.random() - 0.5) * 20;
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.stroke();
    }

    // Add random rectangles for additional noise
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 10 + 2,
        Math.random() * 10 + 2
      );
    }

    // Add diagonal lines
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, 0);
      ctx.lineTo(Math.random() * canvas.width, canvas.height);
      ctx.stroke();
    }

    // Apply slight overall distortion effect
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Add subtle pixel noise
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() > 0.95) {
        const noise = Math.random() * 30 - 15;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert canvas to data URL
    return canvas.toDataURL('image/png');
  }

  /**
   * Handle captcha image load error (fallback - shouldn't happen with generated images)
   */
  onCaptchaImageError(): void {
    this.configService.logError('Captcha image failed to load', { captchaId: this.captchaId });
    // Reload the captcha
    this.loadCaptcha();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    // Validate captcha if required
    if (this.showCaptcha && !this.captcha?.value) {
      this.captcha?.markAsTouched();
      return;
    }

    this.isLoading = true;
    this.loginError = '';
    this.cdr.markForCheck();

    const formValue = this.loginForm.value as { username: string; password: string; captcha: string; };

    const loginRequest: LoginRequest = {
      username: formValue.username,
      password: formValue.password,
      isLdap: this.isLdapMode,
      ...(this.showCaptcha && {
        captchaId: this.captchaId,
        captchaCode: formValue.captcha
      })
    };

    this.backendAuth.login(loginRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        // Reset failed attempts on successful login
        this.failedLoginAttempts = 0;
        sessionStorage.removeItem('loginFailedAttempts');
        this.showCaptcha = false;
        this.captchaImage = '';
        this.captchaId = '';
        this.loginForm.get('captcha')?.setValue('');

        setTimeout(() => {
          this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth));
        }, 400);
      },
      error: (error) => {
        this.isLoading = false;
        this.cdr.markForCheck();

        // Check if error indicates ALREADY_LOGGED_IN (single-session: show take-over dialog)
        const errorCode = error?.error?.code?.value ||
          error?.error?.code?.Value ||
          error?.error?.value ||
          error?.error?.errorCode ||
          error?.errorCode ||
          error?.error?.code?.value ||
          error?.error?.data?.errorCode ||
          '';
        const numericCode = error?.error?.code?.code ||
          error?.error?.code?.Code ||
          (typeof error?.error?.code === 'number' ? error?.error?.code : null) ||
          error?.errorCode;
        const isAlreadyLoggedIn = errorCode === 'ALREADY_LOGGED_IN' || numericCode === 22;

        if (isAlreadyLoggedIn) {
          const wasSessionExpired = sessionStorage.getItem('sessionExpired') === 'true';
          sessionStorage.removeItem('sessionExpired');

          if (wasSessionExpired) {
            this.loginError = '';
            this.cdr.markForCheck();
            this.pendingLoginCredentials = {
              username: formValue.username,
              password: formValue.password,
              captchaId: this.showCaptcha ? this.captchaId : undefined,
              captchaCode: this.showCaptcha ? formValue.captcha : undefined
            };
            this.takeOverSession();
            return;
          }

          this.loginError = '';
          this.showTakeOverDialog = true;
          this.cdr.markForCheck();
          this.pendingLoginCredentials = {
            username: formValue.username,
            password: formValue.password,
            captchaId: this.showCaptcha ? this.captchaId : undefined,
            captchaCode: this.showCaptcha ? formValue.captcha : undefined
          };
          return;
        }

        this.loginError = this.getUserFriendlyErrorMessage(error, formValue.username);
        this.cdr.markForCheck();

        const isCaptchaRequired = errorCode === 'CAPTCHA_REQUIRED' ||
          errorCode === '0018' ||
          numericCode === 18 ||
          this.loginError.toLowerCase().includes('captcha verification is required') ||
          this.loginError.toLowerCase().includes('captcha required');

        // Increment failed attempts
        this.failedLoginAttempts++;
        sessionStorage.setItem('loginFailedAttempts', this.failedLoginAttempts.toString());

        if ((this.failedLoginAttempts >= 3 || isCaptchaRequired) && !this.showCaptcha) {
          this.loadCaptcha();
        } else if (this.showCaptcha) {
          this.loadCaptcha();
        }
      }
    });
  }

  takeOverSession(): void {
    if (!this.pendingLoginCredentials) return;
    this.showTakeOverDialog = false;
    this.isLoading = true;
    this.loginError = '';
    this.cdr.markForCheck();

    const loginRequest: LoginRequest = {
      ...this.pendingLoginCredentials,
      isLdap: this.isLdapMode,
      forceLogin: true
    };
    this.pendingLoginCredentials = null;

    this.backendAuth.login(loginRequest).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.failedLoginAttempts = 0;
        sessionStorage.removeItem('loginFailedAttempts');
        this.showCaptcha = false;
        this.captchaImage = '';
        this.captchaId = '';
        this.loginForm.get('captcha')?.setValue('');
        setTimeout(() => {
          this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth));
        }, 400);
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = this.getUserFriendlyErrorMessage(error, loginRequest.username);
        this.cdr.markForCheck();
      }
    });
  }

  cancelTakeOver(): void {
    this.showTakeOverDialog = false;
    this.pendingLoginCredentials = null;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);

    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        if (fieldName === 'username') {
          return this.translate.instant('auth.login.errors.usernameRequired');
        } else if (fieldName === 'password') {
          return this.translate.instant('auth.login.errors.invalidCredentials');
        } else if (fieldName === 'captcha') {
          return this.translate.instant('auth.login.errors.captchaRequired') || 'Captcha is required';
        }
      }
      if (field.errors['minlength']) {
        if (fieldName === 'username') {
          return this.translate.instant('auth.login.errors.usernameMinLength');
        }
        return '';
      }
    }
    return '';
  }

  /**
   * Handle Enter key press to submit form
   */
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

    // Reset captcha when switching modes
    if (this.showCaptcha) {
      this.showCaptcha = false;
      this.captchaImage = '';
      this.captchaId = '';
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

    // Password is always required for both regular login and LDAP login
    passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
    passwordControl.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Get user-friendly error message from error object
   * @param error - The error object from the API
   * @param username - The username that was attempted (to determine if it's likely a password issue)
   */
  private getUserFriendlyErrorMessage(error: unknown, username?: string): string {
    const err = error as Record<string, unknown> | null | undefined;
    const errError = err?.['error'] as Record<string, unknown> | undefined;
    const errCode = errError?.['code'] as Record<string, unknown> | undefined;
    const errData = errError?.['data'] as Record<string, unknown> | undefined;

    // Extract error message using centralized ErrorHandler
    const errorMessage = ErrorHandler.extractErrorMessage(error, '');

    // Extract error code from various possible locations (including 'value' and 'code' fields)
    // Backend returns CommonErrorCodes which has both Value (string) and Code (int)
    let errorCode = (errCode?.['value'] as string) ||
      (errCode?.['Value'] as string) ||
      (errError?.['value'] as string) ||
      (errError?.['errorCode'] as string) ||
      (err?.['errorCode'] as string) ||
      (errData?.['errorCode'] as string) ||
      '';

    // Also check numeric code and map to string value if needed
    if (!errorCode) {
      const numericCode = (errCode?.['code'] as number) ??
        (errCode?.['Code'] as number) ??
        (typeof errCode === 'number' ? errCode : null) ??
        (err?.['errorCode'] as number);
      
      // Map numeric codes to string values
      if (numericCode !== undefined && numericCode !== null) {
        const codeMap: { [key: number]: string } = {
          8: 'INVALID_EMAIL_OR_PASSWORD',
          14: 'INVALID_LDAP_SETTINGS',
          15: 'ACCOUNT_DELETED',
          16: 'ACCOUNT_LOCKED',
          17: 'ACCOUNT_DISABLED',
          18: 'CAPTCHA_REQUIRED',
          19: 'CAPTCHA_INVALID',
          20: 'INVALID_DOMAIN',
          21: 'INVALID_USERNAME_FORMAT',
          22: 'ALREADY_LOGGED_IN'
        };
        errorCode = codeMap[numericCode] || '';
      }
    }

    // Extract status code
    const statusCode = (err?.['status'] as number) || (errError?.['status'] as number) || 0;

    const lowerMessage = String(errorMessage).toLowerCase();

    // Check if username looks valid (to determine if it's likely a password issue)
    const hasValidUsername = username && username.trim().length >= 3;

    // First priority: If backend provides a user-friendly error message, use it directly
    // This handles cases like "Account is temporarily locked due to too many failed login attempts. Please try again in 15 minutes."
    // or "Invalid domain. Please use the correct domain: sddev.local"
    if (errorMessage && errorMessage.trim()) {
      // Check for domain-related messages first - these are always important to show
      if (lowerMessage.includes('domain') || lowerMessage.includes('invalid domain')) {
        return errorMessage;
      }
      
      // Check if message looks user-friendly (not technical)
      const isUserFriendly = !errorMessage.includes('server.') &&
        !errorMessage.includes('Error') &&
        !errorMessage.includes('Exception') &&
        !errorMessage.includes('APIOperationResponse') &&
        !errorMessage.includes('HttpErrorResponse') &&
        !errorMessage.startsWith('Http failure') &&
        !errorMessage.includes('TypeError') &&
        !errorMessage.includes('ReferenceError') &&
        !errorMessage.includes('at ') &&
        !errorMessage.includes('Stack') &&
        errorMessage.length < 200; // Reasonable length for user messages

      if (isUserFriendly) {
        // Try to translate common backend error messages
        const translatedMessage = this.translateBackendErrorMessage(errorMessage, lowerMessage);
        if (translatedMessage) {
          return translatedMessage;
        }
        // If translation returns null but message is user-friendly, use it directly
        // This ensures backend-specific messages like "Invalid domain. Please use the correct domain: sddev.local" are shown
        return errorMessage;
      }
    }

    // Check for specific error codes from backend - prioritize specific codes first
    // Account locked
    if (errorCode === 'ACCOUNT_LOCKED' || errorCode === '0016') {
      if (errorMessage && errorMessage.trim() && !errorMessage.includes('Error') && !errorMessage.includes('Exception')) {
        const translated = this.translateBackendErrorMessage(errorMessage, lowerMessage);
        if (translated) {
          return translated;
        }
        return errorMessage;
      }
      return this.translate.instant('auth.login.errors.accountLocked');
    }

    // Account disabled
    if (errorCode === 'ACCOUNT_DISABLED' || errorCode === '0017') {
      if (errorMessage && errorMessage.trim() && !errorMessage.includes('Error') && !errorMessage.includes('Exception')) {
        return errorMessage;
      }
      return this.translate.instant('auth.login.errors.accountDisabled');
    }

    // Account deleted
    if (errorCode === 'ACCOUNT_DELETED' || errorCode === '0015') {
      return this.translate.instant('auth.login.errors.accountDeleted');
    }

    // Invalid domain
    if (errorCode === 'INVALID_DOMAIN' || errorCode === '0020') {
      if (errorMessage && errorMessage.includes('server.invalidDomain')) {
        return this.translate.instant('auth.login.errors.invalidDomain');
      }
      return this.translate.instant('auth.login.errors.invalidDomain') || 
             'Invalid domain. Please check your username format.';
    }

    // Invalid username format
    if (errorCode === 'INVALID_USERNAME_FORMAT' || errorCode === '0021') {
      if (errorMessage && errorMessage.trim()) {
        return errorMessage;
      }
      return this.translate.instant('auth.login.errors.invalidUsernameFormat') || 
             'Invalid username format. Please use username or username@domain.com';
    }

    // CAPTCHA required
    if (errorCode === 'CAPTCHA_REQUIRED' || errorCode === '0018') {
      if (errorMessage && errorMessage.trim()) {
        return errorMessage;
      }
      return this.translate.instant('auth.login.errors.captchaRequired') || 
             'CAPTCHA verification is required. Please complete the CAPTCHA and try again.';
    }

    // CAPTCHA invalid
    if (errorCode === 'CAPTCHA_INVALID' || errorCode === '0019') {
      if (errorMessage && errorMessage.trim()) {
        return errorMessage;
      }
      return this.translate.instant('auth.login.errors.captchaInvalid') || 
             'CAPTCHA verification failed. Please try again.';
    }

    // Invalid LDAP settings
    if (errorCode === 'INVALID_LDAP_SETTINGS' || errorCode === '0014') {
      return this.translate.instant('auth.login.errors.invalidLdapSettings');
    }

    // Invalid credentials - handle last as it's the most generic
    if (errorCode === 'INVALID_EMAIL_OR_PASSWORD' ||
      errorCode === '0008' ||
      errorCode === 'INVALID_CREDENTIALS' ||
      errorCode === 'AUTH_FAILED') {
      // If backend provides a specific message, use it
      if (errorMessage && errorMessage.trim() && 
          !errorMessage.includes('Exception') &&
          !errorMessage.includes('APIOperationResponse') &&
          !errorMessage.includes('HttpErrorResponse') &&
          !errorMessage.startsWith('Http failure') &&
          !errorMessage.includes('at ') &&
          !errorMessage.includes('Stack') &&
          !errorMessage.includes('server.invalidLogin') &&
          errorMessage.length < 300) {
        return errorMessage;
      }
      
      // Fallback to generic message - never reveal which field is incorrect
      if (this.isLdapMode) {
        return this.translate.instant('auth.login.errors.invalidLdapCredentials') || 
               this.translate.instant('auth.login.errors.invalidCredentials');
      }
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }

    // Check for session conflicts
    if (errorCode === 'SESSION_CONFLICT' ||
      errorCode === 'MULTIPLE_SESSIONS' ||
      lowerMessage.includes('session conflict') ||
      lowerMessage.includes('multiple sessions')) {
      return this.translate.instant('auth.login.errors.singleSession');
    }

    // Check for specific error message patterns
    if (lowerMessage.includes('server.invalidlogin') ||
      lowerMessage.includes('invalidlogin') ||
      lowerMessage.includes('invalid login') ||
      lowerMessage.includes('login failed')) {
      return this.translate.instant('auth.login.errors.invalidLogin');
    }

    // Check for password-specific errors - return generic message (never reveal which field is wrong)
    if (lowerMessage.includes('incorrect password') ||
      lowerMessage.includes('wrong password') ||
      lowerMessage.includes('invalid password') ||
      lowerMessage.includes('password is incorrect') ||
      lowerMessage.includes('password incorrect')) {
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }

    // Check for invalid credentials patterns - always return generic message
    if ((lowerMessage.includes('invalid') &&
      (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('credential') || lowerMessage.includes('username'))) ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('bad credentials') ||
      lowerMessage.includes('authentication failed') ||
      lowerMessage.includes('access denied')) {
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }

    // Check for LDAP errors
    if (lowerMessage.includes('ldap') &&
      (lowerMessage.includes('invalid') ||
        lowerMessage.includes('not available') ||
        lowerMessage.includes('inactive') ||
        lowerMessage.includes('not configured') ||
        lowerMessage.includes('connection failed'))) {
      return this.translate.instant('auth.login.errors.invalidLdapSettings');
    }

    const isLikelyNetworkError = statusCode === 0 ||
      lowerMessage.includes('failed to fetch') ||
      lowerMessage.includes('networkerror') ||
      lowerMessage.includes('connection refused') ||
      lowerMessage.includes('cannot connect') ||
      lowerMessage.includes('net::err_') ||
      lowerMessage.includes('ERR_INTERNET_DISCONNECTED') ||
      lowerMessage.includes('ERR_CONNECTION_REFUSED');
    if (isLikelyNetworkError) {
      return this.translate.instant('auth.login.errors.networkError');
    }

    // Server errors (5xx)
    if (statusCode >= 500 ||
      statusCode === 503 ||
      statusCode === 502 ||
      statusCode === 504 ||
      lowerMessage.includes('internal server error') ||
      lowerMessage.includes('server error') ||
      lowerMessage.includes('service unavailable') ||
      lowerMessage.includes('bad gateway') ||
      lowerMessage.includes('gateway timeout')) {
      return this.translate.instant('auth.login.errors.serverError');
    }

    // Forbidden (403) - access denied or account disabled
    if (statusCode === 403) {
      if (lowerMessage.includes('disabled') || lowerMessage.includes('inactive')) {
        return this.translate.instant('auth.login.errors.accountDisabled');
      }
      return this.translate.instant('auth.login.errors.accessDenied');
    }

    // Unauthorized (401) - return generic message (never reveal which field is wrong)
    if (statusCode === 401) {
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }

    // Bad Request (400) - check if it's a validation error
    if (statusCode === 400) {
      if (lowerMessage.includes('username') || lowerMessage.includes('password') || lowerMessage.includes('required')) {
        return this.translate.instant('auth.login.errors.invalidCredentials');
      }
      return this.translate.instant('auth.login.errors.loginFailed');
    }

    // Default fallback: Use backend message if it's user-friendly
    if (errorMessage && errorMessage.trim()) {
      // Check if message is technical (should be replaced with generic error)
      const isTechnical = errorMessage.includes('server.') ||
        errorMessage.includes('Error') ||
        errorMessage.includes('Exception') ||
        errorMessage.includes('APIOperationResponse') ||
        errorMessage.includes('HttpErrorResponse') ||
        errorMessage.startsWith('Http failure') ||
        errorMessage.includes('TypeError') ||
        errorMessage.includes('ReferenceError') ||
        errorMessage.includes('at ') ||
        errorMessage.includes('Stack');

      // If message looks user-friendly (not technical and reasonable length), use it
      if (!isTechnical && errorMessage.length < 200) {
        return errorMessage;
      }
    }

    return this.translate.instant('auth.login.errors.unknownError');
  }

  /**
   * Translate backend error messages to current language
   * Handles common error message patterns and extracts dynamic values
   */
  private translateBackendErrorMessage(errorMessage: string, lowerMessage: string): string | null {
    // Handle account temporarily locked with time remaining
    if (lowerMessage.includes('temporarily locked') ||
      lowerMessage.includes('too many failed') ||
      lowerMessage.includes('locked due to')) {

      // Try to extract minutes from message (e.g., "try again in 15 minutes")
      const minutesMatch = errorMessage.match(/(\d+)\s*(?:minute|min|minutes?)/i);
      if (minutesMatch && minutesMatch[1]) {
        const minutes = minutesMatch[1];
        return this.translate.instant('auth.login.errors.accountTemporarilyLocked', { minutes });
      }

      // Generic temporarily locked message
      return this.translate.instant('auth.login.errors.accountTemporarilyLockedGeneric');
    }

    // For other user-friendly messages, return null to use the original message
    // This allows backend messages to be displayed when no translation is available
    return null;
  }
}

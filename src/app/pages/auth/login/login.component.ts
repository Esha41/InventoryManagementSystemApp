import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Lock = Lock;
  readonly User = User;
  readonly AlertCircle = AlertCircle;

  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;
  loginError = '';
  isLdapMode = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private backendAuth: BackendAuthService,
    private translate: TranslateService,
    private translationService: TranslationService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.applyPasswordValidators();

    // Check if user is already logged in
    if (this.backendAuth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Check for session conflict query parameter
    const sessionConflict = this.route.snapshot.queryParams['sessionConflict'];
    if (sessionConflict === 'true') {
      this.loginError = this.translate.instant('auth.login.errors.singleSession');
    }
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
  get isRTL(): boolean { return this.translationService.isRTL(); }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.loginError = '';

    const formValue = this.loginForm.value as { username: string; password: string; };

    this.backendAuth.login({
      username: formValue.username,
      password: formValue.password,
      isLdap: this.isLdapMode
    }).subscribe({
      next: (response) => {
        this.isLoading = false;

        // Navigate to dashboard
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 400);
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = this.getUserFriendlyErrorMessage(error, formValue.username);
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (fieldName === 'password' && this.isLdapMode) {
      return '';
    }

    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        const key = fieldName === 'username' ? 'auth.login.errors.usernameRequired' : 'auth.login.errors.passwordRequired';
        return this.translate.instant(key);
      }
      if (field.errors['minlength']) {
        const required = field.errors['minlength'].requiredLength;
        if (fieldName === 'username') {
          return this.translate.instant('auth.login.errors.usernameMinLength');
        }
        return this.translate.instant('auth.login.errors.passwordMinLength');
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
    if (shouldUseLdap) {
      this.showPassword = false;
    }
    this.applyPasswordValidators();
  }

  private applyPasswordValidators(): void {
    const passwordControl = this.password;
    if (!passwordControl) {
      return;
    }

    if (this.isLdapMode) {
      passwordControl.setValidators([]);
      passwordControl.setValue('');
    } else {
      passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Get user-friendly error message from error object
   * @param error - The error object from the API
   * @param username - The username that was attempted (to determine if it's likely a password issue)
   */
  private getUserFriendlyErrorMessage(error: any, username?: string): string {
    // Extract error message from various possible locations
    const errorMessage = error?.message || 
                        error?.error?.message || 
                        error?.error?.error?.message ||
                        error?.error?.data?.message ||
                        error?.error?.data ||
                        '';
    
    // Extract error code from various possible locations
    const errorCode = error?.error?.errorCode || 
                     error?.errorCode || 
                     error?.error?.code ||
                     error?.error?.data?.errorCode ||
                     '';
    
    // Extract status code
    const statusCode = error?.status || error?.error?.status || 0;
    
    const lowerMessage = errorMessage.toLowerCase();
    
    // Check if username looks valid (to determine if it's likely a password issue)
    const hasValidUsername = username && username.trim().length >= 3;
    
    // Check for specific error codes from backend
    // If username looks valid, assume it's a password issue
    if (errorCode === 'INVALID_EMAIL_OR_PASSWORD' || 
        errorCode === '0008' ||
        errorCode === 'INVALID_CREDENTIALS' ||
        errorCode === 'AUTH_FAILED') {
      if (hasValidUsername) {
        return this.translate.instant('auth.login.errors.wrongPassword');
      }
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }
    
    if (errorCode === 'INVALID_LDAP_SETTINGS' || 
        errorCode === '0014' ||
        errorCode === 'LDAP_NOT_AVAILABLE' ||
        errorCode === 'LDAP_ERROR') {
      return this.translate.instant('auth.login.errors.invalidLdapSettings');
    }
    
    // Check for account locked/disabled
    if (errorCode === 'ACCOUNT_LOCKED' ||
        errorCode === 'ACCOUNT_DISABLED' ||
        errorCode === 'USER_DISABLED' ||
        lowerMessage.includes('account locked') ||
        lowerMessage.includes('account disabled') ||
        lowerMessage.includes('user is disabled')) {
      return this.translate.instant('auth.login.errors.accountLocked');
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
    
    // Check for password-specific errors first
    if (lowerMessage.includes('incorrect password') ||
        lowerMessage.includes('wrong password') ||
        lowerMessage.includes('invalid password') ||
        lowerMessage.includes('password is incorrect') ||
        lowerMessage.includes('password incorrect')) {
      return this.translate.instant('auth.login.errors.wrongPassword');
    }
    
    // Check for invalid credentials patterns
    // If username is provided and looks valid, assume it's a password issue
    if ((lowerMessage.includes('invalid') && 
         (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('credential') || lowerMessage.includes('username'))) ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('bad credentials') ||
        lowerMessage.includes('authentication failed') ||
        lowerMessage.includes('access denied')) {
      // If username looks valid, it's likely a password issue
      if (hasValidUsername && (errorCode === 'INVALID_EMAIL_OR_PASSWORD' || errorCode === '0008' || statusCode === 401)) {
        return this.translate.instant('auth.login.errors.wrongPassword');
      }
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
    
    // Network/connection errors
    if (statusCode === 0 || 
        error?.name === 'HttpErrorResponse' && statusCode === 0 ||
        lowerMessage.includes('network') || 
        lowerMessage.includes('connection') ||
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('cannot connect') ||
        lowerMessage.includes('connection refused') ||
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('networkerror') ||
        error?.message?.includes('ERR_INTERNET_DISCONNECTED') ||
        error?.message?.includes('ERR_CONNECTION_REFUSED')) {
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
    
    // Forbidden (403) - access denied
    if (statusCode === 403) {
      return this.translate.instant('auth.login.errors.accessDenied');
    }
    
    // Unauthorized (401) - typically invalid credentials
    // If username looks valid, assume it's a password issue
    if (statusCode === 401) {
      const hasValidUsername = username && username.trim().length >= 3;
      if (hasValidUsername && (errorCode === 'INVALID_EMAIL_OR_PASSWORD' || errorCode === '0008' || errorCode === 'INVALID_CREDENTIALS')) {
        return this.translate.instant('auth.login.errors.wrongPassword');
      }
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }
    
    // Bad Request (400) - check if it's a validation error
    if (statusCode === 400) {
      if (lowerMessage.includes('username') || lowerMessage.includes('password') || lowerMessage.includes('required')) {
        return this.translate.instant('auth.login.errors.invalidCredentials');
      }
      return this.translate.instant('auth.login.errors.loginFailed');
    }
    
    // Default fallback
    if (errorMessage && errorMessage.trim()) {
      // If it's a technical message (server.*, Error, Exception), use generic error
      if (errorMessage.includes('server.') || 
          errorMessage.includes('Error') || 
          errorMessage.includes('Exception') ||
          errorMessage.includes('APIOperationResponse') ||
          errorMessage.includes('HttpErrorResponse') ||
          errorMessage.startsWith('Http failure') ||
          errorMessage.includes('TypeError') ||
          errorMessage.includes('ReferenceError')) {
        return this.translate.instant('auth.login.errors.loginFailed');
      }
      // If message looks user-friendly (not too technical), use it
      if (errorMessage.length < 100 && !errorMessage.includes('at ') && !errorMessage.includes('Stack')) {
        return errorMessage;
      }
    }
    
    return this.translate.instant('auth.login.errors.unknownError');
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';

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
    private translate: TranslateService
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
        this.loginError = this.getUserFriendlyErrorMessage(error);
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
   */
  private getUserFriendlyErrorMessage(error: any): string {
    // Extract error message from various possible locations
    const errorMessage = error?.message || 
                        error?.error?.message || 
                        error?.error?.error?.message || 
                        '';
    
    // Extract error code from various possible locations
    const errorCode = error?.error?.errorCode || 
                     error?.errorCode || 
                     error?.error?.code ||
                     '';
    
    const lowerMessage = errorMessage.toLowerCase();
    
    // Check for specific error codes from backend
    if (errorCode === 'INVALID_EMAIL_OR_PASSWORD' || 
        errorCode === '0008') {
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }
    
    if (errorCode === 'INVALID_LDAP_SETTINGS' || 
        errorCode === '0014') {
      return this.translate.instant('auth.login.errors.invalidLdapSettings');
    }
    
    // Check for specific error message patterns
    if (lowerMessage.includes('server.invalidlogin') || 
        lowerMessage.includes('invalidlogin') ||
        lowerMessage.includes('invalid login')) {
      return this.translate.instant('auth.login.errors.invalidLogin');
    }
    
    // Check for invalid credentials patterns
    if ((lowerMessage.includes('invalid') && 
         (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('credential'))) ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('incorrect password') ||
        lowerMessage.includes('wrong password')) {
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }
    
    // Check for LDAP errors
    if (lowerMessage.includes('ldap') && 
        (lowerMessage.includes('invalid') || lowerMessage.includes('not available') || lowerMessage.includes('inactive'))) {
      return this.translate.instant('auth.login.errors.invalidLdapSettings');
    }
    
    // Network/connection errors
    if (error?.status === 0 || 
        lowerMessage.includes('network') || 
        lowerMessage.includes('connection') ||
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('cannot connect') ||
        lowerMessage.includes('connection refused')) {
      return this.translate.instant('auth.login.errors.networkError');
    }
    
    // Server errors (5xx)
    if (error?.status >= 500 || 
        lowerMessage.includes('internal server error') ||
        lowerMessage.includes('server error')) {
      return this.translate.instant('auth.login.errors.serverError');
    }
    
    // Unauthorized (401) - typically invalid credentials
    if (error?.status === 401) {
      return this.translate.instant('auth.login.errors.invalidCredentials');
    }
    
    // Default fallback
    if (errorMessage) {
      // If it's a technical message (server.*, Error, Exception), use generic error
      if (errorMessage.includes('server.') || 
          errorMessage.includes('Error') || 
          errorMessage.includes('Exception') ||
          errorMessage.includes('APIOperationResponse')) {
        return this.translate.instant('auth.login.errors.loginFailed');
      }
      // Otherwise, try to use the message if it's user-friendly
      return errorMessage;
    }
    
    return this.translate.instant('auth.login.errors.unknownError');
  }
}

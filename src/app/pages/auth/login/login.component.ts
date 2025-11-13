import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { Subscription } from 'rxjs';

interface LoginForm {
  username: string;
  password: string;
  useLdap: boolean;
}

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
export class LoginComponent implements OnInit, OnDestroy {
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Lock = Lock;
  readonly User = User;
  readonly AlertCircle = AlertCircle;

  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;
  loginError = '';
  private ldapToggleSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private backendAuth: BackendAuthService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      useLdap: [false]
    });
  }

  ngOnInit(): void {
    this.handleLdapToggling();

    // Check if user is already logged in
    if (this.backendAuth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    this.ldapToggleSubscription?.unsubscribe();
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
  get useLdap() { return this.loginForm.get('useLdap'); }

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

    const formValue = this.loginForm.value as LoginForm;

    this.backendAuth.login({
      username: formValue.username,
      password: formValue.password,
      isLdap: formValue.useLdap
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
        this.loginError = error.message || 'Login failed. Please try again.';
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
    if (fieldName === 'password' && this.useLdap?.value) {
      return '';
    }

    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        const displayName = fieldName === 'username' ? 'Username' : 'Password';
        return `${displayName} is required`;
      }
      if (field.errors['minlength']) {
        const required = field.errors['minlength'].requiredLength;
        if (fieldName === 'username') {
          return `Username must be at least ${required} characters`;
        }
        return `Password must be at least ${required} characters`;
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

  private handleLdapToggling(): void {
    const useLdapControl = this.useLdap;
    if (!useLdapControl) {
      return;
    }

    this.applyPasswordValidators(useLdapControl.value === true);

    this.ldapToggleSubscription = useLdapControl.valueChanges.subscribe((isLdap) => {
      this.applyPasswordValidators(isLdap === true);
    });
  }

  private applyPasswordValidators(isLdap: boolean): void {
    const passwordControl = this.password;
    if (!passwordControl) {
      return;
    }

    if (isLdap) {
      passwordControl.setValidators([]);
      passwordControl.setValue('');
    } else {
      passwordControl.setValidators([Validators.required, Validators.minLength(6)]);
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
  }
}

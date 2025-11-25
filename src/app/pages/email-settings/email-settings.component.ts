import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EmailConfigurationService, EmailConfigurationDto } from '@services/email-configuration.service';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-email-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    TranslateModule
  ],
  templateUrl: './email-settings.component.html',
  styleUrls: ['./email-settings.component.css']
})
export class EmailSettingsComponent implements OnInit, OnDestroy {
  emailConfig: EmailConfigurationDto = {};
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  
  // Form fields
  enableEmailNotifications = false;
  host = '';
  port: number | null = null;
  enableSsl = false;
  senderName = '';
  accountUsername = '';
  accountPassword = '';
  showPassword = false;
  hasExistingPassword = false;

  // Store original values for cancel
  private originalValues: {
    enableEmailNotifications: boolean;
    host: string;
    port: number | null;
    enableSsl: boolean;
    senderName: string;
    accountUsername: string;
  } = {
    enableEmailNotifications: false,
    host: '',
    port: null,
    enableSsl: false,
    senderName: '',
    accountUsername: ''
  };

  private destroy$ = new Subject<void>();

  constructor(
    private emailConfigService: EmailConfigurationService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadEmailConfiguration();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadEmailConfiguration(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.emailConfigService.getEmailConfiguration()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (config) => {
          this.emailConfig = config;
          this.enableEmailNotifications = config.enableEmailNotifications ?? false;
          this.host = config.hostIp || '';
          this.port = config.port ?? null;
          this.enableSsl = config.enableSsl ?? false;
          this.senderName = config.senderDisplayName || '';
          this.accountUsername = config.username || '';
          this.hasExistingPassword = config.hasPassword ?? false;
          this.accountPassword = ''; // Don't load password
          
          // Store original values for cancel
          this.originalValues = {
            enableEmailNotifications: this.enableEmailNotifications,
            host: this.host,
            port: this.port,
            enableSsl: this.enableSsl,
            senderName: this.senderName,
            accountUsername: this.accountUsername
          };
          
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          // Don't show error for 403/404 - we handle these gracefully by showing empty form
          const is403 = (error as any)?.status === 403 || error?.message?.includes('403') || error?.message?.includes('Forbidden');
          const is404 = (error as any)?.status === 404 || error?.message?.includes('404') || error?.message?.includes('Not Found');
          
          if (!is403 && !is404) {
            this.errorMessage = error.message || 'Failed to load email configuration';
            this.translateService.get(['toast.error']).subscribe(translations => {
              this.toastService.error(
                this.errorMessage,
                translations['toast.error']
              );
            });
          } else {
            // For 403/404, just continue with empty form (already handled by service)
            // User can still fill out and save the form
          }
        }
      });
  }

  saveChanges(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const config: EmailConfigurationDto = {
      id: this.emailConfig.id,
      enableEmailNotifications: this.enableEmailNotifications,
      hostIp: this.host.trim(),
      port: this.port ?? undefined,
      enableSsl: this.enableSsl,
      senderDisplayName: this.senderName.trim(),
      username: this.accountUsername.trim(),
      // Only include password if it was changed (not empty)
      ...(this.accountPassword ? { password: this.accountPassword } : {})
    };

    this.emailConfigService.updateEmailConfiguration(config)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedConfig) => {
          this.emailConfig = updatedConfig;
          this.hasExistingPassword = updatedConfig.hasPassword ?? false;
          this.accountPassword = ''; // Clear password field after save
          this.isSaving = false;
          
          this.translateService.get(['emailSettings.savedSuccessfully', 'toast.success']).subscribe(translations => {
            this.toastService.success(
              translations['emailSettings.savedSuccessfully'],
              translations['toast.success']
            );
          });
        },
        error: (error) => {
          this.isSaving = false;
          
          // Extract error message from various error formats
          let errorMessage = 'Failed to save email configuration';
          
          // Check if it's an HttpErrorResponse
          if ((error as any)?.status === 403) {
            errorMessage = 'You do not have permission to update email settings. Please contact your administrator.';
          } else if ((error as any)?.status === 404) {
            errorMessage = 'Email settings endpoint not found. Please verify the API endpoint is configured correctly.';
          } else if (error instanceof Error) {
            errorMessage = error.message;
          } else if ((error as any)?.message) {
            errorMessage = (error as any).message;
          }
          
          // Don't show "An unknown error occurred" - provide more context
          if (errorMessage === 'An unknown error occurred' || !errorMessage) {
            errorMessage = 'Failed to save email configuration. Please check your permissions and try again.';
          }
          
          this.errorMessage = errorMessage;
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(
              this.errorMessage,
              translations['toast.error']
            );
          });
        }
      });
  }

  validateForm(): boolean {
    if (!this.host.trim()) {
      this.errorMessage = 'Host is required';
      return false;
    }

    if (this.port === null || this.port === undefined || this.port <= 0) {
      this.errorMessage = 'Port is required and must be a positive number';
      return false;
    }

    if (!this.senderName.trim()) {
      this.errorMessage = 'Sender Name is required';
      return false;
    }

    if (!this.accountUsername.trim()) {
      this.errorMessage = 'Account Username is required';
      return false;
    }

    // Password is only required if there's no existing password
    if (!this.hasExistingPassword && !this.accountPassword.trim()) {
      this.errorMessage = 'Account Password is required';
      return false;
    }

    this.errorMessage = '';
    return true;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  cancelChanges(): void {
    // Reset form to original values
    this.enableEmailNotifications = this.originalValues.enableEmailNotifications;
    this.host = this.originalValues.host;
    this.port = this.originalValues.port;
    this.enableSsl = this.originalValues.enableSsl;
    this.senderName = this.originalValues.senderName;
    this.accountUsername = this.originalValues.accountUsername;
    this.accountPassword = '';
    this.errorMessage = '';
  }
}


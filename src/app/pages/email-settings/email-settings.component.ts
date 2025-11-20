import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { LucideAngularModule, Mail, Save } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { EmailConfigurationService } from '@services/email-configuration.service';
import { CreateUpdateEmailConfigurationDto } from '@models/email-configuration.model';

@Component({
  selector: 'app-email-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    ButtonComponent,
    LucideAngularModule,
    TranslateModule
  ],
  templateUrl: './email-settings.component.html',
  styleUrls: ['./email-settings.component.css']
})
export class EmailSettingsComponent implements OnInit {
  readonly Mail = Mail;
  readonly Save = Save;

  emailSettingsForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';
  private hasStoredPassword = false;

  constructor(
    private fb: FormBuilder,
    private emailConfigService: EmailConfigurationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadEmailSettings();
  }

  private initializeForm(): void {
    const defaults = this.getDefaultSettings();
    this.emailSettingsForm = this.fb.group({
      // Email Settings
      enableEmailNotifications: [defaults.enableEmailNotifications],
      host: [defaults.host],
      port: [defaults.port, [Validators.min(1), Validators.max(65535)]],
      enableSSL: [defaults.enableSSL],
      senderName: [defaults.senderName],
      accountUsername: [defaults.accountUsername, [Validators.email]],
      // Password is optional - if empty, we'll use the original password when saving
      accountPassword: [defaults.accountPassword],

      // Asset Return Email Content
      assetReturnEmailContent: [defaults.assetReturnEmailContent, [Validators.maxLength(4000)]],

      // Bulk Asset Notification Email Content
      bulkAssetNotificationEmailContent: [defaults.bulkAssetNotificationEmailContent, [Validators.maxLength(4000)]],

      // OTP Settings
      enableEmailLoginOTP: [defaults.enableEmailLoginOTP],

      // Organization Settings
      organizationName: [defaults.organizationName, [Validators.maxLength(256)]],
      organizationNameArabic: [defaults.organizationNameArabic, [Validators.maxLength(256)]],
      organizationLogoFilename: [defaults.organizationLogoFilename, [Validators.maxLength(256)]],
      organizationReportLogoFilename: [defaults.organizationReportLogoFilename, [Validators.maxLength(256)]]
    });

    this.configureSmtpValidators(this.emailSettingsForm.get('enableEmailNotifications')?.value);

    this.emailSettingsForm.get('enableEmailNotifications')?.valueChanges.subscribe((enabled: boolean) => {
      this.configureSmtpValidators(enabled);
    });
  }

  loadEmailSettings(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.emailConfigService.getEmailConfiguration().subscribe({
      next: (config) => {
        // Map API response to form fields
        this.emailSettingsForm.patchValue({
          enableEmailNotifications: config.enableEmailNotifications,
          host: config.hostIp,
          port: config.port,
          enableSSL: config.ssl,
          senderName: config.displayName,
          accountUsername: config.username,
          // Don't populate password for security reasons
          accountPassword: '',
          assetReturnEmailContent: config.assetReturnEmailContent,
          bulkAssetNotificationEmailContent: config.bulkAssetNotificationEmailContent,
          enableEmailLoginOTP: config.enableEmailLoginOtp,
          organizationName: config.organizationName,
          organizationNameArabic: config.organizationNameArabic,
          organizationLogoFilename: config.organizationLogoFilename,
          organizationReportLogoFilename: config.organizationReportLogoFilename
        });

        this.hasStoredPassword = config.hasPassword;
        this.configureSmtpValidators(config.enableEmailNotifications);

        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        
        // If 404, treat as "no configuration exists yet" - use defaults silently
        if (error?.status === 404) {
          // No configuration exists yet, use defaults
          this.emailSettingsForm.patchValue(this.getDefaultSettings());
          this.hasStoredPassword = false;
          this.configureSmtpValidators(this.emailSettingsForm.get('enableEmailNotifications')?.value);
          // Don't show error for 404 - it's expected if config doesn't exist yet
        } else {
          // For other errors, show error message
          this.errorMessage = error?.userMessage || error?.message || 'Failed to load email configuration';
          this.emailSettingsForm.patchValue(this.getDefaultSettings());
          this.hasStoredPassword = false;
          this.configureSmtpValidators(this.emailSettingsForm.get('enableEmailNotifications')?.value);
        }
      }
    });
  }

  onSave(): void {
    if (this.emailSettingsForm.invalid) {
      this.markFormGroupTouched(this.emailSettingsForm);
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.emailSettingsForm.value;
    const normalizedPort =
      formValue.port === null || formValue.port === undefined || formValue.port === ''
        ? null
        : Number(formValue.port);
    
    // Map form fields to API DTO
    const configDto: CreateUpdateEmailConfigurationDto = {
      hostIp: formValue.host,
      port: normalizedPort,
      ssl: formValue.enableSSL,
      disableAuthentication: false, // Not in UI, defaulting to false
      username: formValue.accountUsername,
      displayName: formValue.senderName,
      enableEmailNotifications: formValue.enableEmailNotifications,
      enableEmailLoginOtp: formValue.enableEmailLoginOTP,
      assetReturnEmailContent: formValue.assetReturnEmailContent,
      bulkAssetNotificationEmailContent: formValue.bulkAssetNotificationEmailContent,
      organizationName: formValue.organizationName,
      organizationNameArabic: formValue.organizationNameArabic,
      organizationLogoFilename: formValue.organizationLogoFilename,
      organizationReportLogoFilename: formValue.organizationReportLogoFilename
    };

    if (formValue.accountPassword) {
      configDto.password = formValue.accountPassword;
    }

    this.emailConfigService.saveEmailConfiguration(configDto).subscribe({
      next: (savedConfig) => {
        // Preserve the password the user entered (if any)
        const enteredPassword = formValue.accountPassword;
        
        // Update form with saved values from API (to ensure sync)
        this.emailSettingsForm.patchValue({
          enableEmailNotifications: savedConfig.enableEmailNotifications,
          host: savedConfig.hostIp,
          port: savedConfig.port,
          enableSSL: savedConfig.ssl,
          senderName: savedConfig.displayName,
          accountUsername: savedConfig.username,
          assetReturnEmailContent: savedConfig.assetReturnEmailContent,
          bulkAssetNotificationEmailContent: savedConfig.bulkAssetNotificationEmailContent,
          enableEmailLoginOTP: savedConfig.enableEmailLoginOtp,
          organizationName: savedConfig.organizationName,
          organizationNameArabic: savedConfig.organizationNameArabic,
          organizationLogoFilename: savedConfig.organizationLogoFilename,
          organizationReportLogoFilename: savedConfig.organizationReportLogoFilename,
          // Preserve the password the user entered, or keep it empty if they didn't change it
          accountPassword: enteredPassword || '',
        });
        
        this.hasStoredPassword = enteredPassword ? true : savedConfig.hasPassword;
        this.configureSmtpValidators(savedConfig.enableEmailNotifications);
        
        // Mark form as pristine since we just saved
        this.emailSettingsForm.markAsPristine();
        this.emailSettingsForm.markAsUntouched();
        
        this.isSaving = false;
        this.successMessage = 'Email configuration updated successfully';
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error.message || 'Failed to save email configuration';
      }
    });
  }

  onCancel(): void {
    this.emailSettingsForm.reset(this.getDefaultSettings());
    this.hasStoredPassword = false;
    this.configureSmtpValidators(this.emailSettingsForm.get('enableEmailNotifications')?.value);
    this.emailSettingsForm.markAsPristine();
    this.emailSettingsForm.markAsUntouched();
    this.errorMessage = '';
    this.successMessage = '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.emailSettingsForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${fieldName} is required`;
      }
      if (control.errors['email']) {
        return 'Invalid email format';
      }
      if (control.errors['min']) {
        return `Minimum value is ${control.errors['min'].min}`;
      }
      if (control.errors['max']) {
        return `Maximum value is ${control.errors['max'].max}`;
      }
      if (control.errors['maxlength']) {
        return `Maximum length is ${control.errors['maxlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  private getDefaultSettings() {
    return {
      enableEmailNotifications: true,
      host: 'smtp.office365.com',
      port: 587,
      enableSSL: true,
      senderName: 'Asset Admin MSDF',
      accountUsername: 'Asset_Notification@MSDF.gov.qa',
      accountPassword: '',
      assetReturnEmailContent: 'Asset: **AssetName** **ReturnStatus**',
      bulkAssetNotificationEmailContent:
        'Dear Employee, Please find below the updated list of assets assigned to you.',
      enableEmailLoginOTP: false,
      organizationName: '',
      organizationNameArabic: '',
      organizationLogoFilename: '',
      organizationReportLogoFilename: ''
    };
  }

  private configureSmtpValidators(isEnabled: boolean | null | undefined): void {
    const enabled = !!isEnabled;
    const hostControl = this.emailSettingsForm.get('host');
    hostControl?.setValidators(enabled ? [Validators.required] : []);
    hostControl?.updateValueAndValidity({ emitEvent: false });

    const portValidators = [Validators.min(1), Validators.max(65535)];
    if (enabled) {
      portValidators.push(Validators.required);
    }
    const portControl = this.emailSettingsForm.get('port');
    portControl?.setValidators(portValidators);
    portControl?.updateValueAndValidity({ emitEvent: false });

    const senderValidators = enabled ? [Validators.required] : [];
    const senderControl = this.emailSettingsForm.get('senderName');
    senderControl?.setValidators(senderValidators);
    senderControl?.updateValueAndValidity({ emitEvent: false });

    const usernameValidators = [Validators.email];
    if (enabled) {
      usernameValidators.push(Validators.required);
    }
    const usernameControl = this.emailSettingsForm.get('accountUsername');
    usernameControl?.setValidators(usernameValidators);
    usernameControl?.updateValueAndValidity({ emitEvent: false });

    this.updatePasswordValidators(enabled);
  }

  private updatePasswordValidators(isEnabled: boolean | null | undefined): void {
    const passwordControl = this.emailSettingsForm.get('accountPassword');
    if (!passwordControl) {
      return;
    }

    if (!!isEnabled && !this.hasStoredPassword) {
      passwordControl.setValidators([Validators.required]);
    } else {
      passwordControl.clearValidators();
    }

    passwordControl.updateValueAndValidity({ emitEvent: false });
  }
}


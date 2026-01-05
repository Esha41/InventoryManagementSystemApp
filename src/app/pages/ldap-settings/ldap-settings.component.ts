import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { ErrorStateComponent } from '@components/index';
import { ButtonComponent } from '@components/button/button.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LdapSettingsDto, LdapSettingsService } from '@services/ldap-settings.service';
import { ToastService } from '@services/toast.service';

interface LdapSettingsForm extends LdapSettingsDto {
  // ensure required fields are present in form binding
  ldapServer: string;
  ldapDomain: string;
  ldapEmpAttr: string;
  ldapUsername: string;
  ldapPassword?: string | null;
  isActive?: boolean | null;
}

@Component({
  selector: 'app-ldap-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    TranslateModule,
    ErrorStateComponent
  ],
  templateUrl: './ldap-settings.component.html',
  styleUrls: ['./ldap-settings.component.css']
})
export class LdapSettingsComponent implements OnInit, OnDestroy {
  ldapSettings: Partial<LdapSettingsForm> = {
    ldapEmpAttr: 'sAMAccountName'
  };

  isLoading = false;
  isSaving = false;
  errorMessage = '';
  showPassword = false;
  hasExistingPassword = false;

  private originalValues: Partial<LdapSettingsForm> = {};
  private destroy$ = new Subject<void>();

  constructor(
    private readonly ldapSettingsService: LdapSettingsService,
    private readonly toastService: ToastService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadLdapSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLdapSettings(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.ldapSettingsService.getLdapSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (settings) => {
          this.ldapSettings = {
            ldapServer: settings.ldapServer || '',
            ldapDomain: settings.ldapDomain || '',
            ldapEmpAttr: settings.ldapEmpAttr || 'sAMAccountName',
            ldapUsername: settings.ldapUsername || '',
            ldapPassword: '',
            isActive: settings.isActive ?? true,
          };

          this.hasExistingPassword = settings.hasPassword ?? false;

          this.originalValues = { ...this.ldapSettings };
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
          const is403 = (error as any)?.status === 403 || error?.message?.includes('403') || error?.message?.includes('Forbidden');
          const is404 = (error as any)?.status === 404 || error?.message?.includes('404') || error?.message?.includes('Not Found');

          if (!is403 && !is404) {
            this.errorMessage = error.message || 'Failed to load LDAP settings';
            this.translateService.get(['toast.error']).subscribe(translations => {
              this.toastService.error(
                this.errorMessage,
                translations['toast.error']
              );
            });
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

    const payload: LdapSettingsDto = {
      ldapServer: (this.ldapSettings.ldapServer || '').trim(),
      ldapDomain: (this.ldapSettings.ldapDomain || '').trim(),
      ldapEmpAttr: (this.ldapSettings.ldapEmpAttr || 'sAMAccountName').trim(),
      ldapUsername: (this.ldapSettings.ldapUsername || '').trim(),
      ldapPassword: this.ldapSettings.ldapPassword || undefined,
      isActive: this.ldapSettings.isActive ?? true
    };

    this.ldapSettingsService.updateLdapSettings(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.isSaving = false;
          this.hasExistingPassword = updated.hasPassword ?? !!payload.ldapPassword;
          this.ldapSettings.ldapPassword = '';
          this.originalValues = {
            ldapServer: (updated.ldapServer ?? payload.ldapServer) ?? '',
            ldapDomain: (updated.ldapDomain ?? payload.ldapDomain) ?? '',
            ldapEmpAttr: (updated.ldapEmpAttr ?? payload.ldapEmpAttr) ?? 'sAMAccountName',
            ldapUsername: (updated.ldapUsername ?? payload.ldapUsername) ?? '',
            ldapPassword: '',
            isActive: updated.isActive ?? payload.isActive ?? true
          };

          this.translateService.get(['ldapSettings.savedSuccessfully', 'toast.success']).subscribe(translations => {
            this.toastService.success(
              translations['ldapSettings.savedSuccessfully'],
              translations['toast.success']
            );
          });
        },
        error: (error) => {
          this.isSaving = false;
          let message = 'Failed to save LDAP settings';

          if (error instanceof Error && error.message) {
            message = error.message;
          } else if ((error as any)?.message) {
            message = (error as any).message;
          }

          this.errorMessage = message;
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
    const server = (this.ldapSettings.ldapServer || '').trim();
    const domain = (this.ldapSettings.ldapDomain || '').trim();
    const empAttr = (this.ldapSettings.ldapEmpAttr || '').trim();
    const username = (this.ldapSettings.ldapUsername || '').trim();
    const password = (this.ldapSettings.ldapPassword || '').toString().trim();

    // Basic server pattern: optional ldap/ldaps, hostname with TLD OR IPv4, optional port
    const serverPattern = /^(ldaps?:\/\/)?((\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(:\d{1,5})?$/;
    // Domain can be DNS name (example.com) or LDAP DN (DC=EXAMPLE,DC=COM)
    const dnsDomainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const dnPattern = /^([a-zA-Z]+=[^,]+)(,[a-zA-Z]+=[^,]+)*$/;

    if (!server) {
      this.errorMessage = 'LDAP server URL is required';
      return false;
    }

    if (!serverPattern.test(server)) {
      this.errorMessage = 'LDAP server URL is not valid';
      return false;
    }

    if (!domain) {
      this.errorMessage = 'LDAP domain is required';
      return false;
    }

    if (!dnsDomainPattern.test(domain) && !dnPattern.test(domain)) {
      this.errorMessage = 'LDAP domain format is not valid';
      return false;
    }

    if (!empAttr) {
      this.errorMessage = 'LDAP employee attribute is required';
      return false;
    }

    if (!username) {
      this.errorMessage = 'LDAP username is required';
      return false;
    }

    if (!this.hasExistingPassword && !password) {
      this.errorMessage = 'LDAP password is required';
      return false;
    }

    this.errorMessage = '';
    return true;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  cancelChanges(): void {
    this.ldapSettings = { ...this.originalValues };
    this.errorMessage = '';
  }
}



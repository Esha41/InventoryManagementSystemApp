import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Phone, Mail } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { HelpCenterService } from '@help-center/services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';

function optionalEmail(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = (control.value ?? '').toString().trim();
    if (!v) return null;
    const c = new FormControl(v, Validators.email);
    return c.errors;
  };
}

@Component({
  selector: 'app-help-center-contact-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    CardComponent
  ],
  templateUrl: './help-center-contact-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterContactTabComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(BackendAuthService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly Mail = Mail;
  readonly Phone = Phone;

  loading = false;
  saving = false;

  form = this.fb.nonNullable.group({
    supportEmail: ['', [Validators.maxLength(200), optionalEmail()]],
    supportPhone: ['', [Validators.maxLength(50)]]
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canEdit(): boolean {
    return this.auth.hasPermission(PERMISSIONS.ADMIN.HELP_CENTER.EDIT);
  }

  load(): void {
    this.loading = true;
    this.helpCenter
      .getContactDisplaySettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: row => {
          this.form.patchValue({
            supportEmail: row.supportEmail ?? '',
            supportPhone: row.supportPhone ?? ''
          });
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.contactDisplayLoadError'));
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving = true;
    this.helpCenter
      .updateContactDisplaySettings({
        supportEmail: v.supportEmail.trim(),
        supportPhone: v.supportPhone.trim()
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.contactDisplaySaved'));
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.contactDisplaySaveError'));
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }
}

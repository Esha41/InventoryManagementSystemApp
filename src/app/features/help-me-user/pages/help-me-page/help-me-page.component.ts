import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HelpMeUserFacade } from '@features/help-me-user/facades/help-me-user.facade';
import { ProfileDataService } from '@services/profile-data.service';
import { FileUploadService } from '@services/file-upload.service';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { HelpMeLandingState } from '@features/help-me-user/facades/help-me-user.facade';

@Component({
  selector: 'app-help-me-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ModalComponent, ButtonComponent],
  providers: [HelpMeUserFacade],
  templateUrl: './help-me-page.component.html',
  styleUrl: './help-me-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpMePageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(HelpMeUserFacade);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly profile = inject(ProfileDataService);
  private readonly fileUpload = inject(FileUploadService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly state = signal<HelpMeLandingState>({
    article: null,
    files: [],
    loading: true,
    error: null
  });

  submitting = signal(false);
  successOpen = signal(false);

  form = this.fb.nonNullable.group({
    senderName: ['', Validators.required],
    senderEmail: ['', [Validators.required, Validators.email]],
    subject: [''],
    body: ['', Validators.required]
  });

  ngOnInit(): void {
    this.prefillUser();
    this.facade.landing$.pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.state.set(s);
      this.cdr.markForCheck();
    });
    this.facade.loadLanding();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private prefillUser(): void {
    const full = this.profile.getFullProfileData();
    const u = this.profile.getProfile();
    const name =
      full?.fullNameEN ||
      full?.nameEn ||
      u?.nameEn ||
      u?.userName ||
      '';
    const email = full?.email || u?.email || '';
    this.form.patchValue({ senderName: name.trim(), senderEmail: email.trim() });
  }

  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  fileUrl(id: number): string {
    return this.fileUpload.getFileDownloadUrl(id);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const subject =
      (v.subject || '').trim() ||
      this.translate.instant('helpMe.contact.defaultSubject');
    this.submitting.set(true);
    this.facade
      .submitContact({
        senderName: v.senderName.trim(),
        senderEmail: v.senderEmail.trim(),
        subject: subject.slice(0, 300),
        body: v.body.trim()
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.successOpen.set(true);
          this.form.patchValue({ body: '', subject: '' });
          this.cdr.markForCheck();
        },
        error: err => {
          this.submitting.set(false);
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpMe.contact.error'));
          this.cdr.markForCheck();
        }
      });
  }

  closeSuccess(): void {
    this.successOpen.set(false);
  }
}

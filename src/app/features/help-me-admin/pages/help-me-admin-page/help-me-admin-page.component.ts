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
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { HelpMeAdminFacade, HelpMeAdminState } from '@features/help-me-admin/facades/help-me-admin.facade';
import { FileUploadService } from '@services/file-upload.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ButtonComponent } from '@components/button/button.component';
import { HELP_ME_ARTICLE_CATEGORY } from '@constants/help-me.constants';

@Component({
  selector: 'app-help-me-admin-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ConfirmDialogComponent, ButtonComponent],
  providers: [HelpMeAdminFacade],
  templateUrl: './help-me-admin-page.component.html',
  styleUrl: './help-me-admin-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpMeAdminPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(HelpMeAdminFacade);
  private readonly fileUpload = inject(FileUploadService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(BackendAuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly state = signal<HelpMeAdminState>({
    article: null,
    files: [],
    loading: true,
    saving: false,
    error: null
  });

  pendingFiles = signal<File[]>([]);
  deleteTargetId = signal<number | null>(null);
  confirmDeleteOpen = signal(false);

  form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    content: ['', Validators.required],
    isPublished: [true]
  });

  ngOnInit(): void {
    this.facade.state$obs.pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.state.set(s);
      const a = s.article;
      if (a) {
        this.form.patchValue({
          title: a.title,
          content: a.content,
          isPublished: a.isPublished
        });
      }
      this.cdr.markForCheck();
    });
    this.facade.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canEdit(): boolean {
    return this.auth.hasPermission('Permissions.HelpCenter.Edit');
  }

  canCreate(): boolean {
    return this.auth.hasPermission('Permissions.HelpCenter.Create');
  }

  onFilePick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    this.pendingFiles.set(list);
    input.value = '';
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const article = this.state().article;
    if (article) {
      this.facade
        .updateLandingArticle(article.id, {
          title: v.title.trim(),
          content: v.content,
          isPublished: v.isPublished
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toast.success(this.i18n.getTranslation('helpMe.admin.saved'));
            this.afterSaveUpload(article.id);
          },
          error: err =>
            this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpMe.admin.saveError'))
        });
      return;
    }
    if (!this.canCreate()) {
      this.toast.error(this.i18n.getTranslation('helpMe.admin.noPermission'));
      return;
    }
    this.facade
      .createLandingArticle({
        title: v.title.trim(),
        content: v.content,
        category: HELP_ME_ARTICLE_CATEGORY,
        sortOrder: 0,
        isPublished: v.isPublished
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: created => {
          this.toast.success(this.i18n.getTranslation('helpMe.admin.created'));
          this.afterSaveUpload(created.id);
        },
        error: err =>
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpMe.admin.saveError'))
      });
  }

  private afterSaveUpload(articleId: number): void {
    const files = this.pendingFiles();
    if (!files.length) return;
    this.facade
      .uploadFiles(articleId, files)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.pendingFiles.set([]);
          this.facade.refreshFiles(articleId);
          this.cdr.markForCheck();
        },
        error: err =>
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpMe.admin.uploadError'))
      });
  }

  confirmRemoveFile(id: number): void {
    this.deleteTargetId.set(id);
    this.confirmDeleteOpen.set(true);
  }

  onDeleteConfirmed(): void {
    const id = this.deleteTargetId();
    this.confirmDeleteOpen.set(false);
    this.deleteTargetId.set(null);
    if (id == null) return;
    this.facade
      .deleteFile(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.toast.success(this.i18n.getTranslation('helpMe.admin.fileDeleted')),
        error: err =>
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpMe.admin.fileDeleteError'))
      });
  }

  onDeleteCancelled(): void {
    this.confirmDeleteOpen.set(false);
    this.deleteTargetId.set(null);
  }

  fileUrl(id: number): string {
    return this.fileUpload.getFileDownloadUrl(id);
  }
}

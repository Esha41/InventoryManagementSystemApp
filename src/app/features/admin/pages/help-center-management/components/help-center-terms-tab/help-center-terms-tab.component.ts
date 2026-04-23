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
import { QuillEditorComponent } from 'ngx-quill';
import { TranslateModule } from '@ngx-translate/core';
import {
  LucideAngularModule,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban
} from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { HelpCenterService } from '@help-center/services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { HelpCenterTermsDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { CardComponent } from '@components/card/card.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { APP_CONSTANTS, defaultPageSize } from '@constants/app.constants';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { adminBadgePositive, adminTotalPages } from '../../help-center-admin.utils';
import { HELP_CENTER_TERMS_QUILL_MODULES } from '../../help-center-terms-quill.config';
import { richTextRequired } from '@core/validators/rich-text-required.validator';

@Component({
  selector: 'app-help-center-terms-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ConfirmDialogComponent,
    ModalComponent,
    ButtonComponent,
    PaginationComponent,
    CardComponent,
    RowsPerPageComponent,
    AppDateTimePipe,
    QuillEditorComponent
  ],
  templateUrl: './help-center-terms-tab.component.html',
  styleUrls: ['../../help-center-quill-full-width.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterTermsTabComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(BackendAuthService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly CheckCircle2 = CheckCircle2;
  readonly Ban = Ban;

  readonly termsQuillModules = HELP_CENTER_TERMS_QUILL_MODULES;
  readonly termsEditorStyles = { minHeight: '320px' };

  readonly pageSizeOptions = [...APP_CONSTANTS.PAGE_SIZE_OPTIONS];
  rowsPerPage = signal(defaultPageSize);
  termsVersions = signal<HelpCenterTermsDto[]>([]);
  loadingTerms = signal(false);
  termsListPage = signal(1);

  termsModalOpen = false;
  savingTerms = false;
  editingTerms: HelpCenterTermsDto | null = null;
  termsForm = this.fb.nonNullable.group({
    version: ['', [Validators.required, Validators.maxLength(50)]],
    content: ['', richTextRequired()],
    effectiveDate: ['', Validators.required]
  });

  showDeleteTermsDialog = false;
  termsToDelete: HelpCenterTermsDto | null = null;

  ngOnInit(): void {
    this.loadTermsVersions();
    this.termsForm.statusChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    this.termsForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  badgePositive = adminBadgePositive;

  termsFieldInvalid(field: 'version' | 'content' | 'effectiveDate'): boolean {
    const c = this.termsForm.get(field);
    return !!c && c.invalid && c.touched;
  }

  termsFieldErrorKey(field: 'version' | 'content' | 'effectiveDate'): string | null {
    const c = this.termsForm.get(field);
    if (!c?.errors || !c.touched) return null;
    if (c.errors['maxlength']) return 'helpCenter.termsVersionMaxLength';
    return 'helpCenter.termsFieldRequired';
  }

  onTermsContentBlur(): void {
    this.termsForm.get('content')?.markAsTouched();
    this.cdr.markForCheck();
  }

  onTermsContentChanged(): void {
    this.cdr.markForCheck();
  }

  canCreate(): boolean {
    return this.auth.hasPermission('helpcenter.create');
  }
  canEdit(): boolean {
    return this.auth.hasPermission('helpcenter.edit');
  }
  canDelete(): boolean {
    return this.auth.hasPermission('helpcenter.delete');
  }

  loadTermsVersions(): void {
    this.loadingTerms.set(true);
    this.helpCenter
      .getAllTermsVersions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: rows => {
          this.termsVersions.set(rows);
          this.termsListPage.set(1);
          this.loadingTerms.set(false);
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.loadTermsError'));
          this.loadingTerms.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  openPublishTerms(): void {
    this.editingTerms = null;
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.termsForm.reset({
      version: '',
      content: '',
      effectiveDate: local
    });
    this.termsModalOpen = true;
    this.cdr.markForCheck();
  }

  openEditTerms(t: HelpCenterTermsDto): void {
    this.editingTerms = t;
    const d = new Date(t.effectiveDate);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    this.termsForm.reset({
      version: t.version,
      content: t.content,
      effectiveDate: local
    });
    this.termsModalOpen = true;
    this.cdr.markForCheck();
  }

  closeTermsModal(): void {
    this.termsModalOpen = false;
    this.editingTerms = null;
    this.cdr.markForCheck();
  }

  saveTerms(): void {
    if (this.termsForm.invalid) {
      this.termsForm.markAllAsTouched();
      return;
    }
    const v = this.termsForm.getRawValue();
    this.savingTerms = true;
    const effectiveDate = new Date(v.effectiveDate).toISOString();

    if (this.editingTerms) {
      this.helpCenter
        .updateTermsVersion(this.editingTerms.id, {
          version: v.version.trim(),
          content: v.content,
          effectiveDate
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toast.success(this.i18n.getTranslation('helpCenter.termsUpdated'));
            this.savingTerms = false;
            this.closeTermsModal();
            this.loadTermsVersions();
            this.cdr.markForCheck();
          },
          error: err => {
            this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.termsUpdateError'));
            this.savingTerms = false;
            this.cdr.markForCheck();
          }
        });
      return;
    }

    this.helpCenter
      .publishTermsVersion({
        version: v.version.trim(),
        content: v.content,
        effectiveDate
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.termsPublished'));
          this.savingTerms = false;
          this.closeTermsModal();
          this.loadTermsVersions();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.termsPublishError'));
          this.savingTerms = false;
          this.cdr.markForCheck();
        }
      });
  }

  activateTermsRow(t: HelpCenterTermsDto): void {
    this.helpCenter
      .activateTermsVersion(t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.termsActivated'));
          this.loadTermsVersions();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.termsActivateError'));
          this.cdr.markForCheck();
        }
      });
  }

  deactivateTermsRow(t: HelpCenterTermsDto): void {
    this.helpCenter
      .deactivateTermsVersion(t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.termsDeactivated'));
          this.loadTermsVersions();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.termsDeactivateError'));
          this.cdr.markForCheck();
        }
      });
  }

  confirmDeleteTerms(t: HelpCenterTermsDto): void {
    this.termsToDelete = t;
    this.showDeleteTermsDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteTermsConfirm(): void {
    const t = this.termsToDelete;
    this.showDeleteTermsDialog = false;
    this.termsToDelete = null;
    if (!t) return;
    this.helpCenter
      .deleteTermsVersion(t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.termsDeleted'));
          this.loadTermsVersions();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.termsDeleteError'));
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteTermsCancel(): void {
    this.showDeleteTermsDialog = false;
    this.termsToDelete = null;
    this.cdr.markForCheck();
  }

  termsTableTotalPages(): number {
    return adminTotalPages(this.termsVersions().length, this.rowsPerPage());
  }

  effectiveTermsPage(): number {
    return Math.min(Math.max(1, this.termsListPage()), this.termsTableTotalPages());
  }

  paginatedTermsVersions(): HelpCenterTermsDto[] {
    const items = this.termsVersions();
    const page = this.effectiveTermsPage();
    const size = this.rowsPerPage();
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  }

  onTermsPageChange(p: number): void {
    const t = this.termsTableTotalPages();
    this.termsListPage.set(Math.max(1, Math.min(p, t)));
    this.cdr.markForCheck();
  }

  onTermsRowsPerPageChange(size: number): void {
    this.rowsPerPage.set(size);
    this.termsListPage.set(1);
    this.cdr.markForCheck();
  }
}

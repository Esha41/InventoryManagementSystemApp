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
import {
  LucideAngularModule,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban
} from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { HelpCenterService } from '@services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { HelpCenterTermsDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { APP_CONSTANTS } from '@constants/app.constants';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { adminBadgePositive, adminTotalPages } from '../../help-center-admin.utils';

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
    AppDateTimePipe
  ],
  templateUrl: './help-center-terms-tab.component.html',
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

  readonly adminPageSize = APP_CONSTANTS.DEFAULT_PAGE_SIZE;
  termsVersions = signal<HelpCenterTermsDto[]>([]);
  loadingTerms = signal(false);
  termsListPage = signal(1);

  termsModalOpen = false;
  savingTerms = false;
  editingTerms: HelpCenterTermsDto | null = null;
  termsForm = this.fb.nonNullable.group({
    version: ['', Validators.required],
    content: ['', Validators.required],
    effectiveDate: ['', Validators.required]
  });

  showDeleteTermsDialog = false;
  termsToDelete: HelpCenterTermsDto | null = null;

  ngOnInit(): void {
    this.loadTermsVersions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  badgePositive = adminBadgePositive;
  totalPagesFor = adminTotalPages;

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

  effectiveTermsPage(): number {
    return Math.min(
      Math.max(1, this.termsListPage()),
      this.totalPagesFor(this.termsVersions().length)
    );
  }

  paginatedTermsVersions(): HelpCenterTermsDto[] {
    const items = this.termsVersions();
    const page = this.effectiveTermsPage();
    const start = (page - 1) * this.adminPageSize;
    return items.slice(start, start + this.adminPageSize);
  }

  onTermsPageChange(p: number): void {
    const t = this.totalPagesFor(this.termsVersions().length);
    this.termsListPage.set(Math.max(1, Math.min(p, t)));
    this.cdr.markForCheck();
  }
}

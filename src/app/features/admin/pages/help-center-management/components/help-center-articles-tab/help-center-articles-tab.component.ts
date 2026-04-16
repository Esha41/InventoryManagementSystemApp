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
  Pencil,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { HelpCenterService } from '@services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import {
  CreateHelpCenterArticleDto,
  HelpCenterArticleDto,
  UpdateHelpCenterArticleDto
} from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { APP_CONSTANTS } from '@constants/app.constants';
import { adminBadgePositive, adminTotalPages } from '../../help-center-admin.utils';

@Component({
  selector: 'app-help-center-articles-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ConfirmDialogComponent,
    ModalComponent,
    ButtonComponent,
    PaginationComponent
  ],
  templateUrl: './help-center-articles-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterArticlesTabComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(BackendAuthService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly Pencil = Pencil;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly AlertCircle = AlertCircle;

  readonly adminPageSize = APP_CONSTANTS.DEFAULT_PAGE_SIZE;
  articles = signal<HelpCenterArticleDto[]>([]);
  loadingArticles = signal(false);
  articlesListPage = signal(1);

  articleModalOpen = false;
  editingArticle: HelpCenterArticleDto | null = null;
  savingArticle = false;
  articleForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    content: ['', Validators.required],
    category: [''],
    isPublished: [true]
  });

  showDeleteArticleDialog = false;
  articleToDelete: HelpCenterArticleDto | null = null;

  ngOnInit(): void {
    this.loadArticles();
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

  loadArticles(): void {
    this.loadingArticles.set(true);
    this.helpCenter
      .getAllArticles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: rows => {
          this.articles.set(rows);
          this.articlesListPage.set(1);
          this.loadingArticles.set(false);
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.loadArticlesError'));
          this.loadingArticles.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  openCreateArticle(): void {
    this.editingArticle = null;
    this.articleForm.reset({
      title: '',
      content: '',
      category: '',
      isPublished: true
    });
    this.articleModalOpen = true;
    this.cdr.markForCheck();
  }

  openEditArticle(a: HelpCenterArticleDto): void {
    this.editingArticle = a;
    this.articleForm.patchValue({
      title: a.title,
      content: a.content,
      category: a.category ?? '',
      isPublished: a.isPublished
    });
    this.articleModalOpen = true;
    this.cdr.markForCheck();
  }

  closeArticleModal(): void {
    this.articleModalOpen = false;
    this.editingArticle = null;
    this.cdr.markForCheck();
  }

  saveArticle(): void {
    if (this.articleForm.invalid) {
      this.articleForm.markAllAsTouched();
      return;
    }
    const v = this.articleForm.getRawValue();
    this.savingArticle = true;
    if (this.editingArticle) {
      const dto: UpdateHelpCenterArticleDto = {
        title: v.title.trim(),
        content: v.content,
        category: v.category?.trim() || null,
        isPublished: v.isPublished
      };
      this.helpCenter
        .updateArticle(this.editingArticle.id, dto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toast.success(this.i18n.getTranslation('helpCenter.articleUpdated'));
            this.savingArticle = false;
            this.closeArticleModal();
            this.loadArticles();
            this.cdr.markForCheck();
          },
          error: err => {
            this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.articleSaveError'));
            this.savingArticle = false;
            this.cdr.markForCheck();
          }
        });
    } else {
      const dto: CreateHelpCenterArticleDto = {
        title: v.title.trim(),
        content: v.content,
        category: v.category?.trim() || null,
        isPublished: v.isPublished
      };
      this.helpCenter
        .createArticle(dto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toast.success(this.i18n.getTranslation('helpCenter.articleCreated'));
            this.savingArticle = false;
            this.closeArticleModal();
            this.loadArticles();
            this.cdr.markForCheck();
          },
          error: err => {
            this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.articleSaveError'));
            this.savingArticle = false;
            this.cdr.markForCheck();
          }
        });
    }
  }

  confirmDeleteArticle(a: HelpCenterArticleDto): void {
    this.articleToDelete = a;
    this.showDeleteArticleDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteArticleConfirm(): void {
    const a = this.articleToDelete;
    this.showDeleteArticleDialog = false;
    this.articleToDelete = null;
    if (!a) return;
    this.helpCenter
      .deleteArticle(a.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.articleDeleted'));
          this.loadArticles();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.articleDeleteError'));
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteArticleCancel(): void {
    this.showDeleteArticleDialog = false;
    this.articleToDelete = null;
    this.cdr.markForCheck();
  }

  effectiveArticlesPage(): number {
    return Math.min(
      Math.max(1, this.articlesListPage()),
      this.totalPagesFor(this.articles().length)
    );
  }

  paginatedArticles(): HelpCenterArticleDto[] {
    const items = this.articles();
    const page = this.effectiveArticlesPage();
    const start = (page - 1) * this.adminPageSize;
    return items.slice(start, start + this.adminPageSize);
  }

  onArticlesPageChange(p: number): void {
    const t = this.totalPagesFor(this.articles().length);
    this.articlesListPage.set(Math.max(1, Math.min(p, t)));
    this.cdr.markForCheck();
  }
}

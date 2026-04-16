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
import { CardComponent } from '@components/card/card.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { APP_CONSTANTS, defaultPageSize } from '@constants/app.constants';
import { adminBadgePositive, adminTotalPages } from '../../help-center-admin.utils';
import { HELP_CENTER_ARTICLES_QUILL_MODULES } from '../../help-center-terms-quill.config';
import { richTextRequired } from '@core/validators/rich-text-required.validator';

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
    PaginationComponent,
    CardComponent,
    RowsPerPageComponent,
    QuillEditorComponent
  ],
  templateUrl: './help-center-articles-tab.component.html',
  styleUrls: ['../../help-center-quill-full-width.css'],
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

  readonly articlesQuillModules = HELP_CENTER_ARTICLES_QUILL_MODULES;
  readonly articlesEditorStyles = { minHeight: '280px' };

  readonly pageSizeOptions = [...APP_CONSTANTS.PAGE_SIZE_OPTIONS];
  rowsPerPage = signal(defaultPageSize);
  articles = signal<HelpCenterArticleDto[]>([]);
  loadingArticles = signal(false);
  articlesListPage = signal(1);

  articleModalOpen = false;
  editingArticle: HelpCenterArticleDto | null = null;
  savingArticle = false;
  articleForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    content: ['', richTextRequired()],
    category: [''],
    isPublished: [true]
  });

  showDeleteArticleDialog = false;
  articleToDelete: HelpCenterArticleDto | null = null;

  ngOnInit(): void {
    this.loadArticles();
    this.articleForm.statusChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    this.articleForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  badgePositive = adminBadgePositive;

  canCreate(): boolean {
    return this.auth.hasPermission('helpcenter.create');
  }
  canEdit(): boolean {
    return this.auth.hasPermission('helpcenter.edit');
  }
  canDelete(): boolean {
    return this.auth.hasPermission('helpcenter.delete');
  }

  articleContentInvalid(): boolean {
    const c = this.articleForm.get('content');
    return !!c && c.invalid && c.touched;
  }

  onArticleContentBlur(): void {
    this.articleForm.get('content')?.markAsTouched();
    this.cdr.markForCheck();
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

  articleTotalPages(): number {
    return adminTotalPages(this.articles().length, this.rowsPerPage());
  }

  effectiveArticlesPage(): number {
    return Math.min(Math.max(1, this.articlesListPage()), this.articleTotalPages());
  }

  paginatedArticles(): HelpCenterArticleDto[] {
    const items = this.articles();
    const page = this.effectiveArticlesPage();
    const size = this.rowsPerPage();
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  }

  onArticlesPageChange(p: number): void {
    const t = this.articleTotalPages();
    this.articlesListPage.set(Math.max(1, Math.min(p, t)));
    this.cdr.markForCheck();
  }

  onArticlesRowsPerPageChange(size: number): void {
    this.rowsPerPage.set(size);
    this.articlesListPage.set(1);
    this.cdr.markForCheck();
  }
}

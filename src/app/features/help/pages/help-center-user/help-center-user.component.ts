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
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import {
  LucideAngularModule,
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  LifeBuoy,
  Mail,
  Phone,
  Send
} from 'lucide-angular';
import { Subject, catchError, of, take, takeUntil } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { HelpCenterService } from '@help-center/services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import {
  HelpCenterArticleDto,
  HelpCenterContactDisplayDto,
  HelpCenterTermsDto
} from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { CardComponent } from '@components/card/card.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { APP_CONSTANTS, defaultPageSize } from '@constants/app.constants';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { HelpCenterHtmlSanitizerService } from '@help-center/services/help-center-html-sanitizer.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { getLocalizedName } from '@utils/localization.utils';
import type { Localizable } from '@utils/localization.utils';
import { splitRichHtmlIntoPages } from './help-center-rich-html-pages';
import { FileUploadDto } from '@models/file-upload.model';
import { FileUploadService } from '@services/file-upload.service';
import {
  HELPCENTER_USER_MANUAL_ENTITY,
  HELPCENTER_USER_MANUAL_ENTITY_ID
} from '@constants/help-center-manual.constants';

type UserTab = 'articles' | 'terms' | 'manual' | 'contact';
type ArticlesViewMode = 'grid' | 'reading';

@Component({
  selector: 'app-help-center-user',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    PaginationComponent,
    CardComponent,
    RowsPerPageComponent,
    AppDatePipe
  ],
  templateUrl: './help-center-user.component.html',
  styleUrls: ['./help-center-user.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterUserComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly fileUpload = inject(FileUploadService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly fb = inject(FormBuilder);
  private readonly htmlSanitizer = inject(HelpCenterHtmlSanitizerService);
  private readonly auth = inject(BackendAuthService);
  private readonly userContext = inject(UserContextService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly ArrowLeft = ArrowLeft;
  readonly BookOpen = BookOpen;
  readonly Download = Download;
  readonly FileText = FileText;
  readonly LifeBuoy = LifeBuoy;
  readonly Mail = Mail;
  readonly Phone = Phone;
  readonly Send = Send;

  /** Segmented tab Tailwind classes */
  tabClasses(isActive: boolean): string {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg border-0 px-4 py-2 text-sm font-semibold cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]';
    const active =
      'bg-[var(--color-brand)] text-white shadow-sm hover:bg-[var(--color-brand-dark)] hover:text-white';
    const inactive =
      'bg-transparent text-[color-mix(in_srgb,var(--color-text)_72%,var(--color-background)_28%)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]';
    return `${base} ${isActive ? active : inactive}`;
  }

  activeTab = signal<UserTab>('articles');
  /** Articles: card grid vs full-page reader (no split sidebar). */
  articlesView = signal<ArticlesViewMode>('grid');
  articles = signal<HelpCenterArticleDto[]>([]);
  terms = signal<HelpCenterTermsDto | null>(null);
  termsHtmlPages = signal<string[]>([]);
  termsContentPage = signal(1);
  loadingArticles = signal(false);
  loadingTerms = signal(false);
  loadingContactDisplay = signal(false);
  contactDisplay = signal<HelpCenterContactDisplayDto | null>(null);
  submittingContact = signal(false);

  /** Category filter: null = all */
  readonly categoryFilter = new FormControl<string | null>(null);
  categoryOptions = signal<DropdownOption<string | null>[]>([]);

  selectedArticleId = signal<number | null>(null);

  /** Client-side pagination for article grid (same controls as admin tables). */
  readonly pageSizeOptions = [...APP_CONSTANTS.PAGE_SIZE_OPTIONS];
  rowsPerPage = signal(defaultPageSize);
  articlePage = signal(1);
  readingArticleHtmlPages = signal<string[]>([]);
  readingArticleContentPage = signal(1);

  manualFiles = signal<FileUploadDto[]>([]);
  loadingManual = signal(false);

  contactForm = this.fb.nonNullable.group({
    senderName: ['', [Validators.required, Validators.maxLength(150)]],
    senderEmail: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    subject: ['', [Validators.required, Validators.maxLength(300)]],
    body: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.categoryFilter.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.articlePage.set(1);
      const filtered = this.filteredArticles();
      const cur = this.selectedArticleId();
      if (this.articlesView() === 'reading' && cur !== null && !filtered.some(a => a.id === cur)) {
        this.articlesView.set('grid');
        this.selectedArticleId.set(null);
      }
      this.cdr.markForCheck();
    });
    this.loadArticles();
    this.loadTerms();
    this.loadUserManuals();
    this.loadContactDisplay();
    this.prefillContactFromLoggedInUser();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: UserTab): void {
    if (this.activeTab() === 'articles' && tab !== 'articles') {
      this.articlesView.set('grid');
    }
    this.activeTab.set(tab);
    if (tab === 'manual') {
      this.loadUserManuals();
    }
  }

  openArticleReading(id: number): void {
    this.selectedArticleId.set(id);
    this.articlesView.set('reading');
    const art = this.filteredArticles().find(a => a.id === id);
    this.readingArticleHtmlPages.set(splitRichHtmlIntoPages(art?.content));
    this.readingArticleContentPage.set(1);
    this.cdr.markForCheck();
  }

  backToArticleGrid(): void {
    this.articlesView.set('grid');
    this.selectedArticleId.set(null);
    this.readingArticleHtmlPages.set([]);
    this.readingArticleContentPage.set(1);
    this.cdr.markForCheck();
  }

  /** Plain-text preview for cards (strip HTML). */
  articleCardPreview(html: string | null | undefined, maxLen = 120): string {
    const raw = html ?? '';
    const text = raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '';
    if (text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
  }

  loadArticles(): void {
    this.loadingArticles.set(true);
    this.helpCenter
      .getPublishedArticles()
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          const msg = ErrorHandler.extractErrorMessage(err, 'helpCenter.loadArticlesError');
          this.toast.error(msg);
          return of([] as HelpCenterArticleDto[]);
        })
      )
      .subscribe(list => {
        this.articles.set(list);
        this.articlePage.set(1);
        this.buildCategoryOptions(list);
        if (!list.length) {
          this.selectedArticleId.set(null);
          this.articlesView.set('grid');
        }
        this.loadingArticles.set(false);
        this.cdr.markForCheck();
      });
  }

  private buildCategoryOptions(list: HelpCenterArticleDto[]): void {
    const cats = new Set<string>();
    for (const a of list) {
      const c = (a.category ?? '').trim();
      if (c) cats.add(c);
    }
    const sorted = [...cats].sort((a, b) => a.localeCompare(b));
    const opts: DropdownOption<string | null>[] = [
      { label: this.i18n.getTranslation('helpCenter.allCategories'), value: null },
      ...sorted.map(c => ({ label: c, value: c }))
    ];
    this.categoryOptions.set(opts);
  }

  filteredArticles(): HelpCenterArticleDto[] {
    const cat = this.categoryFilter.value;
    const all = this.articles();
    if (!cat) return all;
    return all.filter(a => (a.category ?? '').trim() === cat);
  }

  totalArticlePages(): number {
    const n = this.filteredArticles().length;
    const size = Math.max(1, this.rowsPerPage());
    return Math.max(1, Math.ceil(n / size));
  }

  /** Clamped page for display when the list shrinks. */
  effectiveArticlePage(): number {
    return Math.min(Math.max(1, this.articlePage()), this.totalArticlePages());
  }

  paginatedArticles(): HelpCenterArticleDto[] {
    const all = this.filteredArticles();
    const page = this.effectiveArticlePage();
    const size = Math.max(1, this.rowsPerPage());
    const start = (page - 1) * size;
    return all.slice(start, start + size);
  }

  onArticlePageChange(page: number): void {
    const total = this.totalArticlePages();
    const next = Math.max(1, Math.min(page, total));
    this.articlePage.set(next);
    this.cdr.markForCheck();
  }

  onArticleRowsPerPageChange(size: number): void {
    this.rowsPerPage.set(size);
    this.articlePage.set(1);
    this.cdr.markForCheck();
  }

  selectedArticle(): HelpCenterArticleDto | null {
    const id = this.selectedArticleId();
    if (id === null) return null;
    return this.filteredArticles().find(a => a.id === id) ?? null;
  }

  safeArticleHtml(content: string): SafeHtml {
    return this.htmlSanitizer.sanitizeRichHtml(content);
  }

  safeTermsHtml(content: string): SafeHtml {
    return this.htmlSanitizer.sanitizeRichHtml(content);
  }

  termsBodyForCurrentPage(): string {
    const pages = this.termsHtmlPages();
    if (!pages.length) {
      return '';
    }
    const idx = Math.min(
      Math.max(1, this.effectiveTermsContentPage()) - 1,
      pages.length - 1
    );
    return pages[idx] ?? '';
  }

  effectiveTermsContentPage(): number {
    const n = this.termsHtmlPages().length;
    if (n <= 0) {
      return 1;
    }
    return Math.min(Math.max(1, this.termsContentPage()), n);
  }

  onTermsContentPageChange(page: number): void {
    const n = this.termsHtmlPages().length;
    if (n <= 0) {
      return;
    }
    this.termsContentPage.set(Math.min(Math.max(1, page), n));
    this.cdr.markForCheck();
  }

  readingArticleBodyForCurrentPage(): string {
    const pages = this.readingArticleHtmlPages();
    if (!pages.length) {
      return '';
    }
    const idx = Math.min(
      Math.max(1, this.effectiveReadingArticleContentPage()) - 1,
      pages.length - 1
    );
    return pages[idx] ?? '';
  }

  effectiveReadingArticleContentPage(): number {
    const n = this.readingArticleHtmlPages().length;
    if (n <= 0) {
      return 1;
    }
    return Math.min(Math.max(1, this.readingArticleContentPage()), n);
  }

  onReadingArticleContentPageChange(page: number): void {
    const n = this.readingArticleHtmlPages().length;
    if (n <= 0) {
      return;
    }
    this.readingArticleContentPage.set(Math.min(Math.max(1, page), n));
    this.cdr.markForCheck();
  }

  loadContactDisplay(): void {
    this.loadingContactDisplay.set(true);
    this.helpCenter
      .getContactDisplaySettings()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.contactDisplay.set(null);
          return of(null as HelpCenterContactDisplayDto | null);
        })
      )
      .subscribe(row => {
        this.contactDisplay.set(row);
        this.loadingContactDisplay.set(false);
        this.cdr.markForCheck();
      });
  }

  hasContactChannels(): boolean {
    const c = this.contactDisplay();
    if (!c) return false;
    return !!(c.supportEmail?.trim() || c.supportPhone?.trim());
  }

  /** Pre-fills name and email from profile API (fallback: token user). */
  private prefillContactFromLoggedInUser(): void {
    const authUser = this.auth.getCurrentUser();
    if (!authUser) {
      return;
    }

    this.userContext
      .getCurrentUserDetails(false)
      .pipe(takeUntil(this.destroy$), take(1))
      .subscribe(details => {
        const lang = this.i18n.getCurrentLanguage();
        const forName = (details ?? authUser) as Localizable;
        let senderName = getLocalizedName(forName, lang).trim();
        if (!senderName) {
          senderName = (details?.userName ?? authUser.userName ?? '').trim();
        }
        const senderEmail = (details?.email ?? authUser.email ?? '').trim();
        if (!senderName && !senderEmail) {
          return;
        }
        this.contactForm.patchValue({ senderName, senderEmail });
        this.cdr.markForCheck();
      });
  }

  loadUserManuals(): void {
    this.loadingManual.set(true);
    this.fileUpload
      .getFilesByEntity(HELPCENTER_USER_MANUAL_ENTITY, HELPCENTER_USER_MANUAL_ENTITY_ID)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.manualLoadError'));
          return of([] as FileUploadDto[]);
        }),
        finalize(() => {
          this.loadingManual.set(false);
          this.cdr.markForCheck();
        })
      )
      .subscribe(list => {
        const sorted = [...list].sort((a, b) =>
          (a.originalName || a.fileName || '').localeCompare(b.originalName || b.fileName || '', undefined, {
            sensitivity: 'base'
          })
        );
        this.manualFiles.set(sorted);
      });
  }

  downloadManual(f: FileUploadDto): void {
    this.fileUpload
      .getFileBlob(f.id)
      .pipe(takeUntil(this.destroy$), take(1))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = f.originalName || f.fileName || 'download';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.manualDownloadError'));
          this.cdr.markForCheck();
        }
      });
  }

  loadTerms(): void {
    this.loadingTerms.set(true);
    this.helpCenter
      .getActiveTerms()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.terms.set(null);
          return of(null as HelpCenterTermsDto | null);
        })
      )
      .subscribe(t => {
        this.terms.set(t);
        if (t?.content != null) {
          this.termsHtmlPages.set(splitRichHtmlIntoPages(t.content));
          this.termsContentPage.set(1);
        } else {
          this.termsHtmlPages.set([]);
        }
        this.loadingTerms.set(false);
        this.cdr.markForCheck();
      });
  }

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.toast.error(this.i18n.getTranslation('helpCenter.contactValidation'));
      return;
    }
    this.submittingContact.set(true);
    const v = this.contactForm.getRawValue();
    this.helpCenter
      .submitContactMessage({
        senderName: v.senderName.trim(),
        senderEmail: v.senderEmail.trim(),
        subject: v.subject.trim(),
        body: v.body.trim()
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.contactSuccess'));
          this.contactForm.reset();
          this.prefillContactFromLoggedInUser();
          this.submittingContact.set(false);
          this.cdr.markForCheck();
        },
        error: err => {
          const msg = ErrorHandler.extractErrorMessage(err, 'helpCenter.contactError');
          this.toast.error(msg);
          this.submittingContact.set(false);
          this.cdr.markForCheck();
        }
      });
  }
}

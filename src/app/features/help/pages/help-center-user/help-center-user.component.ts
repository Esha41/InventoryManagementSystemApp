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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, BookOpen, FileText, LifeBuoy, Mail, Send } from 'lucide-angular';
import { Subject, catchError, of, takeUntil } from 'rxjs';

import { HelpCenterService } from '@services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { HelpCenterArticleDto, HelpCenterTermsDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { APP_CONSTANTS } from '@constants/app.constants';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

type UserTab = 'articles' | 'terms' | 'contact';

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
    AppDatePipe
  ],
  templateUrl: './help-center-user.component.html',
  styleUrls: ['./help-center-user.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterUserComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly BookOpen = BookOpen;
  readonly FileText = FileText;
  readonly LifeBuoy = LifeBuoy;
  readonly Mail = Mail;
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

  articleListItemClasses(isActive: boolean): string {
    const base =
      'flex w-full cursor-pointer flex-col items-start gap-1 border-0 border-b border-[var(--color-border)] bg-transparent px-4 py-3 text-start text-[var(--color-text)] transition-colors last:border-b-0 hover:bg-[var(--color-background-hover)]';
    const active = 'border-s-[3px] border-s-[var(--color-brand)] bg-[var(--color-background-soft)]';
    return `${base} ${isActive ? active : ''}`;
  }

  activeTab = signal<UserTab>('articles');
  articles = signal<HelpCenterArticleDto[]>([]);
  terms = signal<HelpCenterTermsDto | null>(null);
  loadingArticles = signal(false);
  loadingTerms = signal(false);
  submittingContact = signal(false);

  /** Category filter: null = all */
  readonly categoryFilter = new FormControl<string | null>(null);
  categoryOptions = signal<DropdownOption<string | null>[]>([]);

  selectedArticleId = signal<number | null>(null);

  /** Client-side pagination for article list (sidebar) */
  readonly pageSize = APP_CONSTANTS.DEFAULT_PAGE_SIZE;
  articlePage = signal(1);

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
      if (cur !== null && !filtered.some(a => a.id === cur)) {
        this.selectedArticleId.set(filtered.length ? filtered[0].id : null);
      }
      this.syncSelectionToPage();
      this.cdr.markForCheck();
    });
    this.loadArticles();
    this.loadTerms();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: UserTab): void {
    this.activeTab.set(tab);
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
        if (list.length && this.selectedArticleId() === null) {
          this.selectedArticleId.set(list[0].id);
        }
        this.syncSelectionToPage();
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
    return Math.max(1, Math.ceil(n / this.pageSize));
  }

  /** Clamped page for display when the list shrinks. */
  effectiveArticlePage(): number {
    return Math.min(Math.max(1, this.articlePage()), this.totalArticlePages());
  }

  paginatedArticles(): HelpCenterArticleDto[] {
    const all = this.filteredArticles();
    const page = this.effectiveArticlePage();
    const start = (page - 1) * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  onArticlePageChange(page: number): void {
    const total = this.totalArticlePages();
    const next = Math.max(1, Math.min(page, total));
    this.articlePage.set(next);
    this.syncSelectionToPage();
    this.cdr.markForCheck();
  }

  /** If the selected article is not on the current page, select the first item on this page. */
  private syncSelectionToPage(): void {
    const items = this.paginatedArticles();
    const cur = this.selectedArticleId();
    if (items.length === 0) {
      this.selectedArticleId.set(null);
      return;
    }
    if (cur === null || !items.some(a => a.id === cur)) {
      this.selectedArticleId.set(items[0].id);
    }
  }

  selectArticle(id: number): void {
    this.selectedArticleId.set(id);
  }

  selectedArticle(): HelpCenterArticleDto | null {
    const id = this.selectedArticleId();
    if (id === null) return null;
    return this.filteredArticles().find(a => a.id === id) ?? null;
  }

  safeArticleHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }

  safeTermsHtml(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
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

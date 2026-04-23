import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  LucideAngularModule,
  HelpCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Download,
  BookOpen,
} from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { HelpCenterService } from '@help-center/services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { HelpCenterArticleDto, HelpCenterTermsDto } from '@models/help-center.model';

@Component({
  selector: 'app-help-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './help-center.component.html',
  styleUrls: ['../../help-center-pages.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpCenterComponent implements OnInit, OnDestroy {
  private readonly helpService = inject(HelpCenterService);
  private readonly toastService = inject(ToastService);
  private readonly translationService = inject(TranslationService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly HelpCircle = HelpCircle;
  readonly Mail = Mail;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly FileText = FileText;
  readonly Send = Send;
  readonly Download = Download;
  readonly BookOpen = BookOpen;

  articles = signal<HelpCenterArticleDto[]>([]);
  activeTerms = signal<HelpCenterTermsDto | null>(null);
  loading = signal(false);
  submitting = signal(false);
  expandedArticles = new Set<number>();
  contactForm!: FormGroup;

  /** Group articles by category */
  get articlesByCategory(): Record<string, HelpCenterArticleDto[]> {
    const grouped: Record<string, HelpCenterArticleDto[]> = {};
    for (const article of this.articles()) {
      const key = article.category ?? 'General';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(article);
    }
    return grouped;
  }

  get categoryKeys(): string[] {
    return Object.keys(this.articlesByCategory);
  }

  ngOnInit(): void {
    this.initContactForm();
    this.loadArticles();
    this.loadTerms();
  }

  private initContactForm(): void {
    this.contactForm = this.fb.group({
      senderName: ['', [Validators.required, Validators.maxLength(150)]],
      senderEmail: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
      subject: ['', [Validators.required, Validators.maxLength(300)]],
      body: ['', [Validators.required, Validators.maxLength(2000)]],
    });
  }

  private loadArticles(): void {
    this.loading.set(true);
    this.cdr.markForCheck();

    this.helpService.getPublishedArticles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.articles.set(list ?? []);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to load help articles'));
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  private loadTerms(): void {
    this.helpService.getActiveTerms()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (terms) => {
          this.activeTerms.set(terms ?? null);
          this.cdr.markForCheck();
        },
        error: () => { /* terms absence is non-critical */ },
      });
  }

  toggleArticle(id: number): void {
    if (this.expandedArticles.has(id)) {
      this.expandedArticles.delete(id);
    } else {
      this.expandedArticles.add(id);
    }
    this.cdr.markForCheck();
  }

  isExpanded(id: number): boolean {
    return this.expandedArticles.has(id);
  }

  onContactSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.cdr.markForCheck();

    this.helpService.submitContactMessage(this.contactForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success(
            this.translationService.getTranslation('helpCenter.contact.successMessage')
          );
          this.contactForm.reset();
          this.submitting.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.toastService.error(ErrorHandler.extractErrorMessage(err, 'Failed to send message'));
          this.submitting.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

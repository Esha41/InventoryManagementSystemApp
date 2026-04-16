import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, switchMap, map } from 'rxjs/operators';
import { HelpCenterService } from '@services/help-center.service';
import { FileUploadService } from '@services/file-upload.service';
import { ConfigService } from '@services/config.service';
import { FileEntityType, FileUploadDto } from '@models/file-upload.model';
import { HelpCenterArticleDto, SubmitContactMessageDto } from '@models/help-center.model';
import { HELP_ME_ARTICLE_CATEGORY } from '@constants/help-me.constants';

export interface HelpMeLandingState {
  article: HelpCenterArticleDto | null;
  files: FileUploadDto[];
  loading: boolean;
  error: string | null;
}

@Injectable()
export class HelpMeUserFacade {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly fileUpload = inject(FileUploadService);
  private readonly config = inject(ConfigService);

  private readonly state$ = new BehaviorSubject<HelpMeLandingState>({
    article: null,
    files: [],
    loading: true,
    error: null
  });

  readonly landing$ = this.state$.asObservable();

  /** Resolves Help Me landing article from published list or optional runtime id. */
  static resolveLandingArticle(
    articles: HelpCenterArticleDto[],
    helpMeArticleId?: number
  ): HelpCenterArticleDto | null {
    if (helpMeArticleId != null) {
      const hit = articles.find(a => a.id === helpMeArticleId);
      if (hit) return hit;
    }
    const cat = HELP_ME_ARTICLE_CATEGORY.toLowerCase();
    const byCategory = articles.find(a => (a.category || '').trim().toLowerCase() === cat);
    return byCategory ?? (articles.length ? articles[0] : null);
  }

  loadLanding(): void {
    this.patch({ loading: true, error: null });
    const pinnedId = this.config.helpMeArticleId;
    this.helpCenter
      .getPublishedArticles()
      .pipe(
        switchMap(articles => {
          const article = HelpMeUserFacade.resolveLandingArticle(articles, pinnedId);
          if (!article) {
            return of({ article: null as HelpCenterArticleDto | null, files: [] as FileUploadDto[] });
          }
          return this.fileUpload.getFilesByEntity(FileEntityType.HelpCenter, article.id).pipe(
            map(files => ({ article, files: files ?? [] })),
            catchError(() => of({ article, files: [] as FileUploadDto[] }))
          );
        }),
        finalize(() => {
          const s = this.state$.value;
          if (s.loading) {
            this.patch({ loading: false });
          }
        })
      )
      .subscribe({
        next: ({ article, files }) => {
          this.patch({ article, files, loading: false, error: null });
        },
        error: err => {
          const msg = typeof err?.message === 'string' ? err.message : 'helpMe.loadError';
          this.patch({ loading: false, error: msg, article: null, files: [] });
        }
      });
  }

  submitContact(dto: SubmitContactMessageDto): Observable<boolean> {
    return this.helpCenter.submitContactMessage(dto);
  }

  private patch(p: Partial<HelpMeLandingState>): void {
    this.state$.next({ ...this.state$.value, ...p });
  }
}

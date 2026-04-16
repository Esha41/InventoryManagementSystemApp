import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { HelpCenterService } from '@services/help-center.service';
import { FileUploadService } from '@services/file-upload.service';
import { ConfigService } from '@services/config.service';
import { FileEntityType, FileUploadDto } from '@models/file-upload.model';
import {
  CreateHelpCenterArticleDto,
  HelpCenterArticleDto,
  UpdateHelpCenterArticleDto
} from '@models/help-center.model';
import { HELP_ME_ARTICLE_CATEGORY } from '@constants/help-me.constants';
import { HelpMeUserFacade } from '@features/help-me-user/facades/help-me-user.facade';

export interface HelpMeAdminState {
  article: HelpCenterArticleDto | null;
  files: FileUploadDto[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

@Injectable()
export class HelpMeAdminFacade {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly fileUpload = inject(FileUploadService);
  private readonly config = inject(ConfigService);

  private readonly state$ = new BehaviorSubject<HelpMeAdminState>({
    article: null,
    files: [],
    loading: true,
    saving: false,
    error: null
  });

  readonly state$obs = this.state$.asObservable();

  load(): void {
    this.patch({ loading: true, error: null });
    const pinnedId = this.config.helpMeArticleId;
    this.helpCenter
      .getAllArticles()
      .pipe(
        switchMap(articles => {
          let article = HelpMeUserFacade.resolveLandingArticle(articles, pinnedId);
          if (!article) {
            return of({ article: null as HelpCenterArticleDto | null, files: [] as FileUploadDto[] });
          }
          return this.fileUpload.getFilesByEntity(FileEntityType.HelpCenter, article.id).pipe(
            map(files => ({ article, files: files ?? [] })),
            catchError(() => of({ article, files: [] as FileUploadDto[] }))
          );
        }),
        catchError(() => {
          this.patch({ loading: false, error: 'helpMe.admin.loadError', article: null, files: [] });
          return of(null);
        })
      )
      .subscribe(res => {
        if (!res) return;
        this.patch({
          article: res.article,
          files: res.files,
          loading: false,
          error: null
        });
      });
  }

  createLandingArticle(dto: CreateHelpCenterArticleDto): Observable<HelpCenterArticleDto> {
    this.patch({ saving: true, error: null });
    return this.helpCenter.createArticle(dto).pipe(
      tap(a => {
        this.patch({ article: a, saving: false });
        this.refreshFiles(a.id);
      }),
      catchError(err => {
        this.patch({ saving: false, error: 'helpMe.admin.saveError' });
        return throwError(() => err);
      })
    );
  }

  updateLandingArticle(id: number, dto: UpdateHelpCenterArticleDto): Observable<HelpCenterArticleDto> {
    this.patch({ saving: true, error: null });
    return this.helpCenter.updateArticle(id, dto).pipe(
      tap(a => this.patch({ article: a, saving: false })),
      catchError(err => {
        this.patch({ saving: false, error: 'helpMe.admin.saveError' });
        return throwError(() => err);
      })
    );
  }

  uploadFiles(articleId: number, files: File[]): Observable<number[]> {
    if (!files.length) return of([]);
    return this.fileUpload.uploadFilesForEntity(files, FileEntityType.HelpCenter, articleId);
  }

  deleteFile(fileId: number): Observable<boolean> {
    return this.fileUpload.deleteFile(fileId).pipe(
      switchMap(() => {
        const a = this.state$.value.article;
        if (a) this.refreshFiles(a.id);
        return of(true);
      })
    );
  }

  refreshFiles(articleId: number): void {
    this.fileUpload
      .getFilesByEntity(FileEntityType.HelpCenter, articleId)
      .pipe(catchError(() => of([])))
      .subscribe(files => this.patch({ files }));
  }

  get defaultCreateDto(): CreateHelpCenterArticleDto {
    return {
      title: '',
      content: '',
      category: HELP_ME_ARTICLE_CATEGORY,
      sortOrder: 0,
      isPublished: true
    };
  }

  private patch(p: Partial<HelpMeAdminState>): void {
    this.state$.next({ ...this.state$.value, ...p });
  }
}

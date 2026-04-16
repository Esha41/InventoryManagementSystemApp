import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import {
  CreateHelpCenterArticleDto,
  HelpCenterArticleDto,
  HelpCenterContactMessageDto,
  HelpCenterTermsDto,
  ReplyContactMessageDto,
  SubmitContactMessageDto,
  UpdateHelpCenterArticleDto,
  UpdateHelpCenterTermsDto,
  UpsertHelpCenterTermsDto,
  TermsAcceptanceStatusDto
} from '@models/help-center.model';

/**
 * HTTP client for Help Center API (`api/HelpCenter`).
 * See backend HelpCenterController for available routes.
 */
@Injectable({
  providedIn: 'root'
})
export class HelpCenterService {
  private readonly api = inject(ApiService);
  private readonly ep = API_ENDPOINTS.HELP_CENTER;

  // ── Articles ─────────────────────────────────────────────────────────────

  getPublishedArticles(): Observable<HelpCenterArticleDto[]> {
    return this.api.get<HelpCenterArticleDto[]>(this.ep.ARTICLES);
  }

  getArticleById(id: number): Observable<HelpCenterArticleDto> {
    return this.api.get<HelpCenterArticleDto>(this.ep.ARTICLE_BY_ID(id));
  }

  getAllArticles(): Observable<HelpCenterArticleDto[]> {
    return this.api.get<HelpCenterArticleDto[]>(this.ep.ARTICLES_ALL);
  }

  createArticle(dto: CreateHelpCenterArticleDto): Observable<HelpCenterArticleDto> {
    return this.api.post<HelpCenterArticleDto>(this.ep.ARTICLES, dto);
  }

  updateArticle(id: number, dto: UpdateHelpCenterArticleDto): Observable<HelpCenterArticleDto> {
    return this.api.put<HelpCenterArticleDto>(this.ep.ARTICLE_BY_ID(id), dto);
  }

  deleteArticle(id: number): Observable<boolean> {
    return this.api.delete<boolean>(this.ep.ARTICLE_BY_ID(id));
  }

  // ── Contact ───────────────────────────────────────────────────────────────

  submitContactMessage(dto: SubmitContactMessageDto): Observable<boolean> {
    return this.api.post<boolean>(this.ep.CONTACT, dto);
  }

  getAllContactMessages(): Observable<HelpCenterContactMessageDto[]> {
    return this.api.get<HelpCenterContactMessageDto[]>(this.ep.CONTACT);
  }

  getContactMessageById(id: number): Observable<HelpCenterContactMessageDto> {
    return this.api.get<HelpCenterContactMessageDto>(this.ep.CONTACT_BY_ID(id));
  }

  replyToContactMessage(id: number, dto: ReplyContactMessageDto): Observable<boolean> {
    return this.api.post<boolean>(this.ep.CONTACT_REPLY(id), dto);
  }

  deleteContactMessage(id: number): Observable<boolean> {
    return this.api.delete<boolean>(this.ep.CONTACT_BY_ID(id));
  }

  // ── Terms ─────────────────────────────────────────────────────────────────

  getActiveTerms(): Observable<HelpCenterTermsDto> {
    return this.api.get<HelpCenterTermsDto>(this.ep.TERMS);
  }

  getAllTermsVersions(): Observable<HelpCenterTermsDto[]> {
    return this.api.get<HelpCenterTermsDto[]>(this.ep.TERMS_ALL);
  }

  publishTermsVersion(dto: UpsertHelpCenterTermsDto): Observable<HelpCenterTermsDto> {
    return this.api.post<HelpCenterTermsDto>(this.ep.TERMS, dto);
  }

  /** If your API exposes PUT on a terms row */
  updateTermsVersion(id: number, dto: UpdateHelpCenterTermsDto): Observable<HelpCenterTermsDto> {
    return this.api.put<HelpCenterTermsDto>(this.ep.TERMS_BY_ID(id), dto);
  }

  activateTermsVersion(id: number): Observable<HelpCenterTermsDto> {
    return this.api.post<HelpCenterTermsDto>(this.ep.TERMS_ACTIVATE(id), {});
  }

  deactivateTermsVersion(id: number): Observable<boolean> {
    return this.api.post<boolean>(this.ep.TERMS_DEACTIVATE(id), {});
  }

  deleteTermsVersion(id: number): Observable<boolean> {
    return this.api.delete<boolean>(this.ep.TERMS_BY_ID(id));
  }

  /**
   * Optional backend: if not implemented, callers should catch errors and degrade.
   */
  getTermsAcceptanceStatus(): Observable<TermsAcceptanceStatusDto> {
    return this.api.get<TermsAcceptanceStatusDto>(this.ep.TERMS_ACCEPTANCE_STATUS);
  }

  /**
   * Optional backend: POST body may include `{ termsVersionId: number }` when added.
   */
  acceptActiveTerms(body: Record<string, unknown> = {}): Observable<boolean> {
    return this.api.post<boolean>(this.ep.TERMS_ACCEPT, body);
  }
}

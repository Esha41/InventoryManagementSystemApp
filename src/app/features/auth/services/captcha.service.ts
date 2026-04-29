import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { API_ENDPOINTS } from '@constants/app.constants';
import { CaptchaResponse } from '@models/auth.model';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { parseGenerateCaptchaApiPayload } from '@utils/captcha-response-parser.util';
import { ErrorHandler } from '@utils/error-handler.utils';

import { generateCaptchaImage } from '../utils/captcha-image.util';

export interface CaptchaState {
  id: string;
  image: string;
  isLoading: boolean;
}

const EMPTY_CAPTCHA_STATE: CaptchaState = { id: '', image: '', isLoading: false };

/**
 * Loads captcha metadata from the API and renders the challenge image locally
 * via {@link generateCaptchaImage} (no server image bytes).
 * API payload parsing is delegated to {@link parseGenerateCaptchaApiPayload} (shared with AuthFlowService).
 */
@Injectable({
  providedIn: 'root'
})
export class CaptchaService {
  private readonly captchaStateSubject = new BehaviorSubject<CaptchaState>(EMPTY_CAPTCHA_STATE);
  readonly captchaState$ = this.captchaStateSubject.asObservable();

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  /** True while a challenge is in flight or a non-empty challenge is held in memory. */
  get flowActive(): boolean {
    const s = this.captchaStateSubject.value;
    return s.isLoading || !!s.id || !!s.image;
  }

  /** Current captcha id for login payloads (empty when reset). */
  get captchaId(): string {
    return this.captchaStateSubject.value.id;
  }

  reset(): void {
    this.captchaStateSubject.next(EMPTY_CAPTCHA_STATE);
  }

  loadCaptcha(): Observable<void> {
    this.patchState({ isLoading: true });
    return this.fetchAndApplyCaptcha$();
  }

  refreshCaptcha(): Observable<void> {
    this.captchaStateSubject.next({ id: '', image: '', isLoading: true });
    return this.fetchAndApplyCaptcha$();
  }

  private patchState(partial: Partial<CaptchaState>): void {
    this.captchaStateSubject.next({ ...this.captchaStateSubject.value, ...partial });
  }

  private fetchAndApplyCaptcha$(): Observable<void> {
    const endpoint = API_ENDPOINTS.AUTH.GENERATE_CAPTCHA;
    this.configService.log('Generating captcha', { endpoint, fullUrl: `${this.configService.apiUrl}${endpoint}` });

    return this.apiService.getRaw<unknown>(endpoint).pipe(
      tap(raw => this.configService.log('Captcha response received', raw)),
      map(raw => this.parseCaptchaPayloadOrThrow(raw)),
      tap(response => {
        const image = generateCaptchaImage(response.captchaCode);
        this.captchaStateSubject.next({
          id: response.captchaId,
          image,
          isLoading: false
        });
      }),
      map(() => void 0),
      catchError(error => {
        this.configService.logError('Failed to generate captcha', error);
        this.patchState({ isLoading: false });
        const errorMessage = ErrorHandler.extractErrorMessage(
          error,
          'Failed to generate captcha. Please try again.'
        );
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  private parseCaptchaPayloadOrThrow(raw: unknown): CaptchaResponse {
    try {
      return parseGenerateCaptchaApiPayload(raw);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.message === 'Invalid captcha response format') {
        this.configService.logError('Unexpected captcha response format', raw);
      }
      throw err;
    }
  }
}

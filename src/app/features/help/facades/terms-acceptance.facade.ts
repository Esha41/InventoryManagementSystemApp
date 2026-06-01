import { Injectable, computed, inject, signal } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { EMPTY, catchError, finalize, take } from 'rxjs';
import { HelpCenterService } from '@help-center/services/help-center.service';
import { HelpCenterHtmlSanitizerService } from '@help-center/services/help-center-html-sanitizer.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { HelpCenterTermsDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { environment } from '@environments/environment';
import {
  clearSessionTermsAcceptance,
  hasSessionAcceptedTermsVersion,
  setSessionAcceptedTermsVersionId
} from '@core/utils/terms-acceptance-session.util';
import type { RichHtmlDirection } from '@help-center/utils/help-center-rich-html.utils';

/**
 * Terms blocking flow after login (Help Center API).
 * Per-login: sessionStorage records acceptance for the active terms version until logout or new login.
 */
@Injectable({
  providedIn: 'root'
})
export class TermsAcceptanceFacade {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly htmlSanitizer = inject(HelpCenterHtmlSanitizerService);
  private readonly onboarding = inject(ONBOARDING_TOUR, { optional: true }) as IOnboardingTourProvider | null;
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly isSecurityAcknowledgmentOnLoginEnabled =
    environment.enableSecurityAcknowledgmentOnLogin === true;

  readonly showModal = signal(false);
  readonly pendingTerms = signal<HelpCenterTermsDto | null>(null);
  readonly accepting = signal(false);
  readonly gateLoadFailed = signal(false);
  readonly sanitizedTermsHtml = signal<SafeHtml | null>(null);
  readonly termsContentDir = signal<RichHtmlDirection>('ltr');

  private readonly checkingTerms = signal(false);

  readonly shellBlocked = computed(
    () =>
      this.isSecurityAcknowledgmentOnLoginEnabled &&
      (this.checkingTerms() || this.showModal() || this.gateLoadFailed())
  );

  onMainShellInit(): void {
    if (this.isSecurityAcknowledgmentOnLoginEnabled) {
      this.evaluateTermsGate();
    }
  }

  onMainShellReady(): void {
    if (!this.isSecurityAcknowledgmentOnLoginEnabled) {
      this.onboarding?.checkAndStartTour();
    }
  }

  /** @deprecated Use {@link onMainShellReady} */
  beginShellReadyFlow(): void {
    this.onMainShellReady();
  }

  clearSessionAcceptance(): void {
    clearSessionTermsAcceptance();
  }

  beginPostLoginFlow(): void {
    if (!this.isSecurityAcknowledgmentOnLoginEnabled) {
      return;
    }
    this.clearSessionAcceptance();
    this.evaluateTermsGate();
  }

  retryTermsGate(): void {
    this.gateLoadFailed.set(false);
    this.evaluateTermsGate();
  }

  private evaluateTermsGate(): void {
    if (this.checkingTerms() || this.showModal()) {
      return;
    }

    this.checkingTerms.set(true);
    this.gateLoadFailed.set(false);

    this.helpCenter
      .getTermsAcceptanceStatus()
      .pipe(
        take(1),
        catchError(() => {
          this.resetTermsPresentation();
          this.gateLoadFailed.set(true);
          return EMPTY;
        }),
        finalize(() => this.checkingTerms.set(false))
      )
      .subscribe(status => {
        if (status.mustAccept && status.terms) {
          if (hasSessionAcceptedTermsVersion(status.terms.id)) {
            this.resetTermsPresentation();
            this.onboarding?.checkAndStartTour();
            return;
          }
          this.prepareTermsPresentation(status.terms);
          this.showModal.set(true);
        } else {
          this.resetTermsPresentation();
          this.onboarding?.checkAndStartTour();
        }
      });
  }

  private prepareTermsPresentation(terms: HelpCenterTermsDto): void {
    this.pendingTerms.set(terms);
    this.termsContentDir.set(this.htmlSanitizer.resolveContainerDir(terms.content));
    this.sanitizedTermsHtml.set(this.htmlSanitizer.sanitizeRichHtml(terms.content));
  }

  private resetTermsPresentation(): void {
    this.showModal.set(false);
    this.pendingTerms.set(null);
    this.sanitizedTermsHtml.set(null);
    this.termsContentDir.set('ltr');
  }

  submitAcceptance(): void {
    const terms = this.pendingTerms();
    if (!terms) return;
    this.accepting.set(true);
    this.helpCenter
      .acceptActiveTerms({ termsVersionId: terms.id })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.accepting.set(false);
          setSessionAcceptedTermsVersionId(terms.id);
          this.resetTermsPresentation();
          this.onboarding?.checkAndStartTour();
        },
        error: err => {
          this.accepting.set(false);
          const msg = ErrorHandler.extractErrorMessage(err, 'helpCenter.acceptTermsError');
          this.toast.error(msg || this.i18n.getTranslation('helpCenter.acceptTermsError'));
        }
      });
  }
}

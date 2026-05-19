import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, take } from 'rxjs';
import { HelpCenterService } from '@help-center/services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { HelpCenterTermsDto, TermsAcceptanceStatusDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { environment } from '@environments/environment';

/**
 * Terms blocking flow after login (Help Center API).
 */
@Injectable({
  providedIn: 'root'
})
export class TermsAcceptanceFacade {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly onboarding = inject(ONBOARDING_TOUR, { optional: true }) as IOnboardingTourProvider | null;
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  /** Same pattern as onboarding: {@link Environment.enableOnboardingTour}. */
  private readonly isSecurityAcknowledgmentOnLoginEnabled = environment.enableSecurityAcknowledgmentOnLogin === true;

  readonly showModal = signal(false);
  readonly pendingTerms = signal<HelpCenterTermsDto | null>(null);
  readonly accepting = signal(false);

  /**
   * When {@link environment.enableSecurityAcknowledgmentOnLogin} is off, the terms API is not used;
   * still run onboarding once the shell is ready (deep link, refresh, new tab).
   * When it is on, terms + onboarding are handled only after a successful login (see {@link beginPostLoginFlow}).
   */
  beginShellReadyFlow(): void {
    if (!this.isSecurityAcknowledgmentOnLoginEnabled) {
      this.onboarding?.checkAndStartTour();
    }
  }

  beginPostLoginFlow(): void {
    if (!this.isSecurityAcknowledgmentOnLoginEnabled) {
      return;
    }

    this.helpCenter
      .getTermsAcceptanceStatus()
      .pipe(
        take(1),
        catchError(() => of({ mustAccept: false, terms: null } as TermsAcceptanceStatusDto))
      )
      .subscribe(status => {
        if (status.mustAccept && status.terms) {
          this.pendingTerms.set(status.terms);
          this.showModal.set(true);
        } else {
          this.onboarding?.checkAndStartTour();
        }
      });
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
          this.showModal.set(false);
          this.pendingTerms.set(null);
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

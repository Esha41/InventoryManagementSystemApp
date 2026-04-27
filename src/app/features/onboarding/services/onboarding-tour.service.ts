import { Injectable, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { driver, Driver } from 'driver.js';
import { BackendAuthService } from '@services/backend-auth.service';
import { StorageService } from '@services/storage.service';
import { TranslationService } from '@services/translation.service';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { OnboardingApiService } from './onboarding-api.service';
import { getTourSteps } from '../config/tour-steps.config';
import { getPageTourSteps } from '../config/page-tour-steps.config';
import { environment } from '@environments/environment';

const ONBOARDING_CACHE_PREFIX = 'onboarding_completed_';
const PAGE_TOUR_CACHE_PREFIX = 'page_tour_completed_';

@Injectable({
  providedIn: 'root'
})
export class OnboardingTourService implements IOnboardingTourProvider, OnDestroy {
  private driverInstance: Driver | null = null;
  private pageTourDriverInstance: Driver | null = null;
  private destroy$ = new Subject<void>();
  private tourInProgress = false;
  private pageTourInProgress = false;
  private isRestartingForLangSwitch = false;
  private readonly isTourEnabled = environment.enableOnboardingTour === true;

  constructor(
    private onboardingApi: OnboardingApiService,
    private authService: BackendAuthService,
    private storageService: StorageService,
    private translateService: TranslateService,
    private translationService: TranslationService
  ) {}

  ngOnDestroy(): void {
    this.destroy();
  }

  checkAndStartTour(): void {
    if (!this.isTourEnabled) return;

    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    const cacheKey = ONBOARDING_CACHE_PREFIX + user.id;

    if (this.storageService.get<boolean>(cacheKey)) {
      return;
    }

    this.onboardingApi.getStatus()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of({ isCompleted: false }))
      )
      .subscribe(status => {
        if (status.isCompleted) {
          this.storageService.set(cacheKey, true);
          return;
        }
        this.startTour();
      });
  }

  startTour(): void {
    if (!this.isTourEnabled) return;
    if (this.tourInProgress) return;
    this.tourInProgress = true;

    const isRTL = this.translationService.isRTL();
    const steps = getTourSteps(
      this.translateService,
      isRTL,
      () => this.restartTourWithNewLanguage()
    );

    this.driverInstance = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayClickBehavior: () => {},
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'ettad-tour-popover',
      nextBtnText: this.translateService.instant('onboarding.btnNext'),
      prevBtnText: this.translateService.instant('onboarding.btnPrev'),
      doneBtnText: this.translateService.instant('onboarding.btnDone'),
      progressText: '{{current}} / {{total}}',
      onPopoverRender: popover => {
        const rtl = this.translationService.isRTL();
        popover.wrapper.setAttribute('dir', rtl ? 'rtl' : 'ltr');
        popover.wrapper.setAttribute('lang', this.translationService.getCurrentLanguage());
      },
      steps: steps,
      onDestroyStarted: () => {
        if (!this.isRestartingForLangSwitch) {
          this.completeTour();
        }
        this.driverInstance?.destroy();
      },
      onDestroyed: () => {
        this.tourInProgress = false;
      },
    });

    this.driverInstance.drive();
  }

  private restartTourWithNewLanguage(): void {
    this.isRestartingForLangSwitch = true;
    if (this.driverInstance) {
      this.driverInstance.destroy();
      this.driverInstance = null;
    }
    this.translationService.toggleLanguage();
    setTimeout(() => {
      this.isRestartingForLangSwitch = false;
      this.startTour();
    }, 300);
  }

  resetTour(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    const cacheKey = ONBOARDING_CACHE_PREFIX + user.id;
    this.storageService.remove(cacheKey);
  }

  checkAndStartPageTour(pageKey: string): void {
    if (!this.isTourEnabled) return;
    if (this.tourInProgress || this.pageTourInProgress) return;

    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    const completedCacheKey = `${PAGE_TOUR_CACHE_PREFIX}${String(user.id)}_${pageKey}`;
    if (this.storageService.get<boolean>(completedCacheKey) === true) return;

    this.startPageTour(pageKey, completedCacheKey);
  }

  private startPageTour(pageKey: string, completedCacheKey: string): void {
    if (this.pageTourInProgress) return;
    this.pageTourInProgress = true;

    const isRTL = this.translationService.isRTL();
    const steps = getPageTourSteps(pageKey, this.translateService, isRTL);
    if (!steps.length) {
      this.pageTourInProgress = false;
      return;
    }

    this.pageTourDriverInstance = driver({
      showProgress: false,
      animate: true,
      allowClose: true,
      overlayClickBehavior: () => {},
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'ettad-tour-popover ettad-page-tour-popover',
      nextBtnText: this.translateService.instant('onboarding.btnNext'),
      prevBtnText: this.translateService.instant('onboarding.btnPrev'),
      doneBtnText: this.translateService.instant('onboarding.btnDone'),
      onPopoverRender: popover => {
        const rtl = this.translationService.isRTL();
        popover.wrapper.setAttribute('dir', rtl ? 'rtl' : 'ltr');
        popover.wrapper.setAttribute('lang', this.translationService.getCurrentLanguage());
      },
      steps: steps,
      onDestroyStarted: () => {
        this.pageTourDriverInstance?.destroy();
      },
      onDestroyed: () => {
        this.storageService.set(completedCacheKey, true);
        this.pageTourInProgress = false;
        this.pageTourDriverInstance = null;
      },
    });

    this.pageTourDriverInstance.drive();
  }

  destroy(): void {
    if (this.driverInstance) {
      this.tourInProgress = false;
      this.driverInstance.destroy();
      this.driverInstance = null;
    }
    if (this.pageTourDriverInstance) {
      this.pageTourInProgress = false;
      this.pageTourDriverInstance.destroy();
      this.pageTourDriverInstance = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private completeTour(): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) return;

    const cacheKey = ONBOARDING_CACHE_PREFIX + user.id;
    this.storageService.set(cacheKey, true);

    this.onboardingApi.markComplete()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(false))
      )
      .subscribe();
  }
}

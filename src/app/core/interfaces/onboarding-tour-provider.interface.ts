export interface IOnboardingTourProvider {
  checkAndStartTour(): void;
  checkAndStartPageTour(pageKey: string): void;
  startTour(): void;
  resetTour(): void;
  destroy(): void;
}

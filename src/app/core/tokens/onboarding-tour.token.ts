import { InjectionToken } from '@angular/core';
import { IOnboardingTourProvider } from '../interfaces/onboarding-tour-provider.interface';

export const ONBOARDING_TOUR = new InjectionToken<IOnboardingTourProvider>('ONBOARDING_TOUR');

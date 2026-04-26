import { Provider } from '@angular/core';
import { USER_PROFILE_PROVIDER } from '@core/tokens/user-profile-provider.token';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { APP_NOTIFICATIONS_BOOTSTRAP } from '@core/notifications/app-notifications-bootstrap.token';
import { ProfileDataService } from '@profile/services/profile-data.service';
import { OnboardingTourService } from '@features/onboarding/services/onboarding-tour.service';
import { NotificationService } from '@notifications/services/notification.service';


export const SHELL_INTEGRATION_PROVIDERS: Provider[] = [
  { provide: APP_NOTIFICATIONS_BOOTSTRAP, useExisting: NotificationService },
  { provide: USER_PROFILE_PROVIDER, useExisting: ProfileDataService },
  { provide: ONBOARDING_TOUR, useExisting: OnboardingTourService }
];

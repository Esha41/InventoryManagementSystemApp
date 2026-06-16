import type { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://localhost:7148/api',
  appName: 'Ettad',
  enableLogging: false,
  version: '1.4.1',
  notificationHubUrl: 'https://localhost:7148/hubs/notification',
  idleWarningAfterMinutes: 15,
  idleLogoutCountdownSeconds: 60,
  // Keep auth in sessionStorage: page reloads and new tabs restore silently via the
  // httpOnly refresh cookie, while closing the browser ends the session.
  persistAuthAcrossSessions: false,
  enableOnboardingTour: true,
  enableSecurityAcknowledgmentOnLogin: true
};


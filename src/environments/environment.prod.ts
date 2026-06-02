import type { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://localhost:7148/api',
  appName: 'Ettad',
  enableLogging: false,
  version: '1.4.0',
  notificationHubUrl: 'https://localhost:7148/hubs/notification',
  idleWarningAfterMinutes: 15,
  idleLogoutCountdownSeconds: 60,
  persistAuthAcrossSessions: true,
  enableOnboardingTour: true,
  enableSecurityAcknowledgmentOnLogin: true
};


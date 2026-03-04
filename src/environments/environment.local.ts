import type { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  apiUrl: 'https://localhost:7148/api',
  appName: 'Ettad (Local)',
  enableLogging: true,
  version: '1.1.2',
  notificationHubUrl: 'https://localhost:7148/hubs/notification',
  mockData: false,
  debugMode: true
};

import type { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://localhost:7148/api',
  appName: 'Ettad',
  enableLogging: false,
  version: '1.1.2',
  notificationHubUrl: 'https://localhost:7148/hubs/notification'
};


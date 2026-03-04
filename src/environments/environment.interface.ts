/**
 * Environment configuration interface.
 * All environment files must conform to this shape.
 * Optional properties are overridable via runtime-config.json.
 */
export interface Environment {
  production: boolean;
  apiUrl: string;
  appName: string;
  enableLogging: boolean;
  version: string;
  notificationHubUrl?: string;
  fileBaseUrl?: string;
  debugMode?: boolean;
  mockData?: boolean;
}

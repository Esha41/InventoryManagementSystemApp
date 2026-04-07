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
  /**
   * Minutes without mouse/keyboard/touch before the "still there?" modal appears.
   * MUST be less than backend JWT AccessTokenExpireInMinutes so the idle dialog
   * appears before the access token expires; otherwise the HTTP interceptor will
   * redirect to the login page before the countdown is shown.
   * Time until auto-logout after going idle ≈ this value + idleLogoutCountdownSeconds.
   */
  idleWarningAfterMinutes?: number;
  /** Seconds shown in the modal before logout if the user takes no action. */
  idleLogoutCountdownSeconds?: number;
}

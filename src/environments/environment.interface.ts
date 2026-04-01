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
   * Minutes without mouse/keyboard/touch before the “still there?” modal appears.
   * Set to match backend JWT AccessTokenExpireInMinutes when you want the same policy (e.g. 15).
   * Time until auto-logout after going idle ≈ this value in minutes + idleLogoutCountdownSeconds.
   */
  idleWarningAfterMinutes?: number;
  /** Seconds shown in the modal before logout if the user takes no action. */
  idleLogoutCountdownSeconds?: number;
}

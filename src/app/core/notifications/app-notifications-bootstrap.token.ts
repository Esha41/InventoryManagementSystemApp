import { InjectionToken } from '@angular/core';

/**
 * Root bootstrap for in-app notifications (e.g. SignalR connect, unread counts).
 * Implemented in the notifications feature; app shell depends only on this token.
 */
export interface AppNotificationsBootstrap {
  initialize(): void;
}

export const APP_NOTIFICATIONS_BOOTSTRAP = new InjectionToken<AppNotificationsBootstrap>(
  'APP_NOTIFICATIONS_BOOTSTRAP'
);

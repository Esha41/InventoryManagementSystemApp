import { NotificationActionKeys } from '@notifications/models/notification.model';

/**
 * Notification action keys configuration
 */
export const NOTIFICATION_ACTION_KEYS: NotificationActionKeys = {
  confirm: ['confirmPickupUrl', 'confirmUrl', 'confirmEndpoint', 'confirm'] as const,
  reschedule: ['proposeNewTimeUrl', 'rescheduleUrl', 'scheduleUrl', 'proposeUrl', 'updateScheduleUrl'] as const,
  hidden: new Set([
    'actions',
    'actionUrls',
    'confirm',
    'confirmUrl',
    'confirmEndpoint',
    'confirmPickupUrl',
    'confirmPickupEndpoint',
    'confirmPickup',
    'proposeNewTimeUrl',
    'proposeUrl',
    'rescheduleUrl',
    'scheduleUrl',
    'updateScheduleUrl'
  ])
} as const;

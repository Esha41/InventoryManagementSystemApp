import { Notification, NotificationMetadata, NotificationRequestDetail, NotificationDetailType } from '@notifications/models/notification.model';
import { RequestPriority, RequestStatus } from '@models/backend-enums';

/**
 * Normalize unknown hub/backend metadata to a string-keyed object, or null if not an object.
 */
export function asNotificationMetadata(value: unknown): NotificationMetadata | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as NotificationMetadata;
}

/**
 * Extract entity ID from notification metadata
 */
export function extractEntityIdFromMetadata(notification: Notification): number | null {
  const metadata = asNotificationMetadata(notification.metadata);
  if (!metadata) {
    return null;
  }

  const possibleKeys = ['entityId', 'orderId', 'returnId', 'discardId', 'requestId', 'id'];
  for (const key of possibleKeys) {
    const value = metadata[key];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

/**
 * Extract record from unknown value
 */
export function extractRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Format metadata value for display
 */
export function formatMetadataValue(value: unknown): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

/**
 * Format metadata key for display
 */
export function formatMetadataKey(key: string, translateService: { instant: (key: string) => string }): string {
  const translationKey = `notifications.${key}`;
  const translated = translateService.instant(translationKey);
  if (translated && translated !== translationKey) {
    return translated;
  }

  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
    .trim();
}

/**
 * Check if notification has metadata action
 */
export function hasMetadataAction(
  notification: Notification,
  keys: readonly string[],
  _hiddenKeys: ReadonlySet<string>
): boolean {
  if (!notification.metadata) {
    return false;
  }

  const metadata = asNotificationMetadata(notification.metadata);
  if (!metadata) {
    return false;
  }

  const actions = extractRecord(metadata['actions']) ?? extractRecord(metadata['actionUrls']);

  for (const key of keys) {
    const normalizedKey = key.replace(/Url$/i, '');
    const candidates = [
      metadata[key],
      metadata[`${key}Endpoint`],
      metadata[`${key}Url`],
      metadata[normalizedKey]
    ];

    if (actions) {
      candidates.push(
        actions[key],
        actions[`${key}Url`],
        actions[`${key}Endpoint`],
        actions[normalizedKey]
      );
    }

    if (candidates.some(value => typeof value === 'string' && value.trim().length > 0)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine detail type from request detail
 */
export function determineDetailType(detail: NotificationRequestDetail): NotificationDetailType {
  if ('requestNo' in detail && !('reason' in detail)) {
    return 'order';
  } else if ('reason' in detail) {
    return 'return';
  } else {
    return 'discard';
  }
}

/** i18n key under `dashboard.priorityLabels.*` */
export function getPriorityLabelTranslation(priority?: number | null): string {
  if (priority == null) {
    return 'dashboard.priorityLabels.urgent';
  }
  switch (priority) {
    case RequestPriority.Normal:
      return 'dashboard.priorityLabels.normal';
    case RequestPriority.Urgent:
      return 'dashboard.priorityLabels.urgent';
    case RequestPriority.VeryUrgent:
      return 'dashboard.priorityLabels.veryUrgent';
    default:
      return 'dashboard.priorityLabels.urgent';
  }
}

/** i18n key under `dashboard.statusLabels.*` */
export function getStatusLabelTranslation(status?: number | null): string {
  if (status == null) {
    return 'dashboard.statusLabels.new';
  }
  switch (status) {
    case RequestStatus.UnderProcess:
      return 'dashboard.statusLabels.underProcess';
    case RequestStatus.Approved:
      return 'requestsManagement.orderReport.workflowStatus.completed';
    case RequestStatus.Rejected:
      return 'dashboard.statusLabels.rejected';
    case RequestStatus.Cancelled:
      return 'dashboard.statusLabels.cancelled';
    case RequestStatus.ReturnedForReview:
      return 'dashboard.statusLabels.returnedForReview';
    case RequestStatus.AutoRejected:
      return 'dashboard.statusLabels.autoRejected';
    default:
      return 'dashboard.statusLabels.new';
  }
}

/**
 * Check if notification can confirm pickup
 */
export function canConfirmPickup(
  notification: Notification | null,
  confirmActionKeys: readonly string[],
  hiddenKeys: ReadonlySet<string>
): boolean {
  if (!notification || !notification.metadata) {
    return false;
  }

  const metadata = asNotificationMetadata(notification.metadata);
  if (!metadata) {
    return false;
  }

  if (metadata['confirmed'] === true) {
    return false;
  }

  return hasMetadataAction(notification, confirmActionKeys, hiddenKeys);
}

/**
 * Check if notification can propose new time
 */
export function canProposeNewTime(
  notification: Notification | null,
  rescheduleActionKeys: readonly string[],
  hiddenKeys: ReadonlySet<string>
): boolean {
  if (!notification || !notification.metadata) {
    return false;
  }

  const metadata = asNotificationMetadata(notification.metadata);
  if (!metadata) {
    return false;
  }

  if (metadata['allowReschedule'] === false) {
    return false;
  }

  return hasMetadataAction(notification, rescheduleActionKeys, hiddenKeys);
}

/**
 * Get display metadata items
 */
export function getDisplayMetadata(
  notification: Notification | null,
  hiddenKeys: ReadonlySet<string>,
  _translateService: { instant: (key: string) => string }
): Array<{ key: string; value: string }> {
  const meta = asNotificationMetadata(notification?.metadata ?? null);
  if (!meta) {
    return [];
  }

  const iterable = Object.entries(meta)
    .filter(([key]) => !hiddenKeys.has(key));

  return iterable
    .map(([key, value]) => ({
      key,
      value: formatMetadataValue(value)
    }))
    .filter(item => item.value.length > 0);
}

/**
 * Handle detail error and return error message
 */
export function handleDetailError(
  error: unknown,
  translateService: { instant: (key: string) => string }
): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as { status?: unknown; message?: unknown };
    const status = err.status;
    if (status === 403 || status === 401) {
      return 'You do not have permission to view details for this notification.';
    }
    if (status === 404) {
      return 'The requested details could not be found.';
    }
    if (typeof err.message === 'string' && err.message.length > 0) {
      return err.message;
    }
  }
  return translateService.instant('notifications.details.unknown');
}

import { Notification, NotificationRequestDetail, NotificationDetailType } from '@notifications/models/notification.model';

/**
 * Extract entity ID from notification metadata
 */
export function extractEntityIdFromMetadata(notification: Notification): number | null {
  const metadata = notification.metadata as Record<string, unknown> | null;
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
export function extractRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, any>;
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
  hiddenKeys: ReadonlySet<string>
): boolean {
  if (!notification.metadata) {
    return false;
  }

  const metadata = notification.metadata as Record<string, any>;
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

/**
 * Get priority label translation key
 * Handles both number and string priority values
 * Priority mapping: 1 = Normal, 2 = Urgent, 3 = VeryUrgent
 */
export function getPriorityLabelTranslation(priority?: number | string | null): string {
  if (priority === null || priority === undefined) {
    return 'dashboard.priorityLabels.urgent';
  }

  // Normalize to number
  let priorityNum: number;
  if (typeof priority === 'string') {
    const priorityLower = priority.toLowerCase().trim().replace(/\s+/g, '');
    if (priorityLower === 'normal' || priorityLower === '1') {
      priorityNum = 1;
    } else if (priorityLower === 'urgent' || priorityLower === '2') {
      priorityNum = 2;
    } else if (priorityLower === 'veryurgent' || priorityLower === '3') {
      priorityNum = 3;
    } else if (priorityLower === 'critical' || priorityLower === '4') {
      priorityNum = 4;
    } else {
      const parsed = parseInt(priority, 10);
      priorityNum = isNaN(parsed) ? 2 : parsed;
    }
  } else {
    priorityNum = priority;
  }

  switch (priorityNum) {
    case 1:
      return 'dashboard.priorityLabels.normal';
    case 2:
      return 'dashboard.priorityLabels.urgent';
    case 3:
      return 'dashboard.priorityLabels.veryUrgent';
    default:
      return 'dashboard.priorityLabels.urgent';
  }
}

/**
 * Get status label translation key
 * Handles both number and string status values
 */
export function getStatusLabelTranslation(status?: number | string | null): string {
  if (status === null || status === undefined) {
    return 'dashboard.statusLabels.new';
  }

  // Normalize to number
  let statusNum: number;
  if (typeof status === 'string') {
    const statusLower = status.toLowerCase().trim();
    if (statusLower === 'new' || statusLower === 'pending' || statusLower === '1') {
      statusNum = 1;
    } else if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress' || statusLower === '2') {
      statusNum = 2;
    } else if (statusLower === 'approved' || statusLower === 'completed' || statusLower === 'confirmed' || statusLower === '3') {
      statusNum = 3;
    } else if (statusLower === 'rejected' || statusLower === 'declined' || statusLower === '4') {
      statusNum = 4;
    } else if (statusLower === 'cancelled' || statusLower === '5') {
      statusNum = 5;
    } else {
      const parsed = parseInt(status, 10);
      statusNum = isNaN(parsed) ? 1 : parsed;
    }
  } else {
    statusNum = status;
  }

  switch (statusNum) {
    case 2:
      return 'dashboard.statusLabels.underProcess';
    case 3:
      return 'requestsManagement.orderReport.workflowStatus.completed';
    case 4:
      return 'dashboard.statusLabels.rejected';
    case 5:
      return 'dashboard.statusLabels.cancelled';
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

  const metadata = notification.metadata as Record<string, any>;

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

  const metadata = notification.metadata as Record<string, any>;

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
  translateService: { instant: (key: string) => string }
): Array<{ key: string; value: string }> {
  if (!notification?.metadata) {
    return [];
  }

  const iterable = Object.entries(notification.metadata)
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
  const errorObj = error as any;

  // Check for permission/authorization errors
  if (errorObj?.status === 403 || errorObj?.status === 401) {
    return 'You do not have permission to view details for this notification.';
  } else if (errorObj?.status === 404) {
    return 'The requested details could not be found.';
  } else if (errorObj?.message) {
    return errorObj.message;
  } else {
    return translateService.instant('notifications.details.unknown');
  }
}

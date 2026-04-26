import { NotificationHubPayload } from '@core/notifications/notification-hub.types';
import { Notification } from '@notifications/models/notification.model';

export function mapHubPayloadToNotification(dto: NotificationHubPayload): Notification {
  const id = dto.id ?? dto.notificationId ?? 0;
  const createdAt = dto.createdAt
    ?? dto.creationDate
    ?? dto.createdOn
    ?? dto.timestamp
    ?? new Date().toISOString();

  const message = dto.message
    ?? dto.body
    ?? dto.title
    ?? '';

  const title = dto.title
    ?? dto.type
    ?? dto.entityType
    ?? null;

  const type = dto.type
    ?? dto.entityType
    ?? dto.title
    ?? null;

  const isRead = dto.isRead
    ?? dto.read
    ?? (dto.readAt != null);

  return {
    id,
    userId: dto.userId ?? dto.recipientId ?? dto.createdBy ?? null,
    message,
    createdAt,
    isRead: !!isRead,
    type,
    title,
    senderId: dto.senderId ?? dto.createdBy ?? null,
    entityType: dto.entityType ?? null,
    entityId: dto.entityId ?? null,
    metadata: dto.metadata ?? dto.additionalData ?? null
  };
}

export function extractEntityIdFromMetadata(notification: Notification): number | null {
  if (!notification.metadata) {
    return null;
  }

  const metadata = notification.metadata as Record<string, unknown>;
  const possibleKeys = ['entityId', 'orderId', 'returnId', 'discardId', 'requestId', 'id'];

  for (const key of possibleKeys) {
    const value = metadata[key];
    if (value != null) {
      if (typeof value === 'number') {
        return value;
      }
      const parsed = Number(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

  export function resolveNotificationActionEndpoint(
  notification: Notification | undefined,
  keys: string[]
): string | null {
  if (!notification?.metadata) {
    return null;
  }

  const metadata = notification.metadata as Record<string, unknown>;
  const actions = (metadata['actions'] ?? metadata['actionUrls']) as Record<string, unknown> | undefined;

  for (const key of keys) {
    const value =
      metadata[key] ??
      metadata[`${key}Endpoint`] ??
      metadata[`${key}Url`] ??
      metadata[key.replace(/Url$/i, '')] ??
      actions?.[key] ??
      actions?.[`${key}Url`] ??
      actions?.[`${key}Endpoint`];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

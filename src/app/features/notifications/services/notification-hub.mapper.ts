import { NotificationHubPayload } from '@core/notifications/notification-hub.types';
import { Notification } from '@notifications/models/notification.model';
import { extractRecord } from '@notifications/utils/notification.utils';

export { extractEntityIdFromMetadata } from '@notifications/utils/notification.utils';

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

export function resolveNotificationActionEndpoint(
  notification: Notification | undefined,
  keys: string[]
): string | null {
  const metadata = extractRecord(notification?.metadata ?? null);
  if (!metadata) {
    return null;
  }

  const actions = extractRecord(metadata['actions']) ?? extractRecord(metadata['actionUrls']);

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

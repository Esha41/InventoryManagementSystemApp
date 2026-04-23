/**
 * Wire-format payload from the notification SignalR hub (and compatible REST DTOs).
 */
export interface NotificationHubPayload {
  id?: number;
  notificationId?: number;
  userId?: string;
  recipientId?: string;
  createdBy?: string;
  senderId?: string;
  title?: string;
  message?: string;
  body?: string;
  type?: string;
  entityType?: string;
  entityId?: number;
  createdAt?: string;
  creationDate?: string;
  createdOn?: string;
  timestamp?: string;
  isRead?: boolean;
  read?: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  additionalData?: Record<string, unknown> | null;
}

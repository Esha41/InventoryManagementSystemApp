export interface Notification {
  id: number;
  message: string;
  createdAt: string;
  isRead: boolean;
  userId?: string | null;
  title?: string | null;
  type?: string | null;
  senderId?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, any> | null;
}


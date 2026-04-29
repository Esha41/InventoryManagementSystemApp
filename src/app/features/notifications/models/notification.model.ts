import { OrderDto } from '@models/order.model';
import { ReturnDto } from '@models/return.model';
import { DiscardDto } from '@models/discard.model';
export type NotificationMetadata = Record<string, unknown>;

/**
 * Base notification interface
 */
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
  metadata?: NotificationMetadata | null;
}

/**
 * Notification filter type
 */
export type NotificationFilter = 'all' | 'unread';

/**
 * Notification detail type
 */
export type NotificationDetailType = 'order' | 'return' | 'discard' | null;

/**
 * Notification detail state
 */
export interface NotificationDetailState {
  loading: boolean;
  error: string | null;
  type: NotificationDetailType;
  orderDetail: OrderDto | null;
  returnDetail: ReturnDto | null;
  discardDetail: DiscardDto | null;
}

/**
 * Metadata display item
 */
export interface MetadataDisplayItem {
  key: string;
  value: string;
}

/**
 * Notification action keys configuration
 */
export interface NotificationActionKeys {
  confirm: readonly string[];
  reschedule: readonly string[];
  hidden: ReadonlySet<string>;
}

/**
 * Request detail union type for notification deep-links
 */
export type NotificationRequestDetail = OrderDto | ReturnDto | DiscardDto;

/**
 * Notification detail result from service
 */
export interface NotificationDetailResult {
  type: NotificationDetailType;
  detail: NotificationRequestDetail | null;
  error: string | null;
}


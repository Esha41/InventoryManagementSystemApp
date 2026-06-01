import { Notification } from '@notifications/models/notification.model';
import { extractEntityIdFromMetadata } from './notification.utils';
import { extractRequestNoFromMessage, getNotificationEntityId } from './notification-message.utils';

export type NotificationMessagePart = { kind: 'text' | 'link'; value: string };

/** Matches backend prefixes from RequestNoGeneratorService (ORD, RTN, DISC); RET/DIS kept for legacy numbers */
const REQUEST_NO_TOKEN = /((?:ORD|RTN|DISC|RET|DIS)-[\d\-A-Z]+)/g;

const WORKFLOW_NOTIFICATION_ENTITY_TYPES = new Set([
  'order',
  'request',
  'workflow',
  'workflowapproval',
  'return',
  'discard'
]);

function normalizeEntityType(notification: Notification): string {
  return (notification.entityType ?? notification.type ?? '').toLowerCase().trim();
}

function isSupplyPickupWorkflowNotification(notification: Notification): boolean {
  const title = (notification.title ?? '').trim().toLowerCase();
  const message = (notification.message ?? '').trim().toLowerCase();
  if (title.includes('supply pickup date')) {
    return true;
  }
  if (message.includes('supply pickup date for order')) {
    return true;
  }
  return normalizeEntityType(notification) === 'supply';
}

/** `/requests/requests-management/:id/workflow-approval` when notification carries a workflow-scoped entity id */
export function getWorkflowApprovalNavigation(
  notification: Notification | null
): { path: string[] } | null {
  if (!notification) {
    return null;
  }
  const raw = notification.entityId ?? extractEntityIdFromMetadata(notification);
  const id = raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  if (!WORKFLOW_NOTIFICATION_ENTITY_TYPES.has(normalizeEntityType(notification))) {
    return null;
  }
  return { path: ['/requests/requests-management', String(id), 'workflow-approval'] };
}

export function hasWorkflowApprovalNavigation(notification: Notification | null): boolean {
  if (!notification) {
    return false;
  }
  if (getWorkflowApprovalNavigation(notification) !== null) {
    return true;
  }
  if (!isSupplyPickupWorkflowNotification(notification)) {
    return false;
  }
  const entityType = normalizeEntityType(notification);
  if (entityType === 'order' && getNotificationEntityId(notification) != null) {
    return true;
  }
  if (entityType === 'supply' && getNotificationEntityId(notification) != null) {
    return true;
  }
  return !!extractRequestNoFromMessage(notification.message);
}

/** Split translated body so ORD-/RET-/DIS- segments can become links when deep-link is allowed */
export function splitTranslatedNotificationMessage(
  translatedBody: string,
  enableRequestNumberLinks: boolean
): NotificationMessagePart[] {
  if (!translatedBody) {
    return [];
  }
  if (!enableRequestNumberLinks) {
    return [{ kind: 'text', value: translatedBody }];
  }

  const parts: NotificationMessagePart[] = [];
  let last = 0;
  const re = new RegExp(REQUEST_NO_TOKEN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(translatedBody)) !== null) {
    if (m.index > last) {
      parts.push({ kind: 'text', value: translatedBody.slice(last, m.index) });
    }
    parts.push({ kind: 'link', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < translatedBody.length) {
    parts.push({ kind: 'text', value: translatedBody.slice(last) });
  }
  return parts.length > 0 ? parts : [{ kind: 'text', value: translatedBody }];
}

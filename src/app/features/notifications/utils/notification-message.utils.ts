import { TranslateService } from '@ngx-translate/core';
import { Notification } from '@notifications/models/notification.model';
import { extractEntityIdFromMetadata } from './notification.utils';
import { getWorkflowApprovalNavigation } from './notification-workflow-navigation.utils';

/** Matches backend prefixes from RequestNoGeneratorService (ORD, RTN, DISC); RET/DIS kept for legacy numbers */
const REQUEST_NO_IN_TEXT = /((?:ORD|RTN|DISC|RET|DIS)-[\d\-A-Z]+)/i;

export function extractRequestNoFromMessage(message: string | null | undefined): string {
  if (!message?.trim()) {
    return '';
  }
  const trimmed = message.trim();
  const hashMatch = trimmed.match(/Request #(.+?) awaits your approval\.?/i)
    ?? trimmed.match(/Request #(.+?) requires higher approval\.?/i)
    ?? trimmed.match(/Order #((?:ORD|RTN|DISC|RET|DIS)-[\d\-A-Z]+)/i);
  if (hashMatch?.[1]?.trim()) {
    return hashMatch[1].trim();
  }
  const tokenMatch = trimmed.match(REQUEST_NO_IN_TEXT);
  return tokenMatch?.[1] ?? tokenMatch?.[0] ?? '';
}

export function isSupplyPickupNotification(notification: Notification): boolean {
  const title = (notification.title ?? '').trim().toLowerCase();
  const message = (notification.message ?? '').trim().toLowerCase();
  if (title.includes('supply pickup date')) {
    return true;
  }
  if (message.includes('supply pickup date for order')) {
    return true;
  }
  const entityType = (notification.entityType ?? notification.type ?? '').toLowerCase().trim();
  return entityType === 'supply';
}

export function isApprovalRequiredNotification(notification: Notification): boolean {
  const title = (notification.title ?? '').trim().toLowerCase();
  const message = (notification.message ?? '').trim().toLowerCase();
  return title.includes('approval required')
    || message.includes('awaits your approval')
    || message.includes('requires higher approval');
}

export function getNotificationEntityId(notification: Notification): number | null {
  const raw = notification.entityId ?? extractEntityIdFromMetadata(notification);
  if (raw == null) {
    return null;
  }
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function notificationNeedsRequestNoLookup(notification: Notification): boolean {
  if (!isApprovalRequiredNotification(notification)) {
    return false;
  }
  if (extractRequestNoFromMessage(notification.message)) {
    return false;
  }
  return getWorkflowApprovalNavigation(notification) !== null;
}

export function translateNotificationMessageText(
  translateService: TranslateService,
  message: string | null | undefined,
  fallbackRequestNo = ''
): string {
  if (!message) {
    return '';
  }

  const messageTrimmed = message.trim();
  const messageLower = messageTrimmed.toLowerCase();
  const requestNo = extractRequestNoFromMessage(messageTrimmed) || fallbackRequestNo;

  if (messageLower.includes('order request') && messageLower.includes('has been created')) {
    return translateService.instant('notifications.messages.orderCreated', { requestNo });
  }
  if (messageLower.includes('return request') && messageLower.includes('has been created')) {
    return translateService.instant('notifications.messages.returnCreated', { requestNo });
  }
  if (messageLower.includes('discard request') && messageLower.includes('has been created')) {
    return translateService.instant('notifications.messages.discardCreated', { requestNo });
  }
  if (messageLower.includes('order request') && messageLower.includes('has been approved')) {
    return translateService.instant('notifications.messages.orderApproved', { requestNo });
  }
  if (messageLower.includes('order request') && messageLower.includes('has been rejected')) {
    return translateService.instant('notifications.messages.orderRejected', { requestNo });
  }
  if (messageLower.includes('return request') && messageLower.includes('has been approved')) {
    return translateService.instant('notifications.messages.returnApproved', { requestNo });
  }
  if (messageLower.includes('return request') && messageLower.includes('has been rejected')) {
    return translateService.instant('notifications.messages.returnRejected', { requestNo });
  }
  if (messageLower.includes('discard request') && messageLower.includes('has been approved')) {
    return translateService.instant('notifications.messages.discardApproved', { requestNo });
  }
  if (messageLower.includes('discard request') && messageLower.includes('has been rejected')) {
    return translateService.instant('notifications.messages.discardRejected', { requestNo });
  }

  const workflowTranslated =
    translateWorkflowRequestActionMessage(
      translateService,
      messageTrimmed,
      /^Request #(.+?) has been approved\.(?: Comments: (.*))?$/i,
      /^Request #(.+?) has been approved by (.+?)\.(?: Comments: (.*))?$/i,
      'notifications.messages.workflowRequestApprovedMessage'
    )
    ?? translateWorkflowRequestActionMessage(
      translateService,
      messageTrimmed,
      /^Request #(.+?) has been rejected\.(?: Comments: (.*))?$/i,
      /^Request #(.+?) has been rejected by (.+?)\.(?: Comments: (.*))?$/i,
      'notifications.messages.workflowRequestRejectedMessage'
    )
    ?? translateWorkflowRequestActionMessage(
      translateService,
      messageTrimmed,
      /^Request #(.+?) has been cancelled\.(?: Comments: (.*))?$/i,
      /^Request #(.+?) has been cancelled by (.+?)\.(?: Comments: (.*))?$/i,
      'notifications.messages.workflowRequestCancelledMessage'
    )
    ?? translateWorkflowRequestActionMessage(
      translateService,
      messageTrimmed,
      /^Request #(.+?) has been returned for review\.(?: Comments: (.*))?$/i,
      /^Request #(.+?) has been returned for review by (.+?)\.(?: Comments: (.*))?$/i,
      'notifications.messages.workflowRequestReturnedForReviewMessage'
    );
  if (workflowTranslated !== null) {
    return workflowTranslated;
  }

  if (messageLower.includes('awaits your approval')) {
    if (requestNo) {
      return translateService.instant('notifications.messages.requestAwaitingApproval', { requestNo });
    }
    return translateService.instant('notifications.messages.requestAwaitingApprovalGeneric');
  }
  if (messageLower.includes('requires higher approval')) {
    if (requestNo) {
      return translateService.instant('notifications.messages.requestRequiresHigherApproval', { requestNo });
    }
    return translateService.instant('notifications.messages.requestRequiresHigherApprovalGeneric');
  }

  const supplyPickupTranslated = translateSupplyPickupMessage(translateService, messageTrimmed, requestNo);
  if (supplyPickupTranslated !== null) {
    return supplyPickupTranslated;
  }

  return messageTrimmed;
}

function translateSupplyPickupMessage(
  translateService: TranslateService,
  messageTrimmed: string,
  fallbackRequestNo: string
): string | null {
  const setMatch = messageTrimmed.match(
    /^The supply pickup date for Order #(.+?) has been set to (\d{4}-\d{2}-\d{2})\.\s*(.*)$/is
  );
  if (setMatch) {
    const requestNo = setMatch[1].trim() || fallbackRequestNo;
    const main = translateService.instant('notifications.messages.supplyPickupDateSet', {
      requestNo,
      date: setMatch[2]
    });
    const suffix = setMatch[3]?.trim();
    return suffix ? `${main} ${suffix}` : main;
  }

  const confirmedMatch = messageTrimmed.match(
    /^The supply pickup date for Order #(.+?) has been confirmed to (\d{4}-\d{2}-\d{2})\.\s*(.*)$/is
  );
  if (confirmedMatch) {
    const requestNo = confirmedMatch[1].trim() || fallbackRequestNo;
    const main = translateService.instant('notifications.messages.supplyPickupDateConfirmed', {
      requestNo,
      date: confirmedMatch[2]
    });
    const suffix = confirmedMatch[3]?.trim();
    return suffix ? `${main} ${suffix}` : main;
  }

  return null;
}

function translateWorkflowRequestActionMessage(
  translateService: TranslateService,
  messageTrimmed: string,
  patternNoActor: RegExp,
  patternWithActor: RegExp,
  messageKey: string
): string | null {
  let m = messageTrimmed.match(patternNoActor);
  let commentsGroupIndex = 2;
  if (!m) {
    m = messageTrimmed.match(patternWithActor);
    commentsGroupIndex = 3;
  }
  if (!m) {
    return null;
  }
  const requestNo = m[1].trim();
  const comments = m[commentsGroupIndex]?.trim();
  let out = translateService.instant(messageKey, { requestNo });
  if (comments) {
    out += ' ' + translateService.instant('notifications.messages.workflowRequestCommentsAppend', { comments });
  }
  return out;
}

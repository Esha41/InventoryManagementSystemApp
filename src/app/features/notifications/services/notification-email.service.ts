import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { STORAGE_KEYS } from '@constants/app.constants';
import { Notification } from '@notifications/models/notification.model';
import { ConfigService } from '@services/config.service';
import { StorageService } from '@services/storage.service';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { EmailService } from './email.service';
import { EmailConfigurationService } from '@settings/services/email-configuration.service';
import { NotificationDetailService } from './notification-detail.service';
import { DiscardDto, OrderDto, ReturnDto } from '@models/index';
import { NotificationHubPayload } from '@core/notifications/notification-hub.types';
import { AuthenticatedUser } from '@models/auth.model';
import { extractEntityIdFromMetadata } from './notification-hub.mapper';

/**
 * Optional email notifications for SignalR-delivered items (config, enrichment, send).
 * Kept separate from {@link NotificationService} list/hub state.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationEmailService {
  private emailNotificationsEnabled = false;
  private emailConfigChecked = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly toastService: ToastService,
    private readonly translate: TranslateService,
    private readonly emailService: EmailService,
    private readonly emailConfigService: EmailConfigurationService,
    private readonly notificationDetailService: NotificationDetailService
  ) {}

  /**
   * 403/404 are expected for non–super-admin — treat as disabled, no error log.
   */
  checkEmailConfiguration(): void {
    this.emailConfigService.getEmailConfiguration().subscribe({
      next: (config) => {
        this.emailNotificationsEnabled = config?.enableEmailNotifications ?? false;
        this.emailConfigChecked = true;
      },
      error: (error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status !== 403 && status !== 404) {
          this.configService.logError('Failed to check email configuration', error);
        }
        this.emailNotificationsEnabled = false;
        this.emailConfigChecked = true;
      }
    });
  }

  setNonSuperAdminEmailDefaults(): void {
    this.emailNotificationsEnabled = false;
    this.emailConfigChecked = true;
  }

  resetOnLogout(): void {
    this.emailNotificationsEnabled = false;
    this.emailConfigChecked = false;
  }

  trySendEmailForHubEvent(
    notification: Notification,
    dto: NotificationHubPayload,
    currentUser: AuthenticatedUser | null
  ): void {
    if (!this.emailNotificationsEnabled || !this.emailConfigChecked) {
      return;
    }

    if (!currentUser) {
      this.configService.logWarning('Cannot send email notification: current user not available');
      return;
    }

    let recipientEmail: string | undefined = currentUser.email;

    if (!recipientEmail) {
      const token = this.storageService.get<string>(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1])) as { email?: string; Email?: string };
          recipientEmail = payload.email || payload.Email;
        } catch {
          // ignore
        }
      }
    }

    if (!recipientEmail) {
      this.configService.logWarning('Cannot send email notification: user email not available');
      this.showEmailSkippedWarningToast();
      return;
    }

    const emailTitle = notification.title || 'New Notification';
    const emailMessage = notification.message || 'You have received a new notification.';

    const entityType = (notification.entityType || notification.type || '').toLowerCase();
    const entityId = notification.entityId ?? extractEntityIdFromMetadata(notification);

    if (entityType && entityId != null) {
      const numericId = Number(entityId);
      if (!isNaN(numericId)) {
        this.loadEntityDtoForEmail(entityType, numericId).subscribe({
          next: (details) => {
            this.sendEmailWithDetails(recipientEmail, emailTitle, emailMessage, notification, dto, details, entityType);
          },
          error: () => {
            this.sendEmailWithDetails(recipientEmail, emailTitle, emailMessage, notification, dto, null, entityType);
          }
        });
        return;
      }
    }

    this.sendEmailWithDetails(recipientEmail, emailTitle, emailMessage, notification, dto, null, entityType);
  }

  private loadEntityDtoForEmail(
    entityType: string,
    entityId: number
  ): Observable<OrderDto | ReturnDto | DiscardDto | null> {
    return this.notificationDetailService.loadEntityDtoForEmail(entityType, entityId);
  }

  private sendEmailWithDetails(
    recipientEmail: string,
    title: string,
    message: string,
    notification: Notification,
    dto: NotificationHubPayload | null,
    details: OrderDto | ReturnDto | DiscardDto | null,
    entityType: string
  ): void {
    const emailDetails = this.buildEmailDetails(notification, dto, details, entityType);
    const enrichedMessage = this.buildDetailedMessage(message, emailDetails);

    this.emailService.sendNotificationEmail(
      recipientEmail,
      title,
      enrichedMessage,
      emailDetails,
      details,
      entityType
    ).subscribe({
      next: () => {
        this.configService.log('Email notification sent successfully', { recipientEmail, notificationId: notification.id });
      },
      error: (error: unknown) => {
        this.configService.logError('Failed to send email notification', error);
        this.showEmailSendFailedToast();
      }
    });
  }

  private buildEmailDetails(
    notification: Notification,
    dto: NotificationHubPayload | null,
    details: OrderDto | ReturnDto | DiscardDto | null,
    entityType: string
  ): Record<string, unknown> {
    const emailDetails: Record<string, unknown> = {
      'Notification ID': notification.id,
      'Type': notification.type || notification.entityType || 'General',
      'Created At': new Date(notification.createdAt).toLocaleString(),
    };
    if (notification.title) {
      emailDetails['Title'] = notification.title;
    }
    if (notification.message) {
      emailDetails['Message'] = notification.message;
    }

    if (dto) {
      if (dto.createdBy) {
        emailDetails['Created By'] = dto.createdBy;
      }
      if (dto.senderId) {
        emailDetails['Sender'] = dto.senderId;
      }
      if (dto.recipientId) {
        emailDetails['Recipient'] = dto.recipientId;
      }
      if (dto.createdAt || dto.creationDate || dto.timestamp) {
        emailDetails['Server Timestamp'] = dto.createdAt ?? dto.creationDate ?? dto.timestamp ?? '';
      }
    }

    if (details) {
      if (entityType === 'order' && this.isOrderDto(details)) {
        emailDetails['Order Number'] = details.orderNo || details.requestNo || `#${details.id}`;
        emailDetails['Department'] = details.departmentNameEn || details.departmentNameAr || 'N/A';
        emailDetails['Requester'] = details.requesterName || 'N/A';
        emailDetails['Priority'] = this.getPriorityLabel(details.priority);
        emailDetails['Status'] = this.getStatusLabel(details.status);
        if (details.requestPurposeNameEn || details.requestPurposeNameAr) {
          emailDetails['Request Purpose'] = details.requestPurposeNameEn || details.requestPurposeNameAr;
        }
        if (details.usageDateFrom) {
          const fromDate = new Date(details.usageDateFrom).toLocaleString();
          const toDate = details.usageDateTo ? new Date(details.usageDateTo).toLocaleString() : '';
          const fromTime = details.usageTimeFrom || '';
          const toTime = details.usageTimeTo || '';
          emailDetails['Usage Date'] = toDate
            ? `${fromDate} ${fromTime} - ${toDate} ${toTime}`
            : `${fromDate} ${fromTime}`;
        }
        if (details.usageLocation) {
          emailDetails['Usage Location'] = details.usageLocation;
        }
        if (details.notes) {
          emailDetails['Notes'] = details.notes;
        }
        if (details.requestItems && details.requestItems.length > 0) {
          emailDetails['Items Count'] = details.requestItems.length;
        }
      } else if (entityType === 'return' && this.isReturnDto(details)) {
        emailDetails['Return Number'] = details.requestNo || `#${details.id}`;
        emailDetails['Department'] = details.department?.nameEn || details.department?.nameAr || 'N/A';
        emailDetails['Requester'] = details.requester?.fullNameEN || details.requester?.fullNameAR || details.requester?.userName || 'N/A';
        emailDetails['Priority'] = this.getPriorityLabel(details.priority);
        emailDetails['Status'] = this.getStatusLabel(details.status);
        if (details.requestPurpose) {
          emailDetails['Request Purpose'] = details.requestPurpose.nameEn || details.requestPurpose.nameAr;
        }
        if (details.reason) {
          emailDetails['Reason'] = details.reason;
        }
        if (details.notes) {
          emailDetails['Notes'] = details.notes;
        }
        if (details.requestItems && details.requestItems.length > 0) {
          emailDetails['Items Count'] = details.requestItems.length;
        }
      } else if (entityType === 'discard' && this.isDiscardDto(details)) {
        emailDetails['Discard Number'] = details.requestNo || `#${details.id}`;
        emailDetails['Department'] = details.department?.nameEn || details.department?.nameAr || 'N/A';
        emailDetails['Requester'] = details.requester?.fullNameEN || details.requester?.fullNameAR || details.requester?.userName || 'N/A';
        emailDetails['Priority'] = this.getPriorityLabel(details.priority);
        emailDetails['Status'] = this.getStatusLabel(details.status);
        if (details.requestPurpose) {
          emailDetails['Request Purpose'] = details.requestPurpose.nameEn || details.requestPurpose.nameAr;
        }
        if (details.reason) {
          emailDetails['Reason'] = details.reason;
        }
        if (details.notes) {
          emailDetails['Notes'] = details.notes;
        }
        if (details.requestItems && details.requestItems.length > 0) {
          emailDetails['Items Count'] = details.requestItems.length;
        }
      }
    }

    const appendKeyValues = (data?: Record<string, unknown> | null, prefix?: string) => {
      if (!data) {
        return;
      }
      Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          return;
        }
        if (key === 'email') {
          return;
        }
        const label = prefix ? `${prefix} ${key}` : key;
        if (!emailDetails[label]) {
          emailDetails[label] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      });
    };

    appendKeyValues(notification.metadata as Record<string, unknown> | null);
    appendKeyValues(dto?.metadata as Record<string, unknown> | null);
    appendKeyValues(dto?.additionalData as Record<string, unknown> | null, 'Detail');

    return emailDetails;
  }

  private buildDetailedMessage(baseMessage: string, details: Record<string, unknown>): string {
    if (!details || Object.keys(details).length === 0) {
      return baseMessage;
    }

    const lines = Object.entries(details)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${this.formatDetailValue(value)}`);

    if (lines.length === 0) {
      return baseMessage;
    }

    return `${baseMessage}\n\nDetails:\n${lines.join('\n')}`;
  }

  private formatDetailValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private isOrderDto(details: unknown): details is OrderDto {
    return Boolean(details) && typeof details === 'object' && 'orderNo' in (details as object);
  }

  private isReturnDto(details: unknown): details is ReturnDto {
    return Boolean(details) && typeof details === 'object' && 'requestNo' in (details as object) && !('orderNo' in (details as object));
  }

  private isDiscardDto(details: unknown): details is DiscardDto {
    return Boolean(details) && typeof details === 'object' && 'requestNo' in (details as object) && !('orderNo' in (details as object));
  }

  private getPriorityLabel(priority: number | string): string {
    let priorityNum: number;
    if (typeof priority === 'string') {
      const priorityLower = priority.toLowerCase().trim();
      if (priorityLower === 'high' || priorityLower === '1') {
        priorityNum = 1;
      } else if (priorityLower === 'medium' || priorityLower === '2') {
        priorityNum = 2;
      } else if (priorityLower === 'low' || priorityLower === '3') {
        priorityNum = 3;
      } else if (priorityLower === 'critical' || priorityLower === '4') {
        priorityNum = 4;
      } else {
        const parsed = parseInt(priority, 10);
        priorityNum = isNaN(parsed) ? 1 : parsed;
      }
    } else {
      priorityNum = priority;
    }

    switch (priorityNum) {
      case 1:
        return 'High';
      case 2:
        return 'Medium';
      case 3:
        return 'Low';
      case 4:
        return 'Critical';
      default:
        return `Priority ${priorityNum}`;
    }
  }

  private getStatusLabel(status: number | string): string {
    let statusNum: number;
    if (typeof status === 'string') {
      const statusLower = status.toLowerCase().trim();
      if (statusLower === 'new' || statusLower === 'pending' || statusLower === '0' || statusLower === '1') {
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
      case 0:
      case 1:
        return 'New';
      case 2:
        return 'In Progress';
      case 3:
        return 'Approved';
      case 4:
        return 'Rejected';
      case 5:
        return 'Cancelled';
      default:
        return `Status ${statusNum}`;
    }
  }

  private showEmailSkippedWarningToast(): void {
    this.translate
      .get(['toast.emailNotificationSkipped', 'toast.warning'])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.warning(
          translations['toast.emailNotificationSkipped'],
          translations['toast.warning']
        );
      });
  }

  private showEmailSendFailedToast(): void {
    this.translate
      .get(['toast.failedToSendEmailNotification', 'toast.error'])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.error(
          translations['toast.failedToSendEmailNotification'],
          translations['toast.error']
        );
      });
  }
}

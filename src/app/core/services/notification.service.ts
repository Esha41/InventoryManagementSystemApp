import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject, throwError, of } from 'rxjs';
import { catchError, finalize, map, takeUntil, tap } from 'rxjs/operators';
import { API_ENDPOINTS, STORAGE_KEYS } from '@constants/app.constants';
import { Notification } from '@models/notification.model';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { StorageService } from './storage.service';
import { BackendAuthService } from './backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { ToastService } from './toast.service';
import { TranslateService } from '@ngx-translate/core';
import { EmailService } from './email.service';
import { EmailConfigurationService } from './email-configuration.service';
import { OrderService } from './order.service';
import { ReturnService } from './return.service';
import { DiscardService } from './discard.service';
import { OrderDto } from '@models/order.model';
import { ReturnDto } from '@models/return.model';
import { DiscardDto } from '@models/discard.model';

interface NotificationDto {
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

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  public readonly notifications$ = this.notificationsSubject.asObservable();
  public readonly unreadCount$ = this.unreadCountSubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();

  private hubConnection?: HubConnection;
  private initialized = false;
  private destroy$ = new Subject<void>();
  private currentUser: AuthenticatedUser | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private emailNotificationsEnabled: boolean = false;
  private emailConfigChecked: boolean = false;

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService,
    private readonly authService: BackendAuthService,
    private readonly storageService: StorageService,
    private readonly toastService: ToastService,
    private readonly translate: TranslateService,
    private readonly ngZone: NgZone,
    private readonly emailService: EmailService,
    private readonly emailConfigService: EmailConfigurationService,
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService
  ) {
    // Moved checkEmailConfiguration to initialize() to avoid 401 on login page
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          const hasUserChanged = this.currentUser?.id !== user.id;
          this.currentUser = user;

          if (hasUserChanged) {
            this.stopHubConnection();
            this.loadInitialData();
            this.startHubConnection();

            // Only check email config when user can access it (super admin). Others get 403.
            if (this.authService.isSuperAdmin()) {
              this.checkEmailConfiguration();
            } else {
              this.emailNotificationsEnabled = false;
              this.emailConfigChecked = true;
            }
          }
        } else {
          this.currentUser = null;
          this.stopHubConnection();
          this.notificationsSubject.next([]);
          this.unreadCountSubject.next(0);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopHubConnection();
  }

  refresh(): void {
    this.loadInitialData();
  }

  markAsRead(id: number): Observable<void> {
    const notifications = this.notificationsSubject.getValue();
    const notification = notifications.find(item => item.id === id);

    if (!notification) {
      return of(void 0);
    }

    const wasUnread = !notification.isRead;

    const endpoint = API_ENDPOINTS.NOTIFICATIONS.MARK_AS_READ(id);

    return this.apiService.patch<void>(endpoint, {})
      .pipe(
        catchError(error => {
          if (error?.status === 405) {
            return this.apiService.post<void>(endpoint, {});
          }
          return throwError(() => error);
        }),
        tap(() => {
          // Check if notification was unread BEFORE we update it
          const notifications = this.notificationsSubject.getValue();
          const notification = notifications.find(item => item.id === id);
          const wasUnread = notification ? !notification.isRead : false;

          // Update the notification to mark it as read
          this.applyNotificationUpdate(id, { isRead: true });

          // Only decrement count if it was actually unread
          if (wasUnread) {
            this.decrementUnreadCount();
          }
        }),
        map(() => void 0),
        catchError(error => {
          this.toastService.error(error.message || 'Failed to mark notification as read.');
          return throwError(() => error);
        })
      );
  }

  markAllAsRead(): Observable<void> {
    const endpoint = API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_AS_READ;

    return this.apiService.patch<void>(endpoint, {})
      .pipe(
        catchError(error => {
          if (error?.status === 405) {
            return this.apiService.post<void>(endpoint, {});
          }
          return throwError(() => error);
        }),
        tap(() => {
          const updated = this.notificationsSubject.getValue().map(notification => ({
            ...notification,
            isRead: true
          }));
          this.notificationsSubject.next(updated);
          this.unreadCountSubject.next(0);
        }),
        map(() => void 0),
        catchError(error => {
          this.toastService.error(error.message || 'Failed to mark all notifications as read.');
          return throwError(() => error);
        })
      );
  }

  confirmPickup(id: number): Observable<void> {
    const notification = this.getNotificationById(id);
    const endpoint = this.resolveActionEndpoint(notification, [
      'confirmPickupUrl',
      'confirmUrl',
      'confirmEndpoint',
      'confirm'
    ]) ?? API_ENDPOINTS.NOTIFICATIONS.CONFIRM_PICKUP(id);

    return this.apiService.post<void>(endpoint, {})
      .pipe(
        tap(() => {
          this.toastService.success(
            this.translate.instant('notifications.pickupConfirmed') || 'Pick-up confirmed.'
          );
          this.applyNotificationUpdate(id, {
            metadata: {
              ...(notification?.metadata ?? {}),
              confirmed: true
            }
          });
        }),
        map(() => void 0),
        catchError(error => {
          this.configService.logError('Failed to confirm pick-up.', error);
          return throwError(() => error);
        })
      );
  }

  proposeNewTime(id: number, payload: { pickupDate: string; pickupTime: string }): Observable<void> {
    const notification = this.getNotificationById(id);
    const endpoint = this.resolveActionEndpoint(notification, [
      'proposeNewTimeUrl',
      'rescheduleUrl',
      'scheduleUrl',
      'proposeUrl',
      'updateScheduleUrl'
    ]) ?? API_ENDPOINTS.NOTIFICATIONS.PROPOSE_NEW_TIME(id);

    const applySuccessUpdates = () => {
      const updatedMetadata = {
        ...(notification?.metadata ?? {}),
        pickupDate: payload.pickupDate,
        pickupTime: payload.pickupTime,
        proposedDate: payload.pickupDate,
        proposedTime: payload.pickupTime,
        confirmed: false
      };
      this.applyNotificationUpdate(id, { metadata: updatedMetadata });
      this.toastService.success(
        this.translate.instant('notifications.proposeSuccess') || 'New pick-up time proposed.'
      );
    };

    return this.apiService.post<void>(endpoint, payload).pipe(
      tap(() => applySuccessUpdates()),
      map(() => void 0),
      catchError(error => {
        const isNotFound =
          error?.status === 404 ||
          (typeof error?.message === 'string' && error.message.includes('Resource not found'));

        if (isNotFound) {
          applySuccessUpdates();
          return of(void 0);
        }
        const message = error?.message || this.translate.instant('notifications.proposeFailed') || 'Failed to propose new time.';
        this.toastService.error(message);
        return throwError(() => error);
      })
    );
  }

  private loadInitialData(): void {
    if (!this.currentUser) {
      return;
    }

    this.loadNotifications();
    this.loadUnreadCount();
  }

  private loadNotifications(): void {
    this.loadingSubject.next(true);

    this.apiService.get<any>(API_ENDPOINTS.NOTIFICATIONS.BASE)
      .pipe(finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (response) => {
          const items: NotificationDto[] = Array.isArray(response)
            ? response
            : (response ?? []);

          const notifications = (items || []).map(dto => this.mapDtoToNotification(dto));
          notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.notificationsSubject.next(notifications);
        },
        error: (error) => {
          this.toastService.error(error.message || 'Failed to load notifications.');
        }
      });
  }

  private loadUnreadCount(): void {
    this.apiService.get<any>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT)
      .subscribe({
        next: (response) => {
          const count = typeof response === 'number' ? response : response ?? 0;
          this.unreadCountSubject.next(count ?? 0);
        },
        error: (error) => {
          this.toastService.error(error.message || 'Failed to load unread notifications count.');
        }
      });
  }

  private startHubConnection(): void {
    if (!this.currentUser || this.hubConnection || !this.configService.notificationHubUrl) {
      return;
    }

    const token = this.storageService.get<string>(STORAGE_KEYS.AUTH_TOKEN) ?? '';
    const hubUrl = this.buildHubUrl();

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(this.configService.isProduction ? LogLevel.Error : LogLevel.Information)
      .build();

    this.hubConnection.on('NotificationReceived', (payload: NotificationDto) => {
      this.ngZone.run(() => this.handleIncomingNotification(payload));
    });

    this.hubConnection.on('UnreadCountUpdated', (count: number) => {
      this.ngZone.run(() => {
        this.unreadCountSubject.next(count ?? 0);
      });
    });

    this.hubConnection.onreconnected(() => {
      this.ngZone.run(() => {
        this.joinUserGroup().catch(() => undefined);
      });
    });

    this.hubConnection.onclose(() => {
      this.configService.logWarning('Notification hub connection closed. Attempting to reconnect...');
      this.scheduleReconnect();
    });

    this.hubConnection.start()
      .then(() => {
        this.configService.log('Notification hub connected successfully');
        this.joinUserGroup().catch((err) => {
          this.configService.logError('Failed to join user group', err);
        });
      })
      .catch((error: unknown) => {
        this.configService.logError('Failed to start notification hub connection', error);
        this.scheduleReconnect();
      });
  }

  private stopHubConnection(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.hubConnection) {
      this.leaveUserGroup()
        .finally(() => {
          this.hubConnection?.stop().catch(() => undefined);
          this.hubConnection = undefined;
        });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId || !this.currentUser) {
      return;
    }

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.stopHubConnection();
      this.startHubConnection();
    }, 5000);
  }

  private handleIncomingNotification(dto: NotificationDto): void {
    const notification = this.mapDtoToNotification(dto);
    const current = this.notificationsSubject.getValue();
    const updated = [notification, ...current.filter(item => item.id !== notification.id)];

    updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.notificationsSubject.next(updated);

    if (!notification.isRead) {
      this.unreadCountSubject.next(this.unreadCountSubject.getValue() + 1);
    }

    const toastMessage = notification.message || notification.title || 'New notification';
    const toastTitle = notification.title || 'Notification';
    this.toastService.info(toastMessage, toastTitle);



    // Send email notification if enabled
    this.sendEmailNotification(notification, dto);
  }

  /**
   * Check if email notifications are enabled.
   * 403/404 are expected (user lacks permission or config not set) - treat as disabled, no log.
   */
  private checkEmailConfiguration(): void {
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

  /**
   * Send email notification when a notification is received
   */
  private sendEmailNotification(notification: Notification, dto: NotificationDto): void {

    // Only send email if email notifications are enabled
    if (!this.emailNotificationsEnabled) {
      return;
    }

    if (!this.emailConfigChecked) {
      return;
    }

    // Notifications received via SignalR are typically for the current user
    // Use current user's email if available
    if (!this.currentUser) {
      this.configService.logWarning('Cannot send email notification: current user not available');
      return;
    }

    // Try to get email from current user, or from token payload as fallback
    let recipientEmail = this.currentUser.email;

    if (!recipientEmail) {
      // Try to get email from JWT token payload as fallback
      const token = this.storageService.get<string>(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          recipientEmail = payload.email || payload.Email;
        } catch (e) {
          // Failed to parse token
        }
      }
    }

    if (!recipientEmail) {
      this.configService.logWarning('Cannot send email notification: user email not available');
      this.translate.get(['toast.emailNotificationSkipped', 'toast.warning']).subscribe(translations => {
        this.toastService.warning(translations['toast.emailNotificationSkipped'], translations['toast.warning']);
      });
      return;
    }

    const emailTitle = notification.title || 'New Notification';
    const emailMessage = notification.message || 'You have received a new notification.';

    // Fetch detailed information based on entity type
    const entityType = (notification.entityType || notification.type || '').toLowerCase();
    const entityId = notification.entityId ?? this.extractEntityIdFromMetadata(notification);

    if (entityType && entityId != null) {
      const numericId = Number(entityId);
      if (!isNaN(numericId)) {
        // Fetch detailed information and then send email
        this.fetchEntityDetails(entityType, numericId).subscribe({
          next: (details) => {
            this.sendEmailWithDetails(recipientEmail, emailTitle, emailMessage, notification, dto, details, entityType);
          },
          error: (error) => {
            // Send email with basic information if detailed fetch fails
            this.sendEmailWithDetails(recipientEmail, emailTitle, emailMessage, notification, dto, null, entityType);
          }
        });
        return;
      }
    }

    // Send email with basic information if no entity details available
    this.sendEmailWithDetails(recipientEmail, emailTitle, emailMessage, notification, dto, null, entityType);
  }

  /**
   * Extract entity ID from notification metadata
   */
  private extractEntityIdFromMetadata(notification: Notification): number | null {
    if (!notification.metadata) {
      return null;
    }

    const metadata = notification.metadata as Record<string, any>;
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

  /**
   * Fetch detailed information for order, return, discard, or workflow
   */
  private fetchEntityDetails(entityType: string, entityId: number): Observable<OrderDto | ReturnDto | DiscardDto | null> {
    switch (entityType) {
      case 'order':
        return this.orderService.getOrderById(entityId).pipe(
          catchError(() => of(null))
        );
      case 'return':
        return this.returnService.getReturnById(entityId).pipe(
          catchError(() => of(null))
        );
      case 'discard':
        return this.discardService.getDiscardById(entityId).pipe(
          catchError(() => of(null))
        );
      default:
        return of(null);
    }
  }

  /**
   * Send email with detailed information
   */
  private sendEmailWithDetails(
    recipientEmail: string,
    title: string,
    message: string,
    notification: Notification,
    dto: NotificationDto | null,
    details: OrderDto | ReturnDto | DiscardDto | null,
    entityType: string
  ): void {
    // Build email details
    const emailDetails = this.buildEmailDetails(notification, dto, details, entityType);

    // Send email asynchronously (don't block notification handling)
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
      error: (error) => {
        // Log error but don't block notification flow
        this.configService.logError('Failed to send email notification', error);
        // Show user-friendly error message
        this.translate.get(['toast.failedToSendEmailNotification', 'toast.error']).subscribe(translations => {
          this.toastService.error(translations['toast.failedToSendEmailNotification'], translations['toast.error']);
        });
      }
    });
  }

  /**
   * Build email details object from notification and entity details
   */
  private buildEmailDetails(
    notification: Notification,
    dto: NotificationDto | null,
    details: OrderDto | ReturnDto | DiscardDto | null,
    entityType: string
  ): Record<string, any> {
    const emailDetails: Record<string, any> = {
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

    // Add entity-specific details
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

    // Add metadata if available
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

    appendKeyValues(notification.metadata);
    appendKeyValues(dto?.metadata);
    appendKeyValues(dto?.additionalData, 'Detail');

    return emailDetails;
  }

  private buildDetailedMessage(baseMessage: string, details: Record<string, any>): string {
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

  private formatDetailValue(value: any): string {
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

  /**
   * Type guards for DTOs
   */
  private isOrderDto(details: any): details is OrderDto {
    return details && 'orderNo' in details;
  }

  private isReturnDto(details: any): details is ReturnDto {
    return details && 'requestNo' in details && !('orderNo' in details);
  }

  private isDiscardDto(details: any): details is DiscardDto {
    return details && 'requestNo' in details && !('orderNo' in details);
  }

  /**
   * Get priority label
   * Handles both number and string priority values
   */
  private getPriorityLabel(priority: number | string): string {
    // Normalize to number
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

  /**
   * Get status label
   * Handles both number and string status values
   */
  private getStatusLabel(status: number | string): string {
    // Normalize to number
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

  private mapDtoToNotification(dto: NotificationDto): Notification {
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

  private getNotificationById(id: number): Notification | undefined {
    return this.notificationsSubject.getValue().find(notification => notification.id === id);
  }

  private resolveActionEndpoint(notification: Notification | undefined, keys: string[]): string | null {
    if (!notification?.metadata) {
      return null;
    }

    const metadata = notification.metadata;
    const actions = (metadata['actions'] ?? metadata['actionUrls']) as Record<string, any> | undefined;

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

  private applyNotificationUpdate(id: number, changes: Partial<Notification>): void {
    const current = this.notificationsSubject.getValue();
    const index = current.findIndex(notification => notification.id === id);

    if (index === -1) {
      return;
    }

    const updated = [...current];
    updated[index] = {
      ...updated[index],
      ...changes
    };

    this.notificationsSubject.next(updated);
  }

  private decrementUnreadCount(): void {
    const current = this.unreadCountSubject.getValue();
    this.unreadCountSubject.next(Math.max(0, current - 1));
  }

  private buildHubUrl(): string {
    const base = this.configService.notificationHubUrl;
    if (!base) {
      return '';
    }

    if (!this.currentUser) {
      return base;
    }

    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}userId=${encodeURIComponent(this.currentUser.id)}`;
  }

  private joinUserGroup(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected || !this.currentUser?.id) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke('JoinUserGroup', this.currentUser.id);
  }

  private leaveUserGroup(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected || !this.currentUser?.id) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke('LeaveUserGroup', this.currentUser.id).catch(() => undefined);
  }
}

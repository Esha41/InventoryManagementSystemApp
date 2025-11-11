import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { API_ENDPOINTS, STORAGE_KEYS } from '@constants/app.constants';
import { Notification } from '@pages/notifications/models/notification.model';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { BackendAuthService } from './backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { ToastService } from './toast.service';

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
  metadata?: Record<string, any> | null;
  additionalData?: Record<string, any> | null;
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
  private reconnectTimeoutId: any = null;

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService,
    private readonly authService: BackendAuthService,
    private readonly toastService: ToastService,
    private readonly ngZone: NgZone
  ) {}

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
    const notification = this.notificationsSubject.getValue().find(item => item.id === id);
    const wasUnread = notification ? !notification.isRead : false;

    const endpoint = API_ENDPOINTS.NOTIFICATIONS.MARK_AS_READ(id);

    return this.apiService.patchWithAuth(endpoint, {})
      .pipe(
        catchError(error => {
          if (error?.status === 405) {
            return this.apiService.postWithAuth(endpoint, {});
          }
          return throwError(() => error);
        }),
        tap(() => {
          this.applyNotificationUpdate(id, { isRead: true });
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

    return this.apiService.patchWithAuth(endpoint, {})
      .pipe(
        catchError(error => {
          if (error?.status === 405) {
            return this.apiService.postWithAuth(endpoint, {});
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

  private loadInitialData(): void {
    if (!this.currentUser) {
      return;
    }

    this.loadNotifications();
    this.loadUnreadCount();
  }

  private loadNotifications(): void {
    this.loadingSubject.next(true);

    this.apiService.getWithAuth<any>(API_ENDPOINTS.NOTIFICATIONS.BASE)
      .pipe(finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (response) => {
          const items: NotificationDto[] = Array.isArray(response)
            ? response
            : (response?.data ?? []);

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
    this.apiService.getWithAuth<any>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT)
      .subscribe({
        next: (response) => {
          const count = typeof response === 'number' ? response : response?.data ?? 0;
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

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ?? '';
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
      this.ngZone.run(() => this.unreadCountSubject.next(count ?? 0));
    });

    this.hubConnection.onclose(() => {
      this.configService.logWarning('Notification hub connection closed. Attempting to reconnect...');
      this.scheduleReconnect();
    });

    this.hubConnection.start()
      .then(() => {
        this.configService.log('Notification hub connected');
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
      this.hubConnection.stop().catch(() => undefined);
      this.hubConnection = undefined;
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
}

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, throwError, of } from 'rxjs';
import { catchError, finalize, map, takeUntil, tap } from 'rxjs/operators';
import { API_ENDPOINTS } from '@constants/app.constants';
import { Notification } from '@notifications/models/notification.model';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { AuthenticatedUser } from '@models/auth.model';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { NotificationHubService } from '@core/notifications/notification-hub.service';
import { NotificationHubPayload } from '@core/notifications/notification-hub.types';
import { AppNotificationsBootstrap } from '@core/notifications/app-notifications-bootstrap.token';
import { mapHubPayloadToNotification, resolveNotificationActionEndpoint } from './notification-hub.mapper';
import { NotificationEmailService } from './notification-email.service';

/**
 * In-app notifications: list state, SignalR hub subscription, read/actions.
 * Email side effects live in {@link NotificationEmailService}; DTO mapping in `notification-hub.mapper`.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy, AppNotificationsBootstrap {
  private readonly notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  public readonly notifications$ = this.notificationsSubject.asObservable();
  public readonly unreadCount$ = this.unreadCountSubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();

  private initialized = false;
  private destroy$ = new Subject<void>();
  private currentUser: AuthenticatedUser | null = null;

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService,
    private readonly authService: BackendAuthService,
    private readonly toastService: ToastService,
    private readonly translate: TranslateService,
    private readonly notificationHub: NotificationHubService,
    private readonly notificationEmail: NotificationEmailService
  ) {}

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    this.notificationHub.notificationReceived$
      .pipe(takeUntil(this.destroy$))
      .subscribe(payload => this.handleIncomingNotification(payload));

    this.notificationHub.unreadCountUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.unreadCountSubject.next(count ?? 0));

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          const hasUserChanged = this.currentUser?.id !== user.id;
          this.currentUser = user;

          if (hasUserChanged) {
            this.notificationHub.restartForUser(user.id);
            this.loadInitialData();

            if (this.authService.isSuperAdmin()) {
              this.notificationEmail.checkEmailConfiguration();
            } else {
              this.notificationEmail.setNonSuperAdminEmailDefaults();
            }
          }
        } else {
          this.currentUser = null;
          this.notificationEmail.resetOnLogout();
          this.notificationHub.stop();
          this.notificationsSubject.next([]);
          this.unreadCountSubject.next(0);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationHub.stop();
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
          const notifications = this.notificationsSubject.getValue();
          const notification = notifications.find(item => item.id === id);
          const wasUnread = notification ? !notification.isRead : false;

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
    const endpoint = resolveNotificationActionEndpoint(notification, [
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
    const endpoint = resolveNotificationActionEndpoint(notification, [
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

    this.apiService.get<unknown>(API_ENDPOINTS.NOTIFICATIONS.BASE)
      .pipe(finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (response) => {
          const items: NotificationHubPayload[] = Array.isArray(response)
            ? response
            : (response as NotificationHubPayload[]) ?? [];

          const notifications = (items || []).map(dto => mapHubPayloadToNotification(dto));
          notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          this.notificationsSubject.next(notifications);
        },
        error: (error) => {
          this.toastService.error(error.message || 'Failed to load notifications.');
        }
      });
  }

  private loadUnreadCount(): void {
    this.apiService.get<unknown>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT)
      .subscribe({
        next: (response) => {
          const count = typeof response === 'number' ? response : (response as number) ?? 0;
          this.unreadCountSubject.next(count ?? 0);
        },
        error: (error) => {
          this.toastService.error(error.message || 'Failed to load unread notifications count.');
        }
      });
  }

  private handleIncomingNotification(dto: NotificationHubPayload): void {
    const notification = mapHubPayloadToNotification(dto);
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

    this.notificationEmail.trySendEmailForHubEvent(notification, dto, this.currentUser);
  }

  private getNotificationById(id: number): Notification | undefined {
    return this.notificationsSubject.getValue().find(notification => notification.id === id);
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
}

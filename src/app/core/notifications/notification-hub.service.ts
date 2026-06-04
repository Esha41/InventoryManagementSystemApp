import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { STORAGE_KEYS } from '@constants/app.constants';
import { ConfigService } from '@services/config.service';
import { StorageService } from '@services/storage.service';
import { NotificationHubPayload } from './notification-hub.types';

/**
 * SignalR connection to the notification hub only — no domain mapping, toasts, or HTTP.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationHubService implements OnDestroy {
  private readonly notificationReceivedSubject = new Subject<NotificationHubPayload>();
  private readonly unreadCountUpdatedSubject = new Subject<number>();
  private readonly workflowStateChangedSubject = new Subject<number>();

  readonly notificationReceived$: Observable<NotificationHubPayload> =
    this.notificationReceivedSubject.asObservable();
  readonly unreadCountUpdated$: Observable<number> = this.unreadCountUpdatedSubject.asObservable();
  /** Emits the requestId whose workflow state changed server-side; subscribers re-fetch that request. */
  readonly workflowStateChanged$: Observable<number> = this.workflowStateChangedSubject.asObservable();

  private hubConnection?: HubConnection;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activeUserId: string | null = null;
  /** Request groups this client wants to be in; re-joined after every (re)connect. */
  private readonly joinedRequestGroups = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly ngZone: NgZone
  ) {}

  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * Tear down the hub and clear the active user.
   */
  stop(): void {
    this.activeUserId = null;
    this.joinedRequestGroups.clear();
    this.disconnectSocket();
  }

  /**
   * Subscribe to live workflow-state updates for a single request (call when a request detail page
   * opens). Idempotent and reconnect-safe: the group is tracked and re-joined after any reconnect.
   */
  joinRequestGroup(requestId: string | number): void {
    const key = String(requestId);
    if (!key) {
      return;
    }
    this.joinedRequestGroups.add(key);
    this.invokeIfConnected('JoinRequestGroup', key);
  }

  /** Stop receiving live updates for a request (call when the detail page is destroyed). */
  leaveRequestGroup(requestId: string | number): void {
    const key = String(requestId);
    if (!this.joinedRequestGroups.delete(key)) {
      return;
    }
    this.invokeIfConnected('LeaveRequestGroup', key);
  }

  private rejoinRequestGroups(): void {
    for (const key of this.joinedRequestGroups) {
      this.invokeIfConnected('JoinRequestGroup', key);
    }
  }

  private invokeIfConnected(method: string, arg: string): void {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      this.hubConnection.invoke(method, arg).catch(() => undefined);
    }
  }

  /**
   * Reconnect the hub for a new user session (or stop if userId is null).
   */
  restartForUser(userId: string | null): void {
    // A new user session must not inherit the previous user's request-group subscriptions.
    this.joinedRequestGroups.clear();
    this.disconnectSocket();

    if (!userId || !this.configService.notificationHubUrl) {
      this.activeUserId = null;
      return;
    }

    this.activeUserId = userId;
    this.openConnection(userId);
  }

  /** Stops SignalR without clearing {@link activeUserId} (used for user switches and reconnect). */
  private disconnectSocket(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (!this.hubConnection) {
      return;
    }

    const hub = this.hubConnection;
    const userId = this.activeUserId;
    this.hubConnection = undefined;

    const leave =
      userId && hub.state === HubConnectionState.Connected
        ? hub.invoke('LeaveUserGroup', userId).catch(() => undefined)
        : Promise.resolve();

    leave.finally(() => {
      hub.stop().catch(() => undefined);
    });
  }

  private openConnection(userId: string): void {
    if (this.hubConnection) {
      return;
    }

    const token = this.storageService.get<string>(STORAGE_KEYS.AUTH_TOKEN) ?? '';
    const hubUrl = this.buildHubUrl(userId);

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(this.configService.isProduction ? LogLevel.Error : LogLevel.Information)
      .build();

    this.hubConnection.on('NotificationReceived', (payload: NotificationHubPayload) => {
      this.ngZone.run(() => this.notificationReceivedSubject.next(payload));
    });

    this.hubConnection.on('UnreadCountUpdated', (count: number) => {
      this.ngZone.run(() => {
        this.unreadCountUpdatedSubject.next(count ?? 0);
      });
    });

    this.hubConnection.on('WorkflowStateChanged', (payload: { requestId?: number | string }) => {
      const requestId = Number(payload?.requestId);
      if (!Number.isFinite(requestId)) {
        return;
      }
      this.ngZone.run(() => this.workflowStateChangedSubject.next(requestId));
    });

    this.hubConnection.onreconnected(() => {
      this.ngZone.run(() => {
        this.joinUserGroup(userId).catch(() => undefined);
        this.rejoinRequestGroups();
      });
    });

    this.hubConnection.onclose(() => {
      this.configService.logWarning('Notification hub connection closed. Attempting to reconnect...');
      this.scheduleReconnect(userId);
    });

    this.hubConnection
      .start()
      .then(() => {
        this.configService.log('Notification hub connected successfully');
        this.joinUserGroup(userId).catch(err => {
          this.configService.logError('Failed to join user group', err);
        });
        this.rejoinRequestGroups();
      })
      .catch((error: unknown) => {
        this.configService.logError('Failed to start notification hub connection', error);
        this.scheduleReconnect(userId);
      });
  }

  private scheduleReconnect(userId: string): void {
    if (this.reconnectTimeoutId || !this.activeUserId) {
      return;
    }

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.activeUserId) {
        return;
      }
      this.disconnectSocket();
      this.openConnection(userId);
    }, 5000);
  }

  private buildHubUrl(userId: string): string {
    const base = this.configService.notificationHubUrl;
    if (!base) {
      return '';
    }

    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}userId=${encodeURIComponent(userId)}`;
  }

  private joinUserGroup(userId: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return Promise.resolve();
    }

    return this.hubConnection.invoke('JoinUserGroup', userId);
  }
}

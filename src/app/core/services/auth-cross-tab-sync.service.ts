import { Injectable, Injector, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { BackendAuthService } from './backend-auth.service';
import { AuthSessionService } from './auth-session.service';
import { ConfigService } from './config.service';
import { StorageService } from './storage.service';

type AuthSyncMessage = { type: 'auth-session-changed' } | { type: 'auth-logged-out' };

/**
 * Keeps auth state aligned across tabs: shared httpOnly refresh cookie + localStorage (when enabled)
 * can otherwise desync from in-memory session and cause repeated refresh/API churn.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthCrossTabSyncService {
  private readonly channelName = 'ettad-auth-sync';
  private channel: BroadcastChannel | null = null;
  private peerLogoutTimer: ReturnType<typeof setTimeout> | null = null;
  private peerSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 200;
  private restoreInProgress = false;

  constructor(
    private readonly session: AuthSessionService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly injector: Injector,
    private readonly ngZone: NgZone
  ) {
    if (typeof window === 'undefined') {
      return;
    }
    this.initBroadcastChannel();
    this.initStorageListener();
  }

  /** Call after this tab establishes a full authenticated session (login / select-role). */
  notifyAuthenticatedSessionChanged(): void {
    try {
      this.channel?.postMessage({ type: 'auth-session-changed' } satisfies AuthSyncMessage);
    } catch {
      // ignore
    }
  }

  /** Call after this tab completes logout (local session cleared). */
  notifyLoggedOut(): void {
    try {
      this.channel?.postMessage({ type: 'auth-logged-out' } satisfies AuthSyncMessage);
    } catch {
      // ignore
    }
  }

  private initBroadcastChannel(): void {
    try {
      if (typeof BroadcastChannel === 'undefined') {
        return;
      }
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (ev: MessageEvent<AuthSyncMessage>) => {
        this.ngZone.run(() => this.onPeerMessage(ev.data));
      };
    } catch {
      this.channel = null;
    }
  }

  private initStorageListener(): void {
    if (!this.configService.persistAuthAcrossSessions) {
      return;
    }
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.storageArea !== localStorage) {
        return;
      }
      if (this.restoreInProgress) {
        return;
      }
      if (e.key === null) {
        this.ngZone.run(() => this.schedulePeerLogout());
        return;
      }
      if (e.key !== 'auth_token' && e.key !== 'current_user') {
        return;
      }
      this.ngZone.run(() => {
        if (!e.newValue && (e.key === 'auth_token' || e.key === 'current_user')) {
          this.schedulePeerLogout();
          return;
        }
        this.schedulePeerSessionChange();
      });
    });
  }

  private schedulePeerSessionChange(): void {
    this.debounceSync(() => this.applyPeerSessionChange());
  }

  private schedulePeerLogout(): void {
    this.debounceLogout(() => this.applyPeerLogout());
  }

  private onPeerMessage(data: AuthSyncMessage | unknown): void {
    if (!data || typeof data !== 'object' || !('type' in data)) {
      return;
    }
    const type = (data as { type: string }).type;
    if (type === 'auth-logged-out') {
      this.schedulePeerLogout();
    } else if (type === 'auth-session-changed') {
      this.schedulePeerSessionChange();
    }
  }

  private debounceLogout(fn: () => void): void {
    if (this.peerLogoutTimer !== null) {
      clearTimeout(this.peerLogoutTimer);
    }
    this.peerLogoutTimer = setTimeout(() => {
      this.peerLogoutTimer = null;
      fn();
    }, this.debounceMs);
  }

  private debounceSync(fn: () => void): void {
    if (this.peerSyncTimer !== null) {
      clearTimeout(this.peerSyncTimer);
    }
    this.peerSyncTimer = setTimeout(() => {
      this.peerSyncTimer = null;
      fn();
    }, this.debounceMs);
  }

  private applyPeerLogout(): void {
    if (this.session.logoutInProgress) {
      return;
    }
    if (this.restoreInProgress) {
      return;
    }
    if (!this.session.isAuthenticated()) {
      return;
    }
    this.session.clearSession();
    const router = this.injector.get(Router);
    void router.navigate(['/auth/login']);
  }

  private applyPeerSessionChange(): void {
    if (this.session.logoutInProgress) {
      return;
    }
    if (this.restoreInProgress) {
      return;
    }
    this.restoreInProgress = true;
    try {
      const storedUser = this.storageService.get<{ id?: string }>('current_user');
      const localUser = this.session.getCurrentUser();
      const storedUserId = String(storedUser?.id ?? '').trim();
      const localUserId = String(localUser?.id ?? '').trim();

      if (localUserId && storedUserId && localUserId === storedUserId) {
        this.restoreInProgress = false;
        return;
      }

      if (localUserId && storedUserId && localUserId !== storedUserId) {
        // Peer now owns the storage; clear only our in-memory state so we don't
        // wipe the peer's freshly-written tokens (which would cascade-logout the peer).
        this.session.clearInMemorySession();
        const router = this.injector.get(Router);
        void router.navigate(['/auth/login'], { queryParams: { sessionConflict: 'true' } });
        this.restoreInProgress = false;
        return;
      }

      const backendAuth = this.injector.get(BackendAuthService);
      backendAuth
        .restoreSessionSilently()
        .pipe(
          finalize(() => {
            this.restoreInProgress = false;
          })
        )
        .subscribe(restored => {
          if (!restored) {
            const router = this.injector.get(Router);
            void router.navigate(['/auth/login'], { queryParams: { sessionConflict: 'true' } });
          }
        });
    } catch {
      this.restoreInProgress = false;
    }
  }
}

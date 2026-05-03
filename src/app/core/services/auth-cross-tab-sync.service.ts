import { Injectable, Injector, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BackendAuthService } from './backend-auth.service';
import { AuthSessionService } from './auth-session.service';
import { ConfigService } from './config.service';

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

  constructor(
    private readonly session: AuthSessionService,
    private readonly configService: ConfigService,
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
    if (!this.session.isAuthenticated()) {
      return;
    }
    this.session.clearSession();
    const router = this.injector.get(Router);
    void router.navigate(['/auth/login']);
  }

  /**
   * Another tab rotated auth storage or finished login; clear local in-memory state and rebuild from cookie.
   */
  private applyPeerSessionChange(): void {
    if (this.session.logoutInProgress) {
      return;
    }
    const backendAuth = this.injector.get(BackendAuthService);
    if (this.session.isAuthenticated()) {
      this.session.clearSession();
    }
    backendAuth.restoreSessionSilently().subscribe(restored => {
      if (!restored) {
        const router = this.injector.get(Router);
        void router.navigate(['/auth/login'], { queryParams: { sessionConflict: 'true' } });
      }
    });
  }
}

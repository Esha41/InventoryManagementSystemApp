import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, Subscription, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BackendAuthService } from './backend-auth.service';
import { ConfigService } from './config.service';
import { StorageService } from './storage.service';
import { environment } from '@environments/environment';

export interface IdleState {
  isWarning: boolean;
  secondsRemaining: number;
}

@Injectable({
  providedIn: 'root'
})
export class IdleService implements OnDestroy {
  /**
   * No user activity for this long → show modal, then the configured countdown seconds before logout.
   * Independent of JWT in appsettings (token expiry is server time; this is client idle UX).
   */
  private readonly IDLE_TIMEOUT_MS =
    (environment.idleWarningAfterMinutes ?? 15) * 60 * 1000;
  private readonly countdownSeconds = environment.idleLogoutCountdownSeconds ?? 60;
  /** Matches modal ring & i18n “N seconds” copy. */
  readonly logoutCountdownTotalSeconds = this.countdownSeconds;
  private readonly ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
    'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'
  ];
  private readonly THROTTLE_MS = 1000;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownSub: Subscription | null = null;
  private destroy$ = new Subject<void>();
  private enabled = false;
  private lastActivity = 0;
  private boundOnActivity: (() => void) | null = null;

  private stateSubject = new BehaviorSubject<IdleState>({
    isWarning: false,
    secondsRemaining: 0
  });
  public state$ = this.stateSubject.asObservable();

  constructor(
    private ngZone: NgZone,
    private backendAuth: BackendAuthService,
    private router: Router,
    private configService: ConfigService,
    private storageService: StorageService
  ) {}

  start(): void {
    if (this.enabled) return;
    this.enabled = true;

    this.boundOnActivity = this.onActivity.bind(this);

    this.ngZone.runOutsideAngular(() => {
      this.ACTIVITY_EVENTS.forEach(event =>
        document.addEventListener(event, this.boundOnActivity!, { passive: true })
      );
    });

    this.resetIdleTimer();
    this.configService.log('Idle detection started');
  }

  stop(): void {
    if (!this.enabled) return;
    this.enabled = false;

    if (this.boundOnActivity) {
      this.ACTIVITY_EVENTS.forEach(event =>
        document.removeEventListener(event, this.boundOnActivity!)
      );
      this.boundOnActivity = null;
    }

    this.clearIdleTimer();
    this.stopCountdown();
    this.stateSubject.next({ isWarning: false, secondsRemaining: 0 });
    this.configService.log('Idle detection stopped');
  }

  dismissWarning(): void {
    this.stopCountdown();
    this.stateSubject.next({ isWarning: false, secondsRemaining: 0 });
    this.backendAuth.resumeSessionHeartbeat();
    this.resetIdleTimer();
  }

  ngOnDestroy(): void {
    this.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onActivity(): void {
    const now = Date.now();
    if (now - this.lastActivity < this.THROTTLE_MS) return;
    this.lastActivity = now;

    if (this.stateSubject.value.isWarning) return;

    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.ngZone.run(() => this.startCountdown());
    }, this.IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private startCountdown(): void {
    this.configService.log('User idle - starting logout countdown');
    this.backendAuth.pauseSessionHeartbeat();

    let remaining = this.countdownSeconds;
    this.stateSubject.next({ isWarning: true, secondsRemaining: remaining });

    this.stopCountdown();
    this.countdownSub = timer(1000, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        remaining--;
        if (remaining <= 0) {
          this.performLogout();
        } else {
          this.stateSubject.next({ isWarning: true, secondsRemaining: remaining });
        }
      });
  }

  private stopCountdown(): void {
    if (this.countdownSub) {
      this.countdownSub.unsubscribe();
      this.countdownSub = null;
    }
  }

  private performLogout(): void {
    this.stopCountdown();
    this.stop();
    this.configService.log('Auto-logout due to inactivity');

    this.storageService.set('sessionExpired', true);

    this.backendAuth.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => {
        this.backendAuth.clearSession();
        this.router.navigate(['/auth/login']);
      }
    });
  }

  /** User chose to sign out from the idle dialog (same as countdown finishing). */
  signOutFromIdle(): void {
    this.performLogout();
  }
}

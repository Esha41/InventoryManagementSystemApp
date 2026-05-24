import { Injectable } from '@angular/core';
import { fromEvent, merge, of, Subscription, timer } from 'rxjs';
import { catchError, exhaustMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '@constants/app.constants';

/**
 * Periodic USER_CLAIMS poll to detect session invalidation (e.g. sign-in elsewhere).
 *
 * Idle detection: if the user has not interacted with the page for IDLE_THRESHOLD_MS,
 * heartbeat ticks are skipped. This prevents the refresh cycle from running silently
 * in the background and causing unexpected logouts when the user is away from the desk.
 * The poll resumes automatically on the next user interaction.
 */
@Injectable({
  providedIn: 'root'
})
export class SessionHeartbeatService {
  private sessionHeartbeatSubscription: Subscription | null = null;
  private readonly SESSION_HEARTBEAT_INTERVAL_MS = 15000;
  private readonly IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  private lastActivityTime = Date.now();

  constructor(private apiService: ApiService) {
    // Track last user interaction. Works in browser only — SSR guard via typeof window.
    if (typeof window !== 'undefined') {
      merge(
        fromEvent(window, 'mousemove'),
        fromEvent(window, 'keydown'),
        fromEvent(window, 'click'),
        fromEvent(window, 'touchstart')
      ).subscribe(() => {
        this.lastActivityTime = Date.now();
      });
    }
  }

  private get isUserIdle(): boolean {
    return Date.now() - this.lastActivityTime > this.IDLE_THRESHOLD_MS;
  }

  start(): void {
    this.stop();
    // Delay the first tick by a full interval — the login flow already fetched claims
    // immediately before calling start(), so firing at t=0 would duplicate that call.
    this.sessionHeartbeatSubscription = timer(this.SESSION_HEARTBEAT_INTERVAL_MS, this.SESSION_HEARTBEAT_INTERVAL_MS)
      .pipe(
        exhaustMap(() => {
          if (this.isUserIdle) {
            // User has been idle for more than 5 minutes — skip this tick.
            // The poll will resume on the next interval after the user interacts.
            return of(null);
          }
          return this.apiService.get<unknown>(API_ENDPOINTS.AUTH.USER_CLAIMS).pipe(catchError(() => of(null)));
        })
      )
      .subscribe();
  }

  pause(): void {
    this.stop();
  }

  resume(isAuthenticated: boolean): void {
    if (isAuthenticated) {
      this.start();
    }
  }

  private stop(): void {
    if (this.sessionHeartbeatSubscription) {
      this.sessionHeartbeatSubscription.unsubscribe();
      this.sessionHeartbeatSubscription = null;
    }
  }
}

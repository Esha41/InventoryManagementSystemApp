import { Injectable } from '@angular/core';
import { of, Subscription, timer } from 'rxjs';
import { catchError, exhaustMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '@constants/app.constants';

/**
 * Periodic USER_CLAIMS poll to detect session invalidation (e.g. sign-in elsewhere).
 */
@Injectable({
  providedIn: 'root'
})
export class SessionHeartbeatService {
  private sessionHeartbeatSubscription: Subscription | null = null;
  private readonly SESSION_HEARTBEAT_INTERVAL_MS = 15000;

  constructor(private apiService: ApiService) {}

  start(): void {
    this.stop();
    // Delay the first tick by a full interval — the login flow already fetched claims
    // immediately before calling start(), so firing at t=0 would duplicate that call.
    this.sessionHeartbeatSubscription = timer(this.SESSION_HEARTBEAT_INTERVAL_MS, this.SESSION_HEARTBEAT_INTERVAL_MS)
      .pipe(
        exhaustMap(() =>
          this.apiService.get<unknown>(API_ENDPOINTS.AUTH.USER_CLAIMS).pipe(catchError(() => of(null)))
        )
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

import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Service to notify components when request status changes
 * Following Angular best practices for cross-component communication
 */
@Injectable({
  providedIn: 'root'
})
export class RequestStatusUpdateService {
  private readonly requestStatusUpdated$ = new Subject<number>();
  private readonly requestItemsUpdated$ = new Subject<number>();

  /**
   * Observable for request status updates
   * Components can subscribe to this to refresh their data
   */
  public readonly onRequestStatusUpdated$: Observable<number> = this.requestStatusUpdated$.asObservable();

  /**
   * Observable for request items updates
   * Components can subscribe to this to refresh request items
   */
  public readonly onRequestItemsUpdated$: Observable<number> = this.requestItemsUpdated$.asObservable();

  /**
   * Notify all subscribers that a request status has been updated
   * @param requestId The ID of the request that was updated
   */
  notifyRequestStatusUpdated(requestId: number): void {
    this.requestStatusUpdated$.next(requestId);
  }

  /**
   * Notify all subscribers that request items have been updated
   * @param requestId The ID of the request whose items were updated
   */
  notifyRequestItemsUpdated(requestId: number): void {
    this.requestItemsUpdated$.next(requestId);
  }
}


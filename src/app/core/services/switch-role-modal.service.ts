import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Opens the in-app switch-role modal (hosted in main layout). Post-login flow stays on /auth/select-role. */
@Injectable({ providedIn: 'root' })
export class SwitchRoleModalService {
  private readonly openSubject = new BehaviorSubject(false);

  /** Whether the switch-role modal should be visible. */
  readonly open$ = this.openSubject.asObservable();

  isOpen(): boolean {
    return this.openSubject.value;
  }

  open(): void {
    this.openSubject.next(true);
  }

  close(): void {
    this.openSubject.next(false);
  }
}

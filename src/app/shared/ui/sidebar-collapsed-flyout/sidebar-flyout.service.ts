import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarFlyoutService {
  readonly open$ = new Subject<object>();
}

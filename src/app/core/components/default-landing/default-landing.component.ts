import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BackendAuthService } from '@services/backend-auth.service';
import { getDefaultLandingUrl } from '@utils/default-landing-route.utils';

/**
 * Resolves `/` under the main layout to the correct home (dashboard / admin / inventory / etc.).
 * Angular requires a component (or redirect) on a route; a guard-only child route is invalid (NG04014).
 */
@Component({
  selector: 'app-default-landing',
  standalone: true,
  template: ''
})
export class DefaultLandingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(BackendAuthService);

  ngOnInit(): void {
    void this.router.navigateByUrl(getDefaultLandingUrl(this.auth), { replaceUrl: true });
  }
}

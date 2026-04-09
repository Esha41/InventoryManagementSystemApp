import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * Auth guard for protecting private routes
 * Usage in routes: canActivate: [authGuard]
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const backendAuth = inject(BackendAuthService);

  if (backendAuth.isAuthenticated()) {
    return true;
  }

  return backendAuth.restoreSessionSilently().pipe(
    map(restored => {
      if (restored) {
        return true;
      }
      router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
      return false;
    })
  );
};

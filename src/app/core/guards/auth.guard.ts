import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * Auth guard for protecting private routes
 * Usage in routes: canActivate: [authGuard]
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const backendAuth = inject(BackendAuthService);

  // Check if user is authenticated
  if (backendAuth.isAuthenticated()) {
    return true;
  }

  // Redirect to login if not authenticated
  router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

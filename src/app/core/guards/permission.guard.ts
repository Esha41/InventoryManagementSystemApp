import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * Permission guard for role-based route protection
 * Usage in routes:
 * canActivate: [permissionGuard],
 * data: { permissions: ['user.view', 'user.create'] } // Any of these
 * OR
 * data: { requiredPermissions: ['user.view'], requireAll: true } // All required
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state) => {
  const router = inject(Router);
  const backendAuth = inject(BackendAuthService);

  // First check if user is authenticated
  if (!backendAuth.isAuthenticated()) {
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Get required permissions from route data
  const permissions = route.data['permissions'] as string[] | undefined;
  const requireAll = route.data['requireAll'] as boolean | undefined;

  // If no permissions specified, allow access (just need to be authenticated)
  if (!permissions || permissions.length === 0) {
    return true;
  }

  // Check if user has required permissions
  const hasPermission = requireAll
    ? backendAuth.hasAllPermissions(permissions)
    : backendAuth.hasAnyPermission(permissions);

  // Debug logging for permission checks
  const user = backendAuth.getCurrentUser();
  if (!hasPermission) {
    console.warn('Permission Guard: Access Denied', {
      route: state.url,
      requiredPermissions: permissions,
      requireAll: requireAll || false,
      userPermissions: user?.permissions?.map(p => `${p.id || ''}|${p.claimType || ''}`).filter(Boolean) || [],
      permissionChecks: permissions.map(perm => ({
        permission: perm,
        hasPermission: backendAuth.hasPermission(perm)
      })),
      userName: user?.userName
    });
  }

  if (hasPermission) {
    return true;
  }

  // User doesn't have required permissions
  router.navigate(['/dashboard'], {
    queryParams: { accessDenied: true }
  });
  
  return false;
};

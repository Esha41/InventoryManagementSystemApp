import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { map } from 'rxjs/operators';
import { BackendAuthService } from '@services/backend-auth.service';
import { ConfigService } from '@services/config.service';

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
  const configService = inject(ConfigService);

  const checkPermissions = (): boolean => {
    const permissions = route.data['permissions'] as string[] | undefined;
    const requireAll = route.data['requireAll'] as boolean | undefined;

    if (!permissions || permissions.length === 0) {
      return true;
    }

    const hasPermission = requireAll
      ? backendAuth.hasAllPermissions(permissions)
      : backendAuth.hasAnyPermission(permissions);

    const user = backendAuth.getCurrentUser();
    if (!hasPermission) {
      configService.logWarning('Permission Guard: Access Denied', {
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

    router.navigate(['/access-denied'], {
      queryParams: { returnUrl: state.url },
      replaceUrl: true
    });

    return false;
  };

  if (backendAuth.isAuthenticated() && !backendAuth.isTokenExpired()) {
    return checkPermissions();
  }

  return backendAuth.restoreSessionSilently().pipe(
    map(restored => {
      if (!restored) {
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
      return checkPermissions();
    })
  );
};

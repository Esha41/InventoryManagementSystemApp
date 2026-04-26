import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * First destination after login or when visiting `/` while authenticated.
 * Order: main dashboard → admin dashboard → inventory dashboard → manage admins → access denied.
 * Keeps inventory-only users off `/dashboard` (they lack `dashboard_view` and would hit access denied).
 */
export function getDefaultLandingUrl(auth: BackendAuthService): string {
  if (auth.hasPermission(PERMISSIONS.DASHBOARD.VIEW)) {
    return '/dashboard';
  }
  if (
    auth.hasPermission(PERMISSIONS.ADMIN.DASHBOARD.API_PAGE) ||
    auth.hasPermission(PERMISSIONS.ADMIN.DASHBOARD.PAGE) ||
    auth.hasPermission(PERMISSIONS.ADMIN.DASHBOARD.API_VIEW)
  ) {
    return '/admin/dashboard';
  }
  if (auth.hasPermission(PERMISSIONS.INVENTORY.DASHBOARD)) {
    return '/inventory-dashboard';
  }
  if (
    auth.hasPermission(PERMISSIONS.ADMIN.SYSTEM_USERS.API_PAGE) ||
    auth.hasPermission(PERMISSIONS.ADMIN.SYSTEM_USERS.PAGE)
  ) {
    return '/admin/manage-admins';
  }
  return '/access-denied';
}

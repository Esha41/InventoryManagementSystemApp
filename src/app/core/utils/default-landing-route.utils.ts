import { BackendAuthService } from '@services/backend-auth.service';

/**
 * First destination after login or when visiting `/` while authenticated.
 * Order: main dashboard → admin dashboard → inventory dashboard → manage admins → access denied.
 * Keeps inventory-only users off `/dashboard` (they lack `dashboard_view` and would hit access denied).
 */
export function getDefaultLandingUrl(auth: BackendAuthService): string {
  if (auth.hasPermission('dashboard_view')) {
    return '/dashboard';
  }
  if (
    auth.hasPermission('Permissions.AdminDashboard.Page') ||
    auth.hasPermission('admindashboard.page') ||
    auth.hasPermission('Permissions.AdminDashboard.View')
  ) {
    return '/admin-dashboard';
  }
  if (auth.hasPermission('InventoryDashboard')) {
    return '/inventory-dashboard';
  }
  if (
    auth.hasPermission('Permissions.SystemUsers.Page') ||
    auth.hasPermission('systemusers.page')
  ) {
    return '/manage-admins';
  }
  return '/access-denied';
}

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { BackendAuthService } from '@services/backend-auth.service';
import { MaintenanceService } from '@services/maintenance.service';

export const maintenanceGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(BackendAuthService);
  const maintenanceService = inject(MaintenanceService);

  if (state.url.includes('/auth/under-maintenance')) {
    return true;
  }

  if ((state.url.includes('auth/login') || state.url.startsWith('/auth/login')) && sessionStorage.getItem('maintenance_logout') === '1') {
    sessionStorage.removeItem('maintenance_logout');
    return true;
  }

  if (authService.isSuperAdmin()) {
    return true;
  }

  return true; // BYPASS: Go to admin dashboard, turn OFF maintenance, then remove this line
  /*
  return maintenanceService.getStatus().pipe(
    map(status => {
      if (status.isEnabled) {
        router.navigate(['/auth/under-maintenance'], {
          queryParams: { returnUrl: state.url },
          replaceUrl: true
        });
        return false;
      }
      return true;
    })
  );
  */
};

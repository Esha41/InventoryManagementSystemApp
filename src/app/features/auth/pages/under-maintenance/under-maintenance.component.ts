import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Construction } from 'lucide-angular';

import { BackendAuthService } from '@services/backend-auth.service';

/**
 * Under Maintenance page.
 * Shown when admin has enabled maintenance mode. Users can logout.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-under-maintenance',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  template: `
    <div class="min-h-[50vh] sm:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
        <lucide-angular [img]="Construction" class="h-7 w-7 sm:h-8 sm:w-8 text-amber-600 dark:text-amber-400"></lucide-angular>
      </div>

      <div class="space-y-2 max-w-lg px-1">
        <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text)]">
          {{ 'underMaintenance.title' | translate }}
        </h1>
        <p class="text-sm sm:text-base text-[var(--color-text-muted)]">
          {{ 'underMaintenance.message' | translate }}
        </p>
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
        <button type="button"
          class="inline-flex items-center justify-center font-medium rounded-lg px-6 py-3 text-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-brand)] cursor-pointer"
          (click)="logout()">
          {{ 'underMaintenance.logout' | translate }}
        </button>
      </div>
    </div>
  `
})
export class UnderMaintenanceComponent {
  readonly Construction = Construction;

  constructor(
    private router: Router,
    private authService: BackendAuthService
  ) {}

  logout(): void {
    sessionStorage.setItem('maintenance_logout', '1');
    this.authService.clearSession();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true }).catch(() => {
      window.location.href = '/auth/login';
    });
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';

import { BackendAuthService } from '@services/backend-auth.service';
import { ButtonComponent } from '@components/button/button.component';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, ButtonComponent],
  template: `
    <div class="min-h-[50vh] sm:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center flex-shrink-0">
        <lucide-angular [img]="AlertTriangle" class="h-7 w-7 sm:h-8 sm:w-8 text-[var(--color-error)]"></lucide-angular>
      </div>

      <div class="space-y-2 max-w-lg px-1">
        <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text)]">
          {{ 'accessDenied.title' | translate }}
        </h1>
        <p class="text-sm sm:text-base text-[var(--color-text-muted)]">
          {{ 'accessDenied.message' | translate }}
        </p>
      </div>

      <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
        <app-button (click)="goToHome()" [size]="'lg'">
          {{ 'accessDenied.goHome' | translate }}
        </app-button>
        <app-button [variant]="'secondary'" (click)="logout()" [size]="'lg'">
          {{ 'accessDenied.logout' | translate }}
        </app-button>
      </div>
    </div>
  `
})
export class AccessDeniedComponent {
  readonly AlertTriangle = AlertTriangle;

  constructor(
    private router: Router,
    private authService: BackendAuthService
  ) {}

  goToHome(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }
}

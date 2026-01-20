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
    <div class="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 p-6">
      <div class="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <lucide-angular [img]="AlertTriangle" class="h-8 w-8 text-red-500"></lucide-angular>
      </div>

      <div class="space-y-2 max-w-lg">
        <h1 class="text-3xl font-bold text-[var(--color-text)]">
          {{ 'accessDenied.title' | translate }}
        </h1>
        <p class="text-[var(--color-text-muted)]">
          {{ 'accessDenied.message' | translate }}
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <app-button (click)="goToHome()">
          {{ 'accessDenied.goHome' | translate }}
        </app-button>
        <app-button [variant]="'secondary'" (click)="logout()">
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

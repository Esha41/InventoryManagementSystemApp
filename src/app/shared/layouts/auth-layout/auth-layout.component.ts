import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { TranslationService } from '@services/translation.service';
import { ThemeService } from '@services/theme.service';
import { LucideAngularModule, Globe, Moon, Sun } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

import { APP_CONSTANTS } from '@constants/app.constants';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Authentication Layout Component
 * Used for login, register, and other auth pages
 * Provides a clean, centered layout without sidebar/navbar
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LucideAngularModule, TranslateModule],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.css']
})
export class AuthLayoutComponent {
  @ViewChild('authScrollRoot') authScrollRoot?: ElementRef<HTMLElement>;

  readonly Globe = Globe;
  readonly Moon = Moon;
  readonly Sun = Sun;
  readonly currentYear = new Date().getFullYear();
  readonly version = APP_CONSTANTS.VERSION;

  constructor(
    public translationService: TranslationService,
    public themeService: ThemeService,
    private router: Router
  ) {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.scrollAuthLayoutToTop());
  }

  private scrollAuthLayoutToTop(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = this.authScrollRoot?.nativeElement;
        if (el) {
          el.scrollTop = 0;
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    });
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  toggleLanguage(): void {
    this.translationService.toggleLanguage();
  }

  getCurrentLanguage(): string {
    return this.translationService.getCurrentLanguage().toUpperCase();
  }
}

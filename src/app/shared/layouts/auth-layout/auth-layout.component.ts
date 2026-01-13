import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '@services/translation.service';
import { ThemeService } from '@services/theme.service';
import { LucideAngularModule, Globe, Moon, Sun } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

import { APP_CONSTANTS } from '@constants/app.constants';

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
  readonly Globe = Globe;
  readonly Moon = Moon;
  readonly Sun = Sun;
  readonly currentYear = new Date().getFullYear();
  readonly version = APP_CONSTANTS.VERSION;

  constructor(
    public translationService: TranslationService,
    public themeService: ThemeService
  ) { }

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

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '@services/translation.service';
import { LucideAngularModule, Globe } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

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
  readonly currentYear = new Date().getFullYear();

  constructor(public translationService: TranslationService) {}

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

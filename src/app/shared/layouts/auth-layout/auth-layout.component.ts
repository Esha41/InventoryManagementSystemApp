import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '@services/translation.service';

/**
 * Authentication Layout Component
 * Used for login, register, and other auth pages
 * Provides a clean, centered layout without sidebar/navbar
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.css']
})
export class AuthLayoutComponent {
  constructor(public translationService: TranslationService) {}

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }
}

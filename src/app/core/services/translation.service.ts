import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Language = 'en' | 'ar';

/**
 * Translation Service
 * Manages application language, translations, and RTL/LTR direction
 */
@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private currentLang: Language = 'en';
  private readonly STORAGE_KEY = 'app_language';
  private readonly AVAILABLE_LANGUAGES: Language[] = ['en', 'ar'];
  private readonly DEFAULT_LANGUAGE: Language = 'en';
  private isInitializing: boolean = true;

  constructor(private translate: TranslateService) {
    this.initializeLanguage();
  }

  /**
   * Initialize language on app startup
   * Loads saved language from localStorage or uses default
   */
  private initializeLanguage(): void {
    // Get saved language or default to English
    const savedLang = localStorage.getItem(this.STORAGE_KEY) as Language;
    const languageToUse = this.isValidLanguage(savedLang) ? savedLang : this.DEFAULT_LANGUAGE;

    // Configure available languages
    this.translate.addLangs(this.AVAILABLE_LANGUAGES);
    this.translate.setDefaultLang(this.DEFAULT_LANGUAGE);

    // Set the current language without reload during initialization
    this.setLanguage(languageToUse, false);
    this.isInitializing = false;
  }

  /**
   * Validate if a language code is supported
   */
  private isValidLanguage(lang: string | null): lang is Language {
    return lang !== null && this.AVAILABLE_LANGUAGES.includes(lang as Language);
  }

  /**
   * Set application language
   * @param lang - Language to set
   * @param reload - Whether to reload the page when language changes (default: true)
   */
  setLanguage(lang: Language, reload: boolean = true): void {
    if (!this.isValidLanguage(lang)) {
      console.warn(`Invalid language: ${lang}. Using default: ${this.DEFAULT_LANGUAGE}`);
      lang = this.DEFAULT_LANGUAGE;
    }

    // Check if language is actually changing
    const isLanguageChanging = this.currentLang !== lang;

    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
    this.updateDirection(lang);

    // Reload page if language is changing and reload is enabled (not during initialization)
    if (isLanguageChanging && reload && !this.isInitializing) {
      window.location.reload();
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): Language {
    return this.currentLang;
  }

  /**
   * Toggle between English and Arabic
   */
  toggleLanguage(): void {
    const newLang: Language = this.currentLang === 'en' ? 'ar' : 'en';
    this.setLanguage(newLang);
  }

  /**
   * Update document direction and lang attributes
   */
  private updateDirection(lang: Language): void {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    // Set HTML dir and lang attributes
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    
    // Update body classes for additional styling
    document.body.classList.remove('rtl', 'ltr');
    document.body.classList.add(dir);
  }

  /**
   * Check if current language is RTL
   */
  isRTL(): boolean {
    return this.currentLang === 'ar';
  }

  /**
   * Get instant translation for a key
   */
  getTranslation(key: string, params?: any): string {
    return this.translate.instant(key, params);
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): Language[] {
    return [...this.AVAILABLE_LANGUAGES];
  }
}


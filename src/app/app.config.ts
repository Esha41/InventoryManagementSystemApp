import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { routes } from './app.routes';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { authInterceptor, errorInterceptor } from './core/interceptors/index';
import { ConfigService } from './core/services/config.service';

export class JsonTranslationLoader implements TranslateLoader {
  constructor(private http: HttpClient) { }

  getTranslation(lang: string): Observable<any> {
    // List of translation module files to load and merge
    const translationModules = [
      'common',
      'dashboard',
      'requests',
      'inventory',
      'supply',
      'admin',
      'auth',
      'allowance',
      'notifications',
      'add-weapon-asset',
      'scheduledReports',
      'announcements'
    ];

    // Load all modular translation files
    const moduleTranslations = translationModules.map(module =>
      this.http.get(`/assets/i18n/${lang}/${module}.json`).pipe(
        catchError(() => {
          // Silently handle missing translation files
          return of({});
        })
      )
    );

    // Merge all translations using forkJoin
    return forkJoin(moduleTranslations).pipe(
      map(translations => {
        // Merge all translation objects into one using deep merge
        const merged = translations.reduce((acc, translation) => {
          return this.deepMerge(acc, translation);
        }, {});
        return merged;
      }),
      catchError(() => {
        // Silently handle translation loading errors
        return of({});
      })
    );
  }

  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

export const createTranslateLoader = (http: HttpClient): TranslateLoader => new JsonTranslationLoader(http);

export function initConfig(config: ConfigService) {
  return () => config.load();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: initConfig,
      deps: [ConfigService],
      multi: true
    },
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient]
        }
      })
    )
  ]
};


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
  constructor(private http: HttpClient) {}

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
      'notifications'
    ];

    // Load all translation files and merge them
    const loadPromises = translationModules.map(module => 
      this.http.get(`/assets/i18n/${lang}/${module}.json`).pipe(
        catchError(error => {
          console.warn(`Failed to load translation module ${module} for ${lang}:`, error);
          return of({});
        })
      )
    );

    // Merge all translations using forkJoin
    return forkJoin(loadPromises).pipe(
      map(translations => {
        // Merge all translation objects into one
        return translations.reduce((merged, translation) => {
          return { ...merged, ...translation };
        }, {});
      }),
      catchError(error => {
        console.error(`Failed to load translations for ${lang}:`, error);
        return of({});
      })
    );
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


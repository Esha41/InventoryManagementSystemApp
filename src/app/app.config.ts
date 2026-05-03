import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideQuillConfig } from 'ngx-quill/config';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { routes } from './app.routes';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { authInterceptor, errorInterceptor } from './core/interceptors/index';
import { ConfigService } from './core/services/config.service';
import { AuthCrossTabSyncService } from './core/services/auth-cross-tab-sync.service';
import { I18N_TRANSLATION_MODULES } from './core/constants/i18n-translation-modules';
import { SHELL_INTEGRATION_PROVIDERS } from '@shell/shell-integration.providers';

export class JsonTranslationLoader implements TranslateLoader {
  private readonly cache = new Map<string, Observable<TranslationObject>>();

  constructor(private http: HttpClient) { }

  getTranslation(lang: string): Observable<TranslationObject> {
    const existing = this.cache.get(lang);
    if (existing) {
      return existing;
    }

    const translationModules = [...I18N_TRANSLATION_MODULES];

    // Load all modular translation files
    const moduleTranslations = translationModules.map(module =>
      this.http.get<TranslationObject>(`/assets/i18n/${lang}/${module}.json`).pipe(
        catchError(() => {
          // Silently handle missing translation files
          return of({} as TranslationObject);
        })
      )
    );

    // Merge all translations using forkJoin; shareReplay avoids duplicate HTTP + merge per language
    const loaded = forkJoin(moduleTranslations).pipe(
      map(translations => {
        return translations.reduce(
          (acc, translation) => this.deepMerge(acc, translation),
          {} as TranslationObject
        );
      }),
      catchError(() => of({} as TranslationObject)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.cache.set(lang, loaded);
    return loaded;
  }

  private deepMerge(target: TranslationObject, source: TranslationObject): TranslationObject {
    if (!source) return target;
    if (!target) return source;

    const output: TranslationObject = { ...target };
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = target[key];
      if (this.isNestedTranslationObject(srcVal)) {
        if (!(key in target)) {
          output[key] = srcVal;
        } else if (this.isNestedTranslationObject(tgtVal)) {
          output[key] = this.deepMerge(tgtVal as TranslationObject, srcVal as TranslationObject);
        } else {
          output[key] = srcVal;
        }
      } else {
        output[key] = srcVal;
      }
    }
    return output;
  }

  /** True for plain objects used as translation namespaces (not arrays, strings, or null). */
  private isNestedTranslationObject(item: unknown): item is TranslationObject {
    return !!item && typeof item === 'object' && !Array.isArray(item);
  }
}

export const createTranslateLoader = (http: HttpClient): TranslateLoader => new JsonTranslationLoader(http);

export function initConfig(config: ConfigService) {
  return () => config.load();
}

export function initAuthCrossTabSync(_sync: AuthCrossTabSyncService) {
  return () => Promise.resolve();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideQuillConfig({}),
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
    {
      provide: APP_INITIALIZER,
      useFactory: initAuthCrossTabSync,
      deps: [AuthCrossTabSyncService],
      multi: true
    },
    ...SHELL_INTEGRATION_PROVIDERS,
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


import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, merge, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

// SigWebTablet.js bundled in /assets; talks to local SigWeb via tablet.sigwebtablet.com (localhost alias)
declare function SetDisplayXSize(width: number): void;
declare function SetDisplayYSize(height: number): void;
declare function SetImageXSize(width: number): void;
declare function SetImageYSize(height: number): void;
declare function SetTabletState(state: 0 | 1, ctx?: unknown, tv?: number): unknown;
declare function NumberOfTabletPoints(): number;
declare function GetSigImageB64(callback: (data: string) => void): void;
declare function ClearTablet(): void;
declare function IsSigWebInstalled(): boolean;
declare function GetTabletState(): number | string;
declare function SetTabletComTest(enabled: boolean): void;

/** Bundled for air-gapped / red-network deploys; CDN is fallback only. */
const SIGWEB_TABLET_JS_BUNDLED = '/assets/SigWebTablet.js';
/** Topaz CDN — fallback when bundled asset is unavailable (dev / online). */
const SIGWEB_TABLET_JS_CDN = 'https://www.sigplusweb.com/SigWebTablet.js';
const SIGWEB_TABLET_JS_CDN_HTTP = 'http://www.sigplusweb.com/SigWebTablet.js';
const SIGWEB_LOCAL_SCRIPT_PATH = '/SigWeb/SigWebTablet.js';
const SCRIPT_URLS = [
  SIGWEB_TABLET_JS_BUNDLED,
  SIGWEB_TABLET_JS_CDN,
  SIGWEB_TABLET_JS_CDN_HTTP,
  `http://localhost:47289${SIGWEB_LOCAL_SCRIPT_PATH}`,
  `https://localhost:47290${SIGWEB_LOCAL_SCRIPT_PATH}`,
];

/**
 * Probe strategy per base:
 * - localhost uses no-cors (browser blocks reading cross-origin responses even on localhost)
 * - tablet.sigwebtablet.com is Topaz's CORS-friendly alias (resolves to 127.0.0.1); requires DNS
 */
interface SigWebBase {
  url: string;
  corsMode: RequestMode;
}

const SIGWEB_API_BASES: SigWebBase[] = [
  // no-cors: works air-gapped / red-network, cannot read body but resolve = server is up
  { url: 'http://localhost:47289/SigWeb/', corsMode: 'no-cors' },
  // cors: Topaz-recommended CORS alias — needs DNS, gives us response.ok check
  { url: 'http://tablet.sigwebtablet.com:47289/SigWeb/', corsMode: 'cors' },
];

const DETECTION_TIMEOUT_MS = 5000;
const PAD_POLL_INTERVAL_MS = 2500;

export const TOPAZ_SIGNATURE_FILENAME = 'receiver-signature.png';

export type TopazReadyPhase = 'checking' | 'sigweb-unavailable' | 'pad-disconnected' | 'ready';

export interface TopazReadyState {
  phase: TopazReadyPhase;
}

@Injectable({ providedIn: 'root' })
export class TopazService {
  /** Combined SigWeb + pad status for UI — the only public observable consumers need. */
  readonly readyState$: Observable<TopazReadyState>;
  private readonly padConnectedSubject = new BehaviorSubject<boolean>(false);
  private readonly isPadConnected$ = this.padConnectedSubject.asObservable();
  private sigWebReady = false;
  private captureActive = false;
  private padPollTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const sigWebReady$ = from(this.detectAndInit()).pipe(
      catchError(() => of(false)),
      shareReplay(1)
    );

    this.readyState$ = merge(
      of<TopazReadyState>({ phase: 'checking' }),
      sigWebReady$.pipe(
        switchMap(sigWebReady => {
          this.sigWebReady = sigWebReady;
          if (!sigWebReady) {
            this.stopPadPolling();
            this.padConnectedSubject.next(false);
            return of<TopazReadyState>({ phase: 'sigweb-unavailable' });
          }

          this.startPadPolling();
          return this.isPadConnected$.pipe(
            map(connected =>
              connected
                ? ({ phase: 'ready' } as TopazReadyState)
                : ({ phase: 'pad-disconnected' } as TopazReadyState)
            )
          );
        })
      )
    ).pipe(shareReplay(1));
  }

  /**
   * Detect SigWeb: local service must respond, then load SigWebTablet.js (CDN or local).
   */
  private async detectAndInit(): Promise<boolean> {
    if (!(await this.isSigWebServiceReachable())) {
      return false;
    }

    for (const scriptUrl of SCRIPT_URLS) {
      try {
        await this.loadScript(scriptUrl);
        if (this.isSigWebApiReady()) {
          if (typeof IsSigWebInstalled === 'function' && !IsSigWebInstalled()) {
            this.removeScript(scriptUrl);
            continue;
          }
          return true;
        }
        this.removeScript(scriptUrl);
      } catch {
        this.removeScript(scriptUrl);
      }
    }
    return false;
  }

  /** Re-check USB pad connection (e.g. after plugging in). */
  refreshPadDetection(): void {
    if (!this.sigWebReady || this.captureActive) {
      return;
    }
    this.padConnectedSubject.next(this.isSignaturePadConnected());
  }

  /**
   * Topaz-recommended USB pad check: SetTabletComTest + GetTabletState.
   * @see https://www.topazsystems.com/software/download/sigweb.pdf
   */
  private isSignaturePadConnected(): boolean {
    if (!this.isSigWebApiReady()) {
      return false;
    }

    try {
      if (typeof SetTabletComTest !== 'function' || typeof GetTabletState !== 'function') {
        return false;
      }

      SetTabletComTest(false);
      SetTabletState(0);
      SetTabletComTest(true);
      SetTabletState(1);

      const state = GetTabletState();
      const connected = state === 1 || state === '1';

      SetTabletState(0);
      SetTabletComTest(false);
      return connected;
    } catch {
      this.resetPadProbeState();
      return false;
    }
  }

  private resetPadProbeState(): void {
    try {
      SetTabletState(0);
      SetTabletComTest(false);
    } catch {
      // Pad may already be in stopped state
    }
  }

  private startPadPolling(): void {
    this.stopPadPolling();
    this.refreshPadDetection();
    this.padPollTimer = this.createPadPollInterval();
  }

  private stopPadPolling(): void {
    if (this.padPollTimer !== null) {
      clearInterval(this.padPollTimer);
      this.padPollTimer = null;
    }
  }

  private createPadPollInterval(): ReturnType<typeof setInterval> {
    return setInterval(() => {
      if (!this.captureActive) {
        this.padConnectedSubject.next(this.isSignaturePadConnected());
      }
    }, PAD_POLL_INTERVAL_MS);
  }

  /** SigWeb REST API (TabletState) — works even when SigWebTablet.js is not on localhost. */
  private async isSigWebServiceReachable(): Promise<boolean> {
    const cacheBust = `${Date.now()}-${Math.random()}`;
    for (const { url, corsMode } of SIGWEB_API_BASES) {
      try {
        const response = await fetch(`${url}TabletState?noCache=${cacheBust}`, {
          cache: 'no-store',
          mode: corsMode,
        });
        // no-cors → opaque response (ok is always false); resolve without throw = server is up
        // cors → check ok normally
        if (corsMode === 'no-cors' || response.ok) {
          return true;
        }
      } catch {
        // try next base
      }
    }
    return false;
  }

  private isSigWebApiReady(): boolean {
    try {
      return typeof SetTabletState === 'function' && typeof GetSigImageB64 === 'function';
    } catch {
      return false;
    }
  }

  private loadScript(scriptUrl: string): Promise<void> {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-topaz-sigweb="${scriptUrl}"]`);
    if (existing) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.setAttribute('data-topaz-sigweb', scriptUrl);
      const timeoutId = setTimeout(() => {
        script.remove();
        reject(new Error('SigWebTablet.js load timeout'));
      }, DETECTION_TIMEOUT_MS);
      script.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeoutId);
        script.remove();
        reject(new Error('SigWebTablet.js failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  private removeScript(scriptUrl: string): void {
    document.querySelector<HTMLScriptElement>(`script[data-topaz-sigweb="${scriptUrl}"]`)?.remove();
  }

  startCapture(displayWidth = 500, displayHeight = 150): void {
    this.captureActive = true;
    this.stopPadPolling();
    SetDisplayXSize(displayWidth);
    SetDisplayYSize(displayHeight);
    SetImageXSize(displayWidth);
    SetImageYSize(displayHeight);
    SetTabletState(1);
    this.pollingInterval = setInterval(() => NumberOfTabletPoints(), 200);
  }

  hasPoints(): boolean {
    return this.getTabletPointCount() > 0;
  }

  private getTabletPointCount(): number {
    try {
      const raw = String(NumberOfTabletPoints()).trim().replace(/^"|"$/g, '');
      const count = Number(raw);
      return Number.isFinite(count) ? count : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Stops capture and returns the signature as base64 PNG, or null if empty.
   * A safety timeout ensures captureActive is always reset even if SigWeb hangs.
   */
  captureSignature(): Observable<string | null> {
    this.clearPolling();
    SetTabletState(0);
    return new Observable<string | null>(observer => {
      let settled = false;

      const safetyTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          observer.next(null);
          observer.complete();
          this.finishCaptureSession(false);
        }
      }, DETECTION_TIMEOUT_MS);

      GetSigImageB64(data => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        const image = data?.length > 0 ? data : null;
        observer.next(image);
        observer.complete();
        this.finishCaptureSession(!!image);
      });
    });
  }

  clearPad(): void {
    try {
      ClearTablet();
      SetTabletState(0);
    } catch {
      // Pad may already be in stopped state
    }
    this.clearPolling();
    this.finishCaptureSession(false);
  }

  /** Ends an active capture without disturbing SigWeb while the image is fetched. */
  private finishCaptureSession(padWasUsed: boolean): void {
    this.captureActive = false;
    if (padWasUsed) {
      // Pad was just used — skip an invasive probe that can race with GetSigImageB64
      this.padConnectedSubject.next(true);
    } else {
      this.refreshPadDetection();
    }
    this.resumePadPolling();
  }

  private resumePadPolling(): void {
    if (!this.sigWebReady || this.padPollTimer !== null) {
      return;
    }
    this.padPollTimer = this.createPadPollInterval();
  }

  /**
   * Converts a base64 PNG string to a File object suitable for FormData upload.
   */
  base64ToFile(base64: string, filename = TOPAZ_SIGNATURE_FILENAME): File {
    const byteString = atob(base64);
    const buffer = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      buffer[i] = byteString.charCodeAt(i);
    }
    return new File([buffer], filename, { type: 'image/png' });
  }

  private clearPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

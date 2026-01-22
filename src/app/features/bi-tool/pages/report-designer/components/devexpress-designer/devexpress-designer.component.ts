import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ConfigService } from '@services/config.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';

declare var DevExpress: any;

@Component({
  selector: 'app-devexpress-designer',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="devexpress-designer-container">
      <div class="designer-header" *ngIf="showHeader">
        <button type="button" (click)="onClose()" class="close-button">
          <span>{{ 'common.close' | translate }}</span>
        </button>
      </div>
      <div #designerHost class="designer-host"></div>
    </div>
  `,
  styles: [`
    .devexpress-designer-container {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--color-background);
    }

    .designer-header {
      padding: 1rem;
      background: var(--color-background-muted);
      border-bottom: 2px solid var(--color-border);
      display: flex;
      justify-content: flex-end;
    }

    .close-button {
      padding: 0.5rem 1rem;
      background: var(--color-brand);
      color: white;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .close-button:hover {
      background: var(--color-brand-dark);
    }

    .designer-host {
      flex: 1;
      width: 100%;
      overflow: hidden;
    }

    :host ::ng-deep .dx-designer {
      height: 100% !important;
    }
  `]
})
export class DevExpressDesignerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('designerHost', { static: false }) designerHost!: ElementRef<HTMLDivElement>;

  showHeader = true;
  private designer: any;

  constructor(
    private http: HttpClient,
    private router: Router,
    private config: ConfigService,
    private authService: BackendAuthService,
    private translationService: TranslationService
  ) { }

  ngOnInit(): void {
    // Check if user has permission to design reports
    this.checkDesignPermission();
  }

  ngAfterViewInit(): void {
    this.loadDevExpressAndInitialize();
  }

  ngOnDestroy(): void {
    if (this.designer) {
      this.designer.dispose();
    }
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  private async checkDesignPermission(): Promise<void> {
    try {
        const token = localStorage.getItem('auth_token');
      if (!token) {
        this.router.navigate(['/access-denied']);
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      const response = await this.http.get<{ canDesign: boolean; message: string }>(
        `${this.config.apiUrl}/reportdesigner/can-design`,
        { headers }
      ).toPromise();

      if (!response?.canDesign) {
        this.router.navigate(['/access-denied']);
      }
    } catch (error) {
      console.error('Error checking design permission:', error);
      this.router.navigate(['/access-denied']);
    }
  }

  private async loadDevExpressAndInitialize(): Promise<void> {
    // Check if DevExpress is already loaded
    if (typeof (window as any).DevExpress !== 'undefined') {
      this.initializeDesigner();
      return;
    }

    // Try loading from npm package first (if available via assets)
    // Otherwise fall back to CDN
    await this.loadDevExpressFromNPMOrCDN();
  }

  private async loadDevExpressFromNPMOrCDN(): Promise<void> {
    // Load from local assets (copied from node_modules)
    const assetsBase = '/assets/devexpress-reporting';
    const scriptPaths = [
      `${assetsBase}/js/dx-reportdesigner.min.js`,  // Note: correct filename is dx-reportdesigner, not dx-reporting
      `${assetsBase}/js/dx-webdocumentviewer.min.js`
    ];
    const cssPaths = [
      `${assetsBase}/css/dx-reportdesigner.css`,
      `${assetsBase}/css/dx-webdocumentviewer.css`
    ];

    try {
      // Load CSS first (non-blocking)
      cssPaths.forEach(css => this.loadStylesheet(css));

      // Load scripts sequentially - dx-reportdesigner MUST load before dx-webdocumentviewer
      console.log('Loading DevExpress Reporting scripts from assets...');
      await this.loadScript(scriptPaths[0]);
      
      // Wait for DevExpress to be defined before loading webdocumentviewer
      let attempts = 0;
      const maxAttempts = 30;
      while (typeof (window as any).DevExpress === 'undefined' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (typeof (window as any).DevExpress === 'undefined') {
        throw new Error('DevExpress not defined after loading dx-reportdesigner.min.js');
      }

      console.log('DevExpress defined, loading webdocumentviewer...');
      // Now load webdocumentviewer which depends on DevExpress
      await this.loadScript(scriptPaths[1]);
      
      // Final wait to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 300));

      if (typeof (window as any).DevExpress !== 'undefined' && 
          (window as any).DevExpress.Analytics && 
          (window as any).DevExpress.Analytics.ReportDesigner) {
        console.log('DevExpress fully loaded, initializing designer...');
        this.initializeDesigner();
      } else {
        throw new Error('DevExpress.Analytics.ReportDesigner not available');
      }
    } catch (error) {
      console.error('Error loading DevExpress:', error);
      // Show user-friendly error
      console.error('Failed to load DevExpress Reporting library from assets. Please ensure the files are copied to src/assets/devexpress-reporting/');
    }
  }

  private loadStylesheet(href: string): void {
    // Check if stylesheet is already loaded
    const existingLink = document.querySelector(`link[href="${href}"]`);
    if (existingLink) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        // If script exists, wait a bit to ensure it's loaded
        setTimeout(() => resolve(), 100);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      script.async = false; // Load sequentially, not in parallel
      script.onload = () => {
        console.log(`Loaded: ${src}`);
        resolve();
      };
      script.onerror = (error) => {
        console.error(`Failed to load script: ${src}`, error);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  private initializeDesigner(): void {
    if (!this.designerHost) {
      console.error('Designer host not found');
      return;
    }

    const DevExpress = (window as any).DevExpress;
    if (!DevExpress || !DevExpress.Analytics || !DevExpress.Analytics.ReportDesigner) {
      console.error('DevExpress library not properly loaded');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const baseBackendUrl = this.getBaseBackendUrl();
      const DevExpress = (window as any).DevExpress;

      // Initialize DevExpress Web Report Designer
      this.designer = new DevExpress.Analytics.ReportDesigner(this.designerHost.nativeElement, {
        report: {
          // Start with base template
          reportUrl: 'BaseReportTemplate'
        },
        requestOptions: {
          host: baseBackendUrl,
          getCustomHeaders: () => {
            return {
              'Authorization': `Bearer ${token}`
            };
          }
        },
        // Configure report storage
        reportStorage: {
          url: `${baseBackendUrl}/DXXRD`,
          requestOptions: {
            getCustomHeaders: () => {
              return {
                'Authorization': `Bearer ${token}`
              };
            }
          }
        },
        // Configure data source
        dataSource: {
          url: `${baseBackendUrl}/DXXRDV`,
          requestOptions: {
            getCustomHeaders: () => {
              return {
                'Authorization': `Bearer ${token}`
              };
            }
          }
        },
        // UI customization
        menu: {
          visible: true
        },
        // Enable all features
        bindings: {
          url: `${baseBackendUrl}/DXXRDB`,
          requestOptions: {
            getCustomHeaders: () => {
              return {
                'Authorization': `Bearer ${token}`
              };
            }
          }
        }
      });
    } catch (error) {
      console.error('Error initializing DevExpress Designer:', error);
    }
  }

  private getBackendUrl(): string {
    // Get backend URL from ConfigService (includes /api)
    return this.config.apiUrl;
  }

  private getBaseBackendUrl(): string {
    // Get base backend URL without /api for static files like DevExpress
    const apiUrl = this.config.apiUrl;
    // Remove /api suffix if present
    if (apiUrl.endsWith('/api')) {
      return apiUrl.substring(0, apiUrl.length - 4);
    }
    // Remove /api/ suffix if present
    if (apiUrl.endsWith('/api/')) {
      return apiUrl.substring(0, apiUrl.length - 5);
    }
    return apiUrl;
  }

  onClose(): void {
    this.router.navigate(['/report-designer']);
  }
}

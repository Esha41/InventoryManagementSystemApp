import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ConfigService } from '@services/config.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { TranslationService } from '@services/translation.service';
import { DxReportDesignerModule } from 'devexpress-reporting-angular/dx-report-designer';

@Component({
  selector: 'app-devexpress-designer',
  standalone: true,
  imports: [CommonModule, TranslateModule, DxReportDesignerModule],
  template: `
    <div class="devexpress-designer-container">
      <div class="designer-header" *ngIf="showHeader">
        <button type="button" (click)="onClose()" class="close-button">
          <span>{{ 'common.close' | translate }}</span>
        </button>
      </div>
      
      <!-- Error State -->
      <div *ngIf="error" class="error-container">
        <h3>{{ 'common.error' | translate }}</h3>
        <p>{{ error }}</p>
        <button type="button" (click)="onClose()" class="close-button">
          {{ 'common.back' | translate }}
        </button>
      </div>
      
      <!-- DevExpress Report Designer Angular Component -->
      <dx-report-designer
        *ngIf="!error && isReady && requestOptions?.host"
        [reportUrl]="reportUrl || ''"
        [developmentMode]="false"
        class="designer-host">
        <dxrd-request-options
          [host]="requestOptions.host"
          [invokeAction]="requestOptions.invokeAction">
        </dxrd-request-options>
        <dxrd-callbacks
          (onExit)="onExit()">
        </dxrd-callbacks>
      </dx-report-designer>
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

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: calc(100vh - 80px);
      gap: 1rem;
      padding: 2rem;
      text-align: center;
    }

    .error-container h3 {
      color: var(--color-error);
      margin: 0;
    }

    .error-container p {
      color: var(--color-text-muted);
      margin: 0;
    }
  `]
})
export class DevExpressDesignerComponent implements OnInit, OnDestroy {
  reportUrl?: string;
  error: string | null = null;
  showHeader = true;
  developmentMode: boolean = false;
  isReady = false;
  
  requestOptions: any = {
    host: '',
    invokeAction: '/DXXRD',
    requestHeaders: {}
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private config: ConfigService,
    private authService: BackendAuthService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Get reportUrl from query params if editing
    this.route.queryParams.subscribe(params => {
      this.reportUrl = params['reportUrl'];
    });
    
    // Setup request options
    this.setupRequestOptions();
    
    // Check if user has permission to design reports
    this.checkDesignPermission();
  }

  ngOnDestroy(): void {
    // Cleanup if needed - Angular wrapper handles disposal automatically
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  private setupRequestOptions(): void {
    // Get base URL (remove /api suffix)
    const apiUrl = this.config.apiUrl;
    let baseUrl = apiUrl;
    if (apiUrl.endsWith('/api')) {
      baseUrl = apiUrl.substring(0, apiUrl.length - 4);
    } else if (apiUrl.endsWith('/api/')) {
      baseUrl = apiUrl.substring(0, apiUrl.length - 5);
    }
    
    // Ensure baseUrl doesn't end with a slash
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // Get authentication token
    const token = localStorage.getItem('auth_token');
    
    this.requestOptions = {
      host: baseUrl,
      invokeAction: '/DXXRD',
      requestHeaders: token ? {
        'Authorization': `Bearer ${token}`
      } : {}
    };
    
    // Mark as ready after requestOptions are set and trigger change detection
    this.isReady = true;
    this.cdr.detectChanges();
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

      // Note: API endpoint is /api/Report/can-design (capital R)
      const response = await this.http.get<{ canDesign: boolean; message: string }>(
        `${this.config.apiUrl}/Report/can-design`,
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

  onExit(): void {
    this.router.navigate(['/bi-tool/report-designer']);
  }

  onClose(): void {
    this.router.navigate(['/bi-tool/report-designer']);
  }
}

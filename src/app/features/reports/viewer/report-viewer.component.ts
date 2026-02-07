import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, X } from 'lucide-angular';
import { DxReportViewerModule } from 'devexpress-reporting-angular';
import { TranslationService } from '@services/translation.service';
import { ReportService } from '@services/report.service';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    DxReportViewerModule
  ],
  template: `
    <div class="report-viewer-container">
      <div class="viewer-header">
        <button 
          type="button" 
          (click)="goBack()"
          class="back-button"
          [title]="'common.back' | translate">
          <lucide-angular [img]="isRTL ? ArrowRight : ArrowLeft" class="h-5 w-5"></lucide-angular>
        </button>
        <h2 class="viewer-title">{{ reportName }}</h2>
        <button 
          type="button" 
          (click)="closeViewer()"
          class="close-button"
          [title]="'common.close' | translate">
          <lucide-angular [img]="X" class="h-5 w-5"></lucide-angular>
        </button>
      </div>
      <div class="viewer-content" *ngIf="reportUrl">
        <dx-report-viewer 
          [reportUrl]="reportUrl"
          [height]="'calc(100vh - 80px)'"
          (onExport)="onExport($event)"
          (onPrint)="onPrint($event)"
          (onCustomizeMenuActions)="onCustomizeMenuActions($event)">
          <dxrv-request-options 
            [host]="host"
            [invokeAction]="invokeAction">
          </dxrv-request-options>
        </dx-report-viewer>
      </div>
      <div *ngIf="!reportUrl" class="error-message">
        <p>{{ 'reportViewer.noReportSelected' | translate }}</p>
      </div>
    </div>
  `,
  styles: [`
    .report-viewer-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100%;
      background: var(--color-background);
    }

    .viewer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: var(--color-background-muted);
      border-bottom: 1px solid var(--color-border);
      gap: 1rem;
      flex-shrink: 0;
    }

    .back-button,
    .close-button {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      background: transparent;
      border: 1px solid var(--color-border);
      border-radius: 0.375rem;
      color: var(--color-text);
      cursor: pointer;
      transition: all 0.2s;
    }

    .back-button:hover,
    .close-button:hover {
      background: var(--color-background-hover);
      border-color: var(--color-border-hover);
    }

    .viewer-title {
      flex: 1;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-text);
      text-align: center;
      margin: 0;
    }

    .viewer-content {
      flex: 1;
      width: 100%;
      overflow: hidden;
      position: relative;
    }

    .error-message {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      font-size: 1rem;
    }

    /* Ensure DevExpress Report Viewer takes full space */
    ::ng-deep .dx-report-viewer {
      width: 100%;
      height: 100%;
    }
  `]
})
export class ReportViewerComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X;

  reportUrl: string = '';
  reportName: string = '';
  host: string = '';
  invokeAction: string = '/DXXRDV';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private reportService: ReportService
  ) {
    // Extract base URL from environment - same pattern as designer
    const apiUrl = environment.apiUrl;
    // Remove /api suffix if present, as DevExpress endpoints are at root level
    this.host = apiUrl.replace('/api', '');
  }

  ngOnInit(): void {
    this.reportUrl = this.route.snapshot.queryParamMap.get('reportUrl') || '';
    this.reportName = this.route.snapshot.queryParamMap.get('reportName') || 'Report';
    
    console.log('Report Viewer Configuration:', {
      reportUrl: this.reportUrl,
      reportName: this.reportName,
      host: this.host,
      invokeAction: this.invokeAction
    });
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  goBack(): void {
    this.router.navigate(['/report-dashboard']);
  }

  closeViewer(): void {
    this.router.navigate(['/report-dashboard']);
  }

  onExport(event: any): void {
    console.log('Export event:', event);
  }

  onPrint(event: any): void {
    console.log('Print event:', event);
  }

  onCustomizeMenuActions(event: any): void {
    console.log('Customize menu actions:', event);
  }
}


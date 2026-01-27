import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, X } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ReportService } from '@services/report.service';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule
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
      <iframe 
        [src]="viewerUrl" 
        class="viewer-iframe"
        frameborder="0"
        allowfullscreen>
      </iframe>
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

    .viewer-iframe {
      flex: 1;
      width: 100%;
      border: none;
      background: white;
    }
  `]
})
export class ReportViewerComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X;

  reportUrl: string = '';
  reportName: string = '';
  viewerUrl: SafeResourceUrl | string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private reportService: ReportService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.reportUrl = this.route.snapshot.queryParamMap.get('reportUrl') || '';
    this.reportName = this.route.snapshot.queryParamMap.get('reportName') || 'Report';
    
    if (this.reportUrl) {
      const url = this.reportService.getViewerUrl(this.reportUrl);
      this.viewerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
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
}

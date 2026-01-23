import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ReportService } from '@services/report.service';
import { ConfigService } from '@services/config.service';

declare var DevExpress: any;

@Component({
  selector: 'app-report-designer-view',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './report-designer-view.component.html',
  styleUrls: ['./report-designer-view.component.css']
})
export class ReportDesignerViewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('designerHost', { static: false }) designerHost!: ElementRef<HTMLDivElement>;
  
  reportUrl?: string;
  loading = true;
  error: string | null = null;
  private designer: any;
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: ReportService,
    private config: ConfigService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.reportUrl = params['reportUrl'];
    });
  }

  ngAfterViewInit(): void {
    // Wait for DevExpress to be available
    this.waitForDevExpress();
  }

  ngOnDestroy(): void {
    if (this.designer) {
      try {
        if (typeof this.designer.dispose === 'function') {
          this.designer.dispose();
        }
      } catch (e) {
        console.error('Error disposing designer:', e);
      }
    }
  }

  private waitForDevExpress(): void {
    if (typeof DevExpress !== 'undefined' && DevExpress.Analytics && DevExpress.Analytics.ReportDesigner) {
      this.initializeDesigner();
    } else {
      this.retryCount++;
      if (this.retryCount < this.maxRetries) {
        setTimeout(() => this.waitForDevExpress(), 500);
      } else {
        this.error = 'DevExpress libraries failed to load. Please refresh the page.';
        this.loading = false;
      }
    }
  }

  private initializeDesigner(): void {
    if (!this.designerHost || !this.designerHost.nativeElement) {
      return;
    }

    try {
      const baseUrl = this.config.apiUrl.replace('/api', '');
      
      // Get authentication token
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      
      // Configure DevExpress Report Designer for version 25
      const designerOptions: any = {
        reportUrl: this.reportUrl || '',
        requestOptions: {
          host: baseUrl,
          getDesignerModelAction: '/DXXRD/GetDesignerModel',
          invokeAction: '/DXXRD',
          requestHeaders: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        },
        onExit: () => {
          this.router.navigate(['/bi-tool/report-designer']);
        }
      };

      // Initialize the designer
      this.designer = new DevExpress.Analytics.ReportDesigner(
        this.designerHost.nativeElement,
        designerOptions
      );
      
      this.loading = false;
    } catch (error: any) {
      console.error('Error initializing DevExpress Report Designer:', error);
      this.error = error.message || 'Failed to initialize report designer';
      this.loading = false;
    }
  }

  onClose(): void {
    this.router.navigate(['/bi-tool/report-designer']);
  }
}


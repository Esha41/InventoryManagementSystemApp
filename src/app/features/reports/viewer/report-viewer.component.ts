import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, X } from 'lucide-angular';
import { DxReportViewerModule } from 'devexpress-reporting-angular';
import { TranslationService } from '@services/translation.service';
import { ConfigService } from '@services/config.service';
import { StorageService } from '@services/storage.service';
import { configureDevexpressAuthHeaders } from '@utils/devexpress-auth.util';

@Component({
  selector: 'app-report-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    DxReportViewerModule
  ],
  templateUrl: './report-viewer.component.html',
  styleUrls: ['./report-viewer.component.css']
})
export class ReportViewerComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X;

  reportUrl: string = '';
  reportName: string = '';
  host: string = '';
  readonly invokeAction = '/DXXRDV';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private configService: ConfigService,
    private storageService: StorageService
  ) {
    this.host = this.configService.reportingHost;
  }

  ngOnInit(): void {
    configureDevexpressAuthHeaders(this.storageService.get<string>('auth_token'));

    this.reportUrl = this.route.snapshot.queryParamMap.get('reportUrl') || '';
    this.reportName = this.route.snapshot.queryParamMap.get('reportName') || 'Report';
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  getViewerHeight(): string {
    // Responsive height calculation
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640; // sm breakpoint
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024; // md breakpoint
      
      if (isMobile) {
        return 'calc(100vh - 100px)'; // Mobile: account for smaller header
      } else if (isTablet) {
        return 'calc(100vh - 90px)'; // Tablet: medium header
      } else {
        return 'calc(100vh - 80px)'; // Desktop: full header
      }
    }
    return 'calc(100vh - 80px)'; // Default fallback
  }

  goBack(): void {
    this.router.navigate(['/reports/report-dashboard']);
  }

  closeViewer(): void {
    this.router.navigate(['/reports/report-dashboard']);
  }
}


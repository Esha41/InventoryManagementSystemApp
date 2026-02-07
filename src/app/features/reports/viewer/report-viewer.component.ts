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
  invokeAction: string = '/DXXRDV';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private reportService: ReportService
  ) {
    // Extract base URL from environment
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
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, X } from 'lucide-angular';
import { DxReportViewerModule } from 'devexpress-reporting-angular';
import { TranslationService } from '@services/translation.service';
import { ReportService } from '@reports/services/report.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { ConfigService } from '@services/config.service';
import { take } from 'rxjs/operators';

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
    private reportService: ReportService,
    private authService: BackendAuthService,
    private configService: ConfigService
  ) {
    this.host = this.configService.reportingHost;
  }

  ngOnInit(): void {
    let baseReportUrl = this.route.snapshot.queryParamMap.get('reportUrl') || '';
    this.reportName = this.route.snapshot.queryParamMap.get('reportName') || 'Report';
    
    // Get departmentId(s) from user claims/token
    // User can have single department, multiple departments, or null
    const currentUser = this.authService.getCurrentUser();
    const departmentId = currentUser?.departmentId;
    
    // Get superadmin status from claims
    const isSuperAdmin = this.authService.isSuperAdmin();
    
    // Build query parameters
    const queryParams: string[] = [];
    
    // Append departmentId to reportUrl
    // Support multiple departments by comma-separating them
    if (baseReportUrl) {
      // If departmentId is an array, join with commas; otherwise use as-is
      const deptIdValue = Array.isArray(departmentId) 
        ? departmentId.join(',') 
        : departmentId?.toString();
      queryParams.push(`departmentId=${deptIdValue}`);
    }
    
    // Append superadmin parameter
    queryParams.push(`superadmin=${isSuperAdmin}`);
    
    // Construct final report URL with parameters
    if (queryParams.length > 0 && baseReportUrl) {
      const separator = baseReportUrl.includes('?') ? '&' : '?';
      this.reportUrl = `${baseReportUrl}${separator}${queryParams.join('&')}`;
    } else {
      this.reportUrl = baseReportUrl;
    }
    
    console.log('Report Viewer Configuration:', {
      reportUrl: this.reportUrl,
      baseReportUrl: baseReportUrl,
      reportName: this.reportName,
      host: this.host,
      invokeAction: this.invokeAction,
      departmentId: departmentId,
      isSuperAdmin: isSuperAdmin
    });
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
    this.router.navigate(['/report-dashboard']);
  }

  closeViewer(): void {
    this.router.navigate(['/report-dashboard']);
  }
}


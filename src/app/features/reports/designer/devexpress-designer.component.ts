import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DxReportDesignerModule } from 'devexpress-reporting-angular';
import 'devexpress-reporting/dx-richedit';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-report-designer',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    DxReportDesignerModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './devexpress-designer.component.html'
})
export class DevExpressReportDesignerComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  // Report Designer configuration
  getDesignerModelAction = "/DXXRD/GetDesignerModel";
  reportName: string = "BaseReportTemplate"; // Default report name, can be passed via route params
  host: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService
  ) {
    // Extract base URL from environment
    const apiUrl = environment.apiUrl;
    // Remove /api suffix if present, as DevExpress endpoints are at root level
    this.host = apiUrl.replace('/api', '');
  }

  ngOnInit(): void {
    // Check if report name is passed via route params
    // Permission is already checked by route guard
    this.reportName = "BaseReportTemplate";
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  goBack(): void {
    this.router.navigate(['/report-designer']);
  }
}

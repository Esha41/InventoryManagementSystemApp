import { Component, ViewEncapsulation, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DxReportDesignerModule } from 'devexpress-reporting-angular';
import 'devexpress-reporting/dx-richedit';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { environment } from '@environments/environment';
import { LoadingStateComponent } from '@components/index';

@Component({
  selector: 'app-report-designer',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    DxReportDesignerModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent
  ],
  templateUrl: './devexpress-designer.component.html'
})
export class DevExpressReportDesignerComponent implements OnInit, AfterViewInit {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  // Report Designer configuration
  getDesignerModelAction = "/DXXRD/GetDesignerModel";
  reportName: string = "BaseReportTemplate"; // Default report name, can be passed via route params
  host: string = '';
  isLoading = true;
  isCreateMode = false;

  @ViewChild('reportDesigner', { static: false }) reportDesignerElement!: ElementRef;

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
    // Resolve report URL synchronously from route (before first render).
    // Using subscription would run async, so dx-report-designer would already
    // initialize with "BaseReportTemplate" before we could pass the edit URL.
    const reportUrl = this.route.snapshot.queryParamMap.get('reportUrl');
    this.reportName = reportUrl ?? 'BaseReportTemplate';

    // if coming from create, pass ?mode=create
    const mode = this.route.snapshot.queryParamMap.get('mode');
    this.isCreateMode = mode === 'create';
  }

  ngAfterViewInit(): void {
    // Start checking if designer is loaded after a short delay
    setTimeout(() => {
      this.checkDesignerLoaded();
    }, 300);

    // Adjust toolbar buttons after render
    setTimeout(() => {
      this.adjustToolbar();
    }, 1200);
  }

  private checkDesignerLoaded(): void {
    // Check if DevExpress designer is loaded by looking for its internal elements
    let attempts = 0;
    const maxAttempts = 100; // Check for up to 10 seconds (100 * 100ms)
    
    const checkInterval = setInterval(() => {
      attempts++;
      const designerElement = document.querySelector('dx-report-designer');
      
      if (designerElement) {
        // Check if DevExpress has rendered its content by looking for specific classes
        const dxContent = designerElement.querySelector('.dxrd-designer-wrapper') || 
                         designerElement.querySelector('.dxrd-toolbar-wrapper') ||
                         designerElement.querySelector('.dx-report-designer');
        
        if (dxContent && dxContent.children.length > 0) {
          // Designer is loaded, hide loader with a small delay for smooth transition
          setTimeout(() => {
            this.isLoading = false;
          }, 200);
          clearInterval(checkInterval);
          return;
        }
      }

      // Fallback: hide loader after maximum attempts
      if (attempts >= maxAttempts) {
        this.isLoading = false;
        clearInterval(checkInterval);
      }
    }, 100);
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  goBack(): void {
    // Remove the popstate listener before navigating
 
    this.router.navigate(['/report-designer']);
  }

  adjustToolbar() {
    const timer = setInterval(() => {
      const items = document.querySelectorAll('.dxrd-menu-item-text');
  
      if (!items || items.length === 0) return;
  
      items.forEach(i => {
        const text = i.textContent?.trim().toLowerCase() || '';
        const root = i.closest('.dxrd-menu-item') || i.parentElement;
  
        if (this.isCreateMode && text === 'save') {
          root && ((root as HTMLElement).style.display = 'none');
        }
  
        if (!this.isCreateMode && text === 'save as') {
          root && ((root as HTMLElement).style.display = 'none');
        }
      });
  
      clearInterval(timer);
    }, 300);
  }
}

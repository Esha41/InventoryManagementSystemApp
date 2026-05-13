import { Component, ViewEncapsulation, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DxReportDesignerModule, DxReportDesignerComponent } from 'devexpress-reporting-angular';
import 'devexpress-reporting/dx-richedit';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { TranslationService } from '@services/translation.service';
import { ConfigService } from '@services/config.service';
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
export class DevExpressReportDesignerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  /** Layout URLs served by ReportFactory when no DB row exists — not valid post-save report IDs */
  private static readonly builtInTemplateUrls = new Set([
    'BaseReportTemplate',
    'AssetsReportTemplate',
    'UsersReportTemplate',
    'LoginAuditReportTemplate',
    'PendingAuditorOrderReportTemplate'
  ]);

  // IIS: `^DXXRD(.*)` → backend `/api/DXXRD...` — keep path at site root, not `/api/DXXRD`
  readonly getDesignerModelAction = '/DXXRD/GetDesignerModel';
  reportName: string = "BaseReportTemplate"; // Default report name, can be passed via route params
  host: string = '';
  isLoading = true;
  isCreateMode = false;
  private removeShortcutKeyListener: (() => void) | null = null;

  @ViewChild('reportDesigner', { static: false }) reportDesignerElement!: ElementRef;
  @ViewChild(DxReportDesignerComponent, { static: false }) dxDesigner!: DxReportDesignerComponent;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService,
    private configService: ConfigService
  ) {
    this.host = this.configService.reportingHost;
  }

  ngOnInit(): void {
    const reportUrl = this.route.snapshot.queryParamMap.get('reportUrl')
      ?? this.route.snapshot.queryParamMap.get('url');
    this.reportName = reportUrl ?? 'BaseReportTemplate';

    // if coming from create, pass ?mode=create
    const mode = this.route.snapshot.queryParamMap.get('mode');
    this.isCreateMode = mode === 'create';
  }

  /**
   * Called when the user saves a report in the designer.
   * When in create mode, we update the browser URL to the saved report URL
   * so that refresh/reload opens the saved report instead of create mode again.
   * 
   * IMPORTANT: We update the URL WITHOUT changing the reportName binding to avoid
   * causing the designer to reload and lose unsaved changes.
   */
  onReportSaved(event: { sender?: unknown; args?: unknown }): void {
    // Only act on FIRST save (create mode)
    if (!this.isCreateMode) {
      return;
    }

    // Try to get the saved report URL from the event args
    // DevExpress passes the saved URL in the args
    const savedReportUrl = (event?.args as { Url?: string })?.Url 
      ?? this.getCurrentReportUrlFromEvent(event);

    if (!savedReportUrl || DevExpressReportDesignerComponent.builtInTemplateUrls.has(savedReportUrl)) {
      return;
    }

    // Switch to edit mode (affects toolbar visibility)
    this.isCreateMode = false;

    // Update the browser URL WITHOUT changing reportName binding
    // This prevents the designer from reloading and losing unsaved changes
    // We use window.history.replaceState to update URL without triggering Angular change detection
    // The designer already has the correct report loaded in memory, so we don't need to change the binding
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('reportUrl', savedReportUrl);
    currentUrl.searchParams.delete('mode');
    window.history.replaceState({}, '', currentUrl.toString());

    // NOTE: We intentionally do NOT update this.reportName here because:
    // 1. The designer already has the saved report loaded in memory
    // 2. Changing reportName would trigger Angular change detection
    // 3. This would cause the [reportUrl] binding to update
    // 4. DevExpress would then reload the report from the server, losing any unsaved changes
    // 
    // The URL is updated so that if the user refreshes, they'll get the saved report.
    // But while they're working, the designer keeps the current state in memory.

    // Re-apply toolbar rules after a delay to let DevExpress finish its save cycle
    setTimeout(() => {
      this.adjustToolbar();
    }, 300);
  }

  private getCurrentReportUrlFromEvent(event: { sender?: unknown; args?: unknown }): string | null {
    // Try to get URL from event args first (most reliable)
    const argsUrl = (event?.args as { Url?: string })?.Url;
    if (argsUrl) return argsUrl;

    // Fallback: try to get from sender's designer model
    const sender = event?.sender as { 
      reportUrl?: string | (() => string); 
      GetDesignerModel?: () => { reportUrl?: string | (() => string) };
      GetCurrentTab?: () => { reportUrl?: string | (() => string) };
    } | undefined;
    
    if (!sender) return null;

    // Try GetCurrentTab first (most current)
    if (typeof sender.GetCurrentTab === 'function') {
      const tab = sender.GetCurrentTab();
      if (tab?.reportUrl) {
        const ru = tab.reportUrl;
        return typeof ru === 'function' ? (ru as () => string)() : (ru as string);
      }
    }

    // Try direct reportUrl property
    let ru = sender.reportUrl;
    if (ru == null && typeof sender.GetDesignerModel === 'function') {
      const model = sender.GetDesignerModel();
      ru = model?.reportUrl;
    }
    if (ru == null) return null;
    return typeof ru === 'function' ? (ru as () => string)() : (ru as string);
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

    // Disable DevExpress shortcut keys that should not be available in current mode
    this.installShortcutKeyGuards();
  }

  ngOnDestroy(): void {
    this.removeShortcutKeyListener?.();
    this.removeShortcutKeyListener = null;
  }

  private installShortcutKeyGuards(): void {
    // Ensure we only register once (ngAfterViewInit can run once, but keep it safe)
    this.removeShortcutKeyListener?.();

    const handler = (e: KeyboardEvent) => {
      const isSaveKey = (e.key || '').toLowerCase() === 's';
      const hasCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Block both Ctrl/Cmd+S and Ctrl/Cmd+Shift+S in all modes
      if (hasCmdOrCtrl && isSaveKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Capture phase so we can stop DevExpress/other listeners early
    document.addEventListener('keydown', handler, true);
    this.removeShortcutKeyListener = () => document.removeEventListener('keydown', handler, true);
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

  getDesignerHeight(): string {
    // Responsive height calculation
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640; // sm breakpoint
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024; // md breakpoint
      
      if (isMobile) {
        return 'calc(100vh - 140px)'; // Mobile: account for smaller header
      } else if (isTablet) {
        return 'calc(100vh - 180px)'; // Tablet: medium header
      } else {
        return 'calc(100vh - 200px)'; // Desktop: full header
      }
    }
    return 'calc(100vh - 200px)'; // Default fallback
  }

  goBack(): void {
    // Remove the popstate listener before navigating
 
    this.router.navigate(['/reports/report-designer']);
  }

  adjustToolbar() {
    const timer = setInterval(() => {
      const items = document.querySelectorAll('.dxrd-menu-item-text');
  
      if (!items || items.length === 0) return;
  
      items.forEach(i => {
        const text = i.textContent?.trim().toLowerCase() || '';
        const root = i.closest('.dxrd-menu-item') || i.parentElement;
  
        if (this.isCreateMode && text === 'save' && root) {
          (root as HTMLElement).style.display = 'none';
        }

        if (!this.isCreateMode && text === 'save as' && root) {
          (root as HTMLElement).style.display = 'none';
        }

        if (!this.isCreateMode && text === 'save' && root) {
          (root as HTMLElement).style.display = '';
        }
      });
  
      clearInterval(timer);
    }, 300);
  }
}

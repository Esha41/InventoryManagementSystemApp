import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DxReportDesignerModule } from 'devexpress-reporting-angular';
import 'devexpress-reporting/dx-richedit'
import { ConfigService } from '@services/config.service';

@Component({
  selector: 'app-devexpress-designer',
  standalone: true,
  imports: [CommonModule, DxReportDesignerModule],
  templateUrl: './devexpress-designer.component.html',
  styles: [`
    .devexpress-designer-container {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class DevExpressDesignerComponent implements OnInit, AfterViewInit {
  reportUrl: string = 'BaseReportTemplate';
  isReady = false;
  host: string = ''; 
  invokeAction: string = '/DXXRD';
  requestHeaders: any = {};
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private config: ConfigService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Get reportUrl from query params if editing
    // this.route.queryParams.subscribe(params => {
    //   this.reportUrl = params['BaseReportTemplate'];
    // });
    this.reportUrl ='BaseReportTemplate';
    // Setup request options
    this.setupRequestOptions();
  }

  ngAfterViewInit(): void {
    // Component is ready after view init
    this.isReady = true;
    this.cdr.detectChanges();
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
    
    // Set the host and invokeAction properties directly
    // The base ReportDesignerController handles /DXXRD automatically
    // No need for getDesignerModelAction as it's handled by the base controller
    this.host = baseUrl;
    this.invokeAction = '/DXXRD';
    
    // Set authentication headers
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.requestHeaders = {
        'Authorization': `Bearer ${token}`
      };
    }
    
    // Mark as ready
    this.isReady = true;
  }
}

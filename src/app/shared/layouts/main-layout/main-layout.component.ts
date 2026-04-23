
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { ToastComponent } from '@components/toast/toast.component';
import { filter } from 'rxjs/operators';
import { AnnouncementBannerComponent } from '@components/announcement-banner/announcement-banner.component';
import { IdleTimeoutModalComponent } from '@components/idle-timeout-modal/idle-timeout-modal.component';
import { IdleService } from '@services/idle.service';
import { OnboardingTourService } from '@features/onboarding/services/onboarding-tour.service';
import { TermsAcceptanceFacade } from '@features/help/facades/terms-acceptance.facade';
import { TermsAcceptanceModalComponent } from '@features/help/components/terms-acceptance-modal/terms-acceptance-modal.component';
import { SwitchRoleModalComponent } from '@components/switch-role-modal/switch-role-modal.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavbarComponent,
    SidebarComponent,
    FooterComponent,
    ToastComponent,
    AnnouncementBannerComponent,
    IdleTimeoutModalComponent,
    TermsAcceptanceModalComponent,
    SwitchRoleModalComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  isSidebarCollapsed = false;
  mobileSidebarOpen = false;
  shouldCollapseSidebar = false;
  shouldHideSidebar = false;

  constructor(
    private router: Router,
    private idleService: IdleService,
    private onboardingTourService: OnboardingTourService,
    private termsAcceptance: TermsAcceptanceFacade
  ) {
    this.checkRoute();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkRoute();
      });
  }

  private checkRoute(): void {
    const url = this.router.url;
    this.shouldCollapseSidebar = url.includes('/report-designer/designer');
    this.shouldHideSidebar = url.includes('/report-viewer');
  }

  ngOnInit(): void {
    this.idleService.start();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.termsAcceptance.beginPostLoginFlow(), 500);
  }

  ngOnDestroy(): void {
    this.idleService.stop();
    this.onboardingTourService.destroy();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  onMobileMenuToggle(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }
}

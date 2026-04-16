import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { ToastComponent } from '@components/toast/toast.component';
import { AnnouncementBannerComponent } from '@components/announcement-banner/announcement-banner.component';
import { IdleTimeoutModalComponent } from '@components/idle-timeout-modal/idle-timeout-modal.component';
import { IdleService } from '@services/idle.service';
import { OnboardingTourService } from '@features/onboarding/services/onboarding-tour.service';
import { TermsAcceptanceFacade } from '@features/help/facades/terms-acceptance.facade';
import { TermsAcceptanceModalComponent } from '@features/help/components/terms-acceptance-modal/terms-acceptance-modal.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    SidebarComponent,
    FooterComponent,
    ToastComponent,
    AnnouncementBannerComponent,
    IdleTimeoutModalComponent,
    TermsAcceptanceModalComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  isSidebarCollapsed = false;
  mobileSidebarOpen = false;

  constructor(
    private idleService: IdleService,
    private onboardingTourService: OnboardingTourService,
    private termsAcceptance: TermsAcceptanceFacade
  ) {}

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


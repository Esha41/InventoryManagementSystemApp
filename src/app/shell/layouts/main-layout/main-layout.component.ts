
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { Component, OnInit, OnDestroy, AfterViewInit, Optional, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '@shared/layouts/sidebar/sidebar.component';
import { FooterComponent } from '@shared/layouts/footer/footer.component';
import { ToastComponent } from '@components/toast/toast.component';
import { filter } from 'rxjs/operators';
import { AnnouncementBannerComponent } from '@admin/components/announcement-banner/announcement-banner.component';
import { IdleTimeoutModalComponent } from '@components/idle-timeout-modal/idle-timeout-modal.component';
import { IdleService } from '@services/idle.service';
import { ONBOARDING_TOUR } from '@core/tokens/onboarding-tour.token';
import { IOnboardingTourProvider } from '@core/interfaces/onboarding-tour-provider.interface';
import { TermsAcceptanceFacade } from '@features/help/facades/terms-acceptance.facade';
import { TermsAcceptanceModalComponent } from '@features/help/components/terms-acceptance-modal/terms-acceptance-modal.component';
import { SwitchRoleModalComponent } from '@auth/components/switch-role-modal/switch-role-modal.component';
import { ShellRouteData } from '@core/routing/shell-route-data';

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
    @Optional() @Inject(ONBOARDING_TOUR) private onboardingTourService: IOnboardingTourProvider | null,
    private termsAcceptance: TermsAcceptanceFacade
  ) {
    this.checkRoute();
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.checkRoute();
      });
  }

  private checkRoute(): void {
    const shell = this.getLeafShellData();
    this.shouldCollapseSidebar = shell?.collapseSidebar ?? false;
    this.shouldHideSidebar = shell?.hideSidebar ?? false;
  }

  /** Deepest primary-outlet snapshot carries `data.shell` from the active leaf route. */
  private getLeafShellData(): ShellRouteData | undefined {
    let snapshot: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
    }
    return snapshot.data['shell'] as ShellRouteData | undefined;
  }

  ngOnInit(): void {
    this.idleService.start();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.termsAcceptance.beginPostLoginFlow(), 500);
  }

  ngOnDestroy(): void {
    this.idleService.stop();
    this.onboardingTourService?.destroy();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  onMobileMenuToggle(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { ToastComponent } from '@components/toast/toast.component';
import { AnnouncementBannerComponent } from '@components/announcement-banner/announcement-banner.component';
import { IdleTimeoutModalComponent } from '@components/idle-timeout-modal/idle-timeout-modal.component';
import { IdleService } from '@services/idle.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent, FooterComponent, ToastComponent, AnnouncementBannerComponent, IdleTimeoutModalComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  mobileSidebarOpen = false;

  constructor(private idleService: IdleService) {}

  ngOnInit(): void {
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  onMobileMenuToggle(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }
}


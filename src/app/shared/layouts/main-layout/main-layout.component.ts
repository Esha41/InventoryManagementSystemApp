import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { ToastComponent } from '@components/toast/toast.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent, FooterComponent, ToastComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent {
  isSidebarCollapsed = false;
  shouldCollapseSidebar = false;
  shouldHideSidebar = false;

  constructor(private router: Router) {
    // Check current route
    this.checkRoute();
    
    // Listen for route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkRoute();
      });
  }

  private checkRoute(): void {
    const url = this.router.url;
    // Collapse sidebar when on report designer create screen
    this.shouldCollapseSidebar = url.includes('/report-designer/designer');
    // Hide sidebar completely when on report viewer
    this.shouldHideSidebar = url.includes('/report-viewer');
  }

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }
}


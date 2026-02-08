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
  mobileSidebarOpen = false;

  onSidebarToggle(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  onMobileMenuToggle(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }
}


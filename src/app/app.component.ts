import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@services/theme.service';
import { APP_NOTIFICATIONS_BOOTSTRAP } from '@core/notifications/app-notifications-bootstrap.token';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: []
})
export class AppComponent implements OnInit {
  private readonly appNotifications = inject(APP_NOTIFICATIONS_BOOTSTRAP);
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    this.appNotifications.initialize();
    this.themeService.initialize();
  }
}


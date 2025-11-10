import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '@services/translation.service';
import { NotificationService } from '@services/notification.service';

/**
 * Root Application Component
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'angular-enterprise-app';

  constructor(
    private translationService: TranslationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Translation service initializes automatically
    this.notificationService.initialize();
  }
}


import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '@services/translation.service';
import { NotificationService } from '@services/notification.service';
import { ThemeService } from '@services/theme.service';

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
    private notificationService: NotificationService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.notificationService.initialize();
    this.themeService.initialize();
  }
}


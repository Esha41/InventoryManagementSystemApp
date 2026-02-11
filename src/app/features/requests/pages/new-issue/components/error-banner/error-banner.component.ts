import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Error Banner Component
 * Simple error message banner with optional retry action
 */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './error-banner.component.html',
  styleUrls: ['./error-banner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorBannerComponent {
  @Input() error: string | null = null;
  @Input() showRetry: boolean = false;
  @Output() retry = new EventEmitter<void>();
}


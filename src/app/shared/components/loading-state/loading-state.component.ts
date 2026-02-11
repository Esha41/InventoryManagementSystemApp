import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Loading State Component
 * Reusable loading spinner with optional message
 */
@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="computedContainerClass()" role="status" aria-live="polite" [attr.aria-label]="message() || 'Loading'">
      <div [class]="computedSpinnerContainerClass()">
        <div [class]="computedSpinnerClass()" aria-hidden="true"></div>
        @if (message()) {
          <p [class]="computedMessageClass()">{{ message() | translate }}</p>
        }
      </div>
    </div>
  `,
  styles: []
})
export class LoadingStateComponent {
  // Input signals (Angular 21 feature)
  message = input<string | undefined>(undefined);
  size = input<'sm' | 'md' | 'lg'>('md');
  fullPage = input<boolean>(false);
  containerClass = input<string>('');
  spinnerContainerClass = input<string>('');
  spinnerClass = input<string>('');
  messageClass = input<string>('');

  // Computed signals - automatically update when inputs change
  computedContainerClass = computed(() => {
    if (this.containerClass()) return this.containerClass();
    return this.fullPage()
      ? 'flex justify-center items-center py-20'
      : 'flex justify-center items-center py-8';
  });

  computedSpinnerContainerClass = computed(() => {
    if (this.spinnerContainerClass()) return this.spinnerContainerClass();
    return this.message()
      ? 'flex flex-col items-center gap-4'
      : 'flex items-center';
  });

  computedSpinnerClass = computed(() => {
    if (this.spinnerClass()) return this.spinnerClass();

    const sizeClasses = {
      sm: 'h-8 w-8 border-2',
      md: 'h-12 w-12 border-4',
      lg: 'h-16 w-16 border-4'
    };

    return `animate-spin rounded-full ${sizeClasses[this.size()]} border-[var(--color-border)] border-t-[var(--color-brand)]`;
  });

  computedMessageClass = computed(() => {
    if (this.messageClass()) return this.messageClass();
    return 'text-sm text-[var(--color-text-muted)]';
  });
}


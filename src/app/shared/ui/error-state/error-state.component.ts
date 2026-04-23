import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, AlertTriangle, X } from 'lucide-angular';

/**
 * Error State Component
 * Reusable error display with multiple layout options
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) {
      <div [class]="computedContainerClass()" role="alert" aria-live="assertive">
        <div [class]="computedContentClass()">
          <!-- Icon -->
          <div [class]="computedIconContainerClass()" aria-hidden="true">
            <lucide-angular 
              [img]="AlertTriangle" 
              [class]="computedIconClass()">
            </lucide-angular>
          </div>

          <!-- Content -->
          <div [class]="computedTextContainerClass()">
            @if (title()) {
              <h3 [class]="computedTitleClass()">
                {{ title() | translate }}
              </h3>
            }
            <p [class]="computedMessageClass()">
              {{ error() | translate }}
            </p>
          </div>

          <!-- Close Button (if dismissible) -->
          @if (dismissible()) {
            <button
              type="button"
              (click)="onDismiss()"
              [class]="computedCloseButtonClass()"
              [attr.aria-label]="'common.close' | translate">
              <lucide-angular [img]="X" [class]="computedCloseIconClass()"></lucide-angular>
            </button>
          }
        </div>

        <!-- Action Button (optional) -->
        @if (actionText()) {
          <button
            (click)="onAction()"
            [class]="computedActionButtonClass()">
            {{ actionText() | translate }}
          </button>
        }
      </div>
    }
  `,
  styles: []
})
export class ErrorStateComponent {
  // Input signals
  error = input<string | null>(null);
  title = input<string | undefined>(undefined);
  variant = input<'inline' | 'centered' | 'banner'>('inline');
  dismissible = input<boolean>(false);
  actionText = input<string | undefined>(undefined);
  containerClass = input<string>('');
  contentClass = input<string>('');
  iconContainerClass = input<string>('');
  iconClass = input<string>('');
  textContainerClass = input<string>('');
  titleClass = input<string>('');
  messageClass = input<string>('');
  closeButtonClass = input<string>('');
  closeIconClass = input<string>('');
  actionButtonClass = input<string>('');

  // Output signals
  dismissed = output<void>();
  action = output<void>();

  readonly AlertTriangle = AlertTriangle;
  readonly X = X;

  computedContainerClass = computed(() => {
    if (this.containerClass()) return this.containerClass();

    switch (this.variant()) {
      case 'centered':
        return 'flex flex-col items-center justify-center py-20';
      case 'banner':
        return 'mb-6';
      case 'inline':
      default:
        return '';
    }
  });

  computedContentClass = computed(() => {
    if (this.contentClass()) return this.contentClass();

    switch (this.variant()) {
      case 'centered':
        return 'bg-white rounded-xl shadow-custom-md p-8 max-w-md w-full border border-[var(--color-border)] flex flex-col items-center text-center';
      case 'banner':
        return 'bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3';
      case 'inline':
      default:
        return 'bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3';
    }
  });

  // Computed default classes based on variant
  defaultIconContainerClass = computed(() => {
    switch (this.variant()) {
      case 'centered':
        return 'w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4';
      case 'banner':
      case 'inline':
      default:
        return 'flex-shrink-0';
    }
  });

  defaultIconClass = computed(() => {
    switch (this.variant()) {
      case 'centered':
        return 'h-8 w-8 text-[var(--color-error)]';
      case 'banner':
      case 'inline':
      default:
        return 'h-5 w-5 text-red-600';
    }
  });

  defaultTextContainerClass = computed(() => {
    switch (this.variant()) {
      case 'centered':
        return 'flex-1';
      case 'banner':
      case 'inline':
      default:
        return 'flex-1';
    }
  });

  defaultTitleClass = computed(() => {
    switch (this.variant()) {
      case 'centered':
        return 'text-lg font-semibold text-[var(--color-text)] mb-2';
      case 'banner':
      case 'inline':
      default:
        return 'text-sm font-medium text-red-800 mb-1';
    }
  });

  defaultMessageClass = computed(() => {
    switch (this.variant()) {
      case 'centered':
        return 'text-sm text-[var(--color-text-muted)] mb-6';
      case 'banner':
      case 'inline':
      default:
        return 'text-sm text-red-800';
    }
  });

  defaultCloseButtonClass = computed(() => {
    return 'flex-shrink-0 text-red-600 hover:text-red-800 transition-colors';
  });

  defaultCloseIconClass = computed(() => {
    return 'h-5 w-5';
  });

  defaultActionButtonClass = computed(() => {
    return 'mt-6 px-6 py-2.5 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:bg-[var(--color-brand-dark)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2';
  });

  // Computed classes - use custom if provided, otherwise defaults
  computedIconContainerClass = computed(() => {
    return this.iconContainerClass() || this.defaultIconContainerClass();
  });

  computedIconClass = computed(() => {
    return this.iconClass() || this.defaultIconClass();
  });

  computedTextContainerClass = computed(() => {
    return this.textContainerClass() || this.defaultTextContainerClass();
  });

  computedTitleClass = computed(() => {
    return this.titleClass() || this.defaultTitleClass();
  });

  computedMessageClass = computed(() => {
    return this.messageClass() || this.defaultMessageClass();
  });

  computedCloseButtonClass = computed(() => {
    return this.closeButtonClass() || this.defaultCloseButtonClass();
  });

  computedCloseIconClass = computed(() => {
    return this.closeIconClass() || this.defaultCloseIconClass();
  });

  computedActionButtonClass = computed(() => {
    return this.actionButtonClass() || this.defaultActionButtonClass();
  });

  onDismiss(): void {
    this.dismissed.emit();
  }

  onAction(): void {
    this.action.emit();
  }
}


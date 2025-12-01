import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
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
    <div *ngIf="error" [class]="computedContainerClass" role="alert" aria-live="assertive">
      <div [class]="computedContentClass">
        <!-- Icon -->
        <div [class]="computedIconContainerClass" aria-hidden="true">
          <lucide-angular 
            [img]="AlertTriangle" 
            [class]="computedIconClass">
          </lucide-angular>
        </div>

        <!-- Content -->
        <div [class]="computedTextContainerClass">
          <h3 *ngIf="title" [class]="computedTitleClass">
            {{ title | translate }}
          </h3>
          <p [class]="computedMessageClass">
            {{ error | translate }}
          </p>
        </div>

        <!-- Close Button (if dismissible) -->
        <button
          *ngIf="dismissible"
          type="button"
          (click)="onDismiss()"
          [class]="computedCloseButtonClass"
          [attr.aria-label]="'common.close' | translate">
          <lucide-angular [img]="X" [class]="computedCloseIconClass"></lucide-angular>
        </button>
      </div>

      <!-- Action Button (optional) -->
      <button
        *ngIf="actionText"
        (click)="onAction()"
        [class]="computedActionButtonClass">
        {{ actionText | translate }}
      </button>
    </div>
  `,
  styles: []
})
export class ErrorStateComponent {
  @Input() error: string | null = null;
  @Input() title?: string;
  @Input() variant: 'inline' | 'centered' | 'banner' = 'inline';
  @Input() dismissible: boolean = false;
  @Input() actionText?: string;
  @Input() containerClass: string = '';
  @Input() contentClass: string = '';
  @Input() iconContainerClass: string = '';
  @Input() iconClass: string = '';
  @Input() textContainerClass: string = '';
  @Input() titleClass: string = '';
  @Input() messageClass: string = '';
  @Input() closeButtonClass: string = '';
  @Input() closeIconClass: string = '';
  @Input() actionButtonClass: string = '';

  @Output() dismissed = new EventEmitter<void>();
  @Output() action = new EventEmitter<void>();

  readonly AlertTriangle = AlertTriangle;
  readonly X = X;

  get computedContainerClass(): string {
    if (this.containerClass) return this.containerClass;

    switch (this.variant) {
      case 'centered':
        return 'flex flex-col items-center justify-center py-20';
      case 'banner':
        return 'mb-6';
      case 'inline':
      default:
        return '';
    }
  }

  get computedContentClass(): string {
    if (this.contentClass) return this.contentClass;

    switch (this.variant) {
      case 'centered':
        return 'bg-white rounded-xl shadow-custom-md p-8 max-w-md w-full border border-[var(--color-border)] flex flex-col items-center text-center';
      case 'banner':
        return 'bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3';
      case 'inline':
      default:
        return 'bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3';
    }
  }

  get defaultIconContainerClass(): string {
    switch (this.variant) {
      case 'centered':
        return 'w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4';
      case 'banner':
      case 'inline':
      default:
        return 'flex-shrink-0';
    }
  }

  get defaultIconClass(): string {
    switch (this.variant) {
      case 'centered':
        return 'h-8 w-8 text-[var(--color-error)]';
      case 'banner':
      case 'inline':
      default:
        return 'h-5 w-5 text-red-600';
    }
  }

  get defaultTextContainerClass(): string {
    switch (this.variant) {
      case 'centered':
        return 'flex-1';
      case 'banner':
      case 'inline':
      default:
        return 'flex-1';
    }
  }

  get defaultTitleClass(): string {
    switch (this.variant) {
      case 'centered':
        return 'text-lg font-semibold text-[var(--color-text)] mb-2';
      case 'banner':
      case 'inline':
      default:
        return 'text-sm font-medium text-red-800 mb-1';
    }
  }

  get defaultMessageClass(): string {
    switch (this.variant) {
      case 'centered':
        return 'text-sm text-[var(--color-text-muted)] mb-6';
      case 'banner':
      case 'inline':
      default:
        return 'text-sm text-red-800';
    }
  }

  get defaultCloseButtonClass(): string {
    return 'flex-shrink-0 text-red-600 hover:text-red-800 transition-colors';
  }

  get defaultCloseIconClass(): string {
    return 'h-5 w-5';
  }

  get defaultActionButtonClass(): string {
    return 'mt-6 px-6 py-2.5 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:bg-[var(--color-brand-dark)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2';
  }

  // Computed getters that use custom classes if provided, otherwise defaults
  get computedIconContainerClass(): string {
    return this.iconContainerClass || this.defaultIconContainerClass;
  }

  get computedIconClass(): string {
    return this.iconClass || this.defaultIconClass;
  }

  get computedTextContainerClass(): string {
    return this.textContainerClass || this.defaultTextContainerClass;
  }

  get computedTitleClass(): string {
    return this.titleClass || this.defaultTitleClass;
  }

  get computedMessageClass(): string {
    return this.messageClass || this.defaultMessageClass;
  }

  get computedCloseButtonClass(): string {
    return this.closeButtonClass || this.defaultCloseButtonClass;
  }

  get computedCloseIconClass(): string {
    return this.closeIconClass || this.defaultCloseIconClass;
  }

  get computedActionButtonClass(): string {
    return this.actionButtonClass || this.defaultActionButtonClass;
  }

  onDismiss(): void {
    this.dismissed.emit();
  }

  onAction(): void {
    this.action.emit();
  }
}


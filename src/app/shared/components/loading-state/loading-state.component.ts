import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
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
    <div [class]="computedContainerClass" role="status" aria-live="polite" [attr.aria-label]="message || 'Loading'">
      <div [class]="computedSpinnerContainerClass">
        <div [class]="computedSpinnerClass" aria-hidden="true"></div>
        <p *ngIf="message" [class]="computedMessageClass">{{ message | translate }}</p>
      </div>
    </div>
  `,
  styles: []
})
export class LoadingStateComponent {
  @Input() message?: string;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() fullPage: boolean = false;
  @Input() containerClass: string = '';
  @Input() spinnerContainerClass: string = '';
  @Input() spinnerClass: string = '';
  @Input() messageClass: string = '';

  // Use default classes if not overridden
  get computedContainerClass(): string {
    if (this.containerClass) return this.containerClass;
    return this.fullPage 
      ? 'flex justify-center items-center py-20' 
      : 'flex justify-center items-center py-8';
  }

  get computedSpinnerContainerClass(): string {
    if (this.spinnerContainerClass) return this.spinnerContainerClass;
    return this.message 
      ? 'flex flex-col items-center gap-4' 
      : 'flex items-center';
  }

  get computedSpinnerClass(): string {
    if (this.spinnerClass) return this.spinnerClass;
    
    const sizeClasses = {
      sm: 'h-8 w-8 border-2',
      md: 'h-12 w-12 border-4',
      lg: 'h-16 w-16 border-4'
    };
    
    return `animate-spin rounded-full ${sizeClasses[this.size]} border-[var(--color-border)] border-t-[var(--color-brand)]`;
  }

  get computedMessageClass(): string {
    if (this.messageClass) return this.messageClass;
    return 'text-sm text-[var(--color-text-muted)]';
  }
}


import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.css']
})
export class ButtonComponent {
  // Input signals
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input<boolean>(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  /** Binds the native `form` attribute (associate submit with a form by its `id` when the button is outside the form). */
  formId = input<string | undefined>(undefined);
  fullWidth = input<boolean>(false);

  // Output signal
  clicked = output<Event>();

  onClick(event: Event): void {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }

  // Computed signal for button classes
  buttonClasses = computed(() => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-background)]';

    const variantClasses = {
      primary: 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] focus:ring-[var(--color-brand)]',
      secondary: 'bg-[var(--color-secondary)] text-[var(--color-secondary-text)] hover:bg-[var(--color-secondary-hover)] focus:ring-[var(--color-secondary)]',
      outline: 'border-2 border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-background-hover)] focus:ring-[var(--color-border)]',
      ghost: 'text-[var(--color-text)] hover:bg-[var(--color-background-hover)] focus:ring-[var(--color-background-active)]',
      danger: 'bg-[var(--color-error)] text-white hover:opacity-90 focus:ring-[var(--color-error)]'
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };

    const widthClass = this.fullWidth() ? 'w-full' : '';
    const disabledClass = this.disabled() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

    return `${baseClasses} ${variantClasses[this.variant()]} ${sizeClasses[this.size()]} ${widthClass} ${disabledClass}`;
  });
}


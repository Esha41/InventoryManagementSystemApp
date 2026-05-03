import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

/**
 * Reusable Modal Component
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div 
      *ngIf="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
    >
      <!-- Backdrop -->
      <button
        type="button"
        aria-label="Close dialog"
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity w-full min-h-[100vh] cursor-default border-0 p-0 m-0"
        (click)="onBackdropClick($event)"
      ></button>

      <!-- Modal Container -->
      <div class="relative flex min-h-full items-center justify-center p-4 pointer-events-none">
        <!-- Modal Content -->
        <div 
          class="relative bg-[var(--color-background)] rounded-lg shadow-custom-xl w-full transition-all pointer-events-auto"
          [class.max-w-md]="size === 'sm'"
          [class.max-w-2xl]="size === 'md'"
          [class.max-w-4xl]="size === 'lg'"
          [class.max-w-6xl]="size === 'xl'"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
            <h2 class="text-xl font-semibold text-[var(--color-text)]">{{ title }}</h2>
            <button
              *ngIf="showCloseButton"
              type="button"
              (click)="close()"
              class="p-1 rounded-lg hover:bg-[var(--color-background-hover)] transition-colors"
              aria-label="Close modal"
            >
              <lucide-angular [img]="X" class="h-5 w-5 text-[var(--color-text-muted)]"></lucide-angular>
            </button>
          </div>

          <!-- Body -->
          <div
            class="p-6 min-w-0 w-full"
            [class.overflow-y-auto]="scrollable"
            [style.max-height]="scrollable ? (bodyMaxHeight || '60vh') : null"
          >
            <ng-content></ng-content>
          </div>

          <!-- Footer -->
          <div *ngIf="showFooter" class="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border)]">
            <ng-content select="[modal-footer]"></ng-content>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() showCloseButton = true;
  @Input() showFooter = true;
  @Input() scrollable = true;
  /** When scrollable, cap body height (e.g. min(78vh, 820px)). Defaults to 60vh. */
  @Input() bodyMaxHeight: string | null = null;
  @Input() closeOnBackdrop = true;
  
  @Output() closed = new EventEmitter<void>();

  readonly X = X;

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(_event: MouseEvent): void {
    // Close when clicking on the backdrop
    if (this.closeOnBackdrop) {
      this.close();
    }
  }
}


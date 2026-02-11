import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent, ButtonComponent, LucideAngularModule],
  template: `
    <app-modal
      [isOpen]="isOpen"
      [title]="title"
      size="sm"
      (closed)="onCancel()"
    >
      <div class="text-center">
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-[var(--color-error)]/10 mb-4">
          <lucide-angular [img]="AlertTriangle" class="h-6 w-6 text-[var(--color-error)]"></lucide-angular>
        </div>
        <h3 class="text-lg font-medium text-[var(--color-text)] mb-2">{{ message }}</h3>
        <p *ngIf="description" class="text-sm text-[var(--color-text-muted)]">{{ description }}</p>
      </div>

      <div modal-footer class="flex gap-3 justify-center">
        <app-button
          variant="outline"
          (clicked)="onCancel()"
        >
          {{ cancelText }}
        </app-button>
        <app-button
          [variant]="confirmVariant"
          (clicked)="onConfirm()"
        >
          {{ confirmText }}
        </app-button>
      </div>
    </app-modal>
  `
})
export class ConfirmDialogComponent {
  @Input() isOpen = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to continue?';
  @Input() description = '';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() confirmVariant: 'primary' | 'danger' = 'danger';
  
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly AlertTriangle = AlertTriangle;

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}


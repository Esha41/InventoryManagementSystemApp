import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle, CheckCircle, Info, X } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

export type ConfirmationType = 'warning' | 'danger' | 'info' | 'success';

/**
 * Reusable Confirmation Dialog Component
 * 
 * @example
 * ```html
 * <app-confirmation-dialog
 *   [isOpen]="showDialog"
 *   [title]="'Confirm Action'"
 *   [message]="'Are you sure?'"
 *   [type]="'warning'"
 *   (confirmed)="onConfirm()"
 *   (cancelled)="onCancel()"
 * ></app-confirmation-dialog>
 * ```
 */
@Component({
    selector: 'app-confirmation-dialog',
    standalone: true,
    imports: [CommonModule, LucideAngularModule, TranslateModule],
    templateUrl: './confirmation-dialog.component.html',
    styleUrls: ['./confirmation-dialog.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmationDialogComponent {
    @Input() isOpen = false;
    @Input() title = '';
    @Input() message = '';
    @Input() type: ConfirmationType = 'warning';
    @Input() confirmText = '';
    @Input() cancelText = '';
    @Input() showCloseButton = true;
    @Input() closeOnBackdrop = false;

    @Output() confirmed = new EventEmitter<void>();
    @Output() cancelled = new EventEmitter<void>();

    readonly AlertTriangle = AlertTriangle;
    readonly CheckCircle = CheckCircle;
    readonly Info = Info;
    readonly X = X;

    /**
     * Handle ESC key press to close dialog
     */
    @HostListener('document:keydown.escape', ['$event'])
    handleEscapeKey(event: KeyboardEvent): void {
        if (this.isOpen && this.closeOnBackdrop) {
            event.preventDefault();
            this.onCancel();
        }
    }

    /**
     * Get the appropriate icon based on dialog type
     */
    getIcon(): any {
        switch (this.type) {
            case 'warning':
            case 'danger':
                return AlertTriangle;
            case 'success':
                return CheckCircle;
            case 'info':
            default:
                return Info;
        }
    }

    /**
     * Emit confirmed event
     */
    onConfirm(): void {
        this.confirmed.emit();
    }

    /**
     * Emit cancelled event
     */
    onCancel(): void {
        this.cancelled.emit();
    }

    /**
     * Handle backdrop click
     */
    onBackdropClick(): void {
        if (this.closeOnBackdrop) {
            this.onCancel();
        }
    }
}

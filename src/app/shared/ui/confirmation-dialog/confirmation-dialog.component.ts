import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
 *   [requireComment]="true"
 *   [commentLabel]="'Enter your comment'"
 *   [commentPlaceholder]="'Type here...'"
 *   (confirmed)="onConfirm($event)"
 *   (cancelled)="onCancel()"
 * ></app-confirmation-dialog>
 * ```
 */
@Component({
    selector: 'app-confirmation-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule, TranslateModule],
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

    // Comment field support
    @Input() requireComment = false;
    @Input() commentLabel = '';
    @Input() commentPlaceholder = '';
    @Input() commentRows = 3;

    @Output() confirmed = new EventEmitter<string | undefined>();
    @Output() cancelled = new EventEmitter<void>();

    readonly AlertTriangle = AlertTriangle;
    readonly CheckCircle = CheckCircle;
    readonly Info = Info;
    readonly X = X;

    // Internal comment state
    comment = '';

    /**
     * Handle ESC key press to close dialog
     */
    @HostListener('document:keydown.escape', ['$event'])
    handleEscapeKey(event: Event): void {
        const keyboardEvent = event as KeyboardEvent;
        if (this.isOpen && this.closeOnBackdrop) {
            keyboardEvent.preventDefault();
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
     * Check if confirm button should be disabled
     */
    isConfirmDisabled(): boolean {
        if (this.requireComment) {
            return !this.comment || !this.comment.trim();
        }
        return false;
    }

    /**
     * Emit confirmed event with optional comment
     */
    onConfirm(): void {
        if (this.isConfirmDisabled()) {
            return;
        }

        if (this.requireComment) {
            this.confirmed.emit(this.comment.trim());
        } else {
            this.confirmed.emit();
        }

        // Reset comment after confirmation
        this.comment = '';
    }

    /**
     * Emit cancelled event and reset comment
     */
    onCancel(): void {
        this.comment = '';
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

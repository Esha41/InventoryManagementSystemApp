import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ConfirmationType } from '@components/confirmation-dialog/confirmation-dialog.component';

export interface ConfirmationDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  type: ConfirmationType;
  confirmText: string;
  cancelText: string;
  requireComment: boolean;
  commentLabel: string;
  commentPlaceholder: string;
  onConfirm: (comment?: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalConfirmationService {
  private confirmationDialogSubject = new BehaviorSubject<ConfirmationDialogState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    confirmText: '',
    cancelText: '',
    requireComment: false,
    commentLabel: '',
    commentPlaceholder: '',
    onConfirm: () => {}
  });

  confirmationDialog$: Observable<ConfirmationDialogState> = this.confirmationDialogSubject.asObservable();

  get confirmationDialog(): ConfirmationDialogState {
    return this.confirmationDialogSubject.value;
  }

  /**
   * Show confirmation dialog
   */
  showConfirmationDialog(
    title: string,
    message: string,
    type: ConfirmationType,
    confirmText: string,
    cancelText: string,
    onConfirm: (comment?: string) => void,
    requireComment: boolean = false,
    commentLabel: string = '',
    commentPlaceholder: string = ''
  ): void {
    this.confirmationDialogSubject.next({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      cancelText,
      requireComment,
      commentLabel,
      commentPlaceholder,
      onConfirm
    });
  }

  /**
   * Close confirmation dialog
   */
  closeConfirmationDialog(): void {
    const current = this.confirmationDialogSubject.value;
    this.confirmationDialogSubject.next({
      ...current,
      isOpen: false
    });
  }

  /**
   * Handle confirmation dialog confirm action
   */
  onConfirmationConfirmed(comment?: string): void {
    const current = this.confirmationDialogSubject.value;
    if (current.onConfirm) {
      current.onConfirm(comment);
    }
    this.closeConfirmationDialog();
  }

  /**
   * Handle confirmation dialog cancel action
   */
  onConfirmationCancelled(): void {
    this.closeConfirmationDialog();
  }
}

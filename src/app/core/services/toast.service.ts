import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<Toast>();
  public toast$: Observable<Toast> = this.toastSubject.asObservable();

  /**
   * Show a success toast
   */
  success(message: string, title: string = 'Success', duration: number = 3000): void {
    this.show('success', message, title, duration);
  }

  /**
   * Show an error toast
   */
  error(message: string, title: string = 'Error', duration: number = 5000): void {
    this.show('error', message, title, duration);
  }

  /**
   * Show a warning toast
   */
  warning(message: string, title?: string, duration: number = 4000): void {
    this.show('warning', message, title, duration);
  }

  /**
   * Show an info toast
   */
  info(message: string, title?: string, duration: number = 3000): void {
    this.show('info', message, title, duration);
  }

  /**
   * Show a toast with custom configuration
   */
  private show(type: Toast['type'], message: string, title?: string, duration?: number): void {
    const toast: Toast = {
      id: this.generateId(),
      type,
      message,
      title,
      duration
    };
    this.toastSubject.next(toast);
  }

  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}


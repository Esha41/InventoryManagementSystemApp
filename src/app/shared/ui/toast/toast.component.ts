import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-angular';
import { ToastService, Toast } from '@services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <div
        *ngFor="let toast of toasts; trackBy: trackById"
        [class]="getToastClass(toast.type)"
        class="flex items-start gap-3 p-4 rounded-lg shadow-lg border backdrop-blur-sm transition-all duration-300">
        
        <!-- Icon -->
        <div class="flex-shrink-0 mt-0.5">
          <lucide-angular 
            *ngIf="toast.type === 'success'" 
            [img]="CheckCircle" 
            class="w-5 h-5 text-[var(--color-success)]"></lucide-angular>
          <lucide-angular 
            *ngIf="toast.type === 'error'" 
            [img]="XCircle" 
            class="w-5 h-5 text-[var(--color-error)]"></lucide-angular>
          <lucide-angular 
            *ngIf="toast.type === 'warning'" 
            [img]="AlertCircle" 
            class="w-5 h-5 text-[var(--color-warning)]"></lucide-angular>
          <lucide-angular 
            *ngIf="toast.type === 'info'" 
            [img]="Info" 
            class="w-5 h-5 text-[var(--color-info)]"></lucide-angular>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <h4 *ngIf="toast.title" class="font-semibold text-sm text-[var(--color-text)] mb-1">
            {{ toast.title }}
          </h4>
          <p class="text-sm text-[var(--color-text-muted)]">
            {{ toast.message }}
          </p>
        </div>

        <!-- Close Button -->
        <button
          (click)="removeToast(toast.id)"
          class="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          <lucide-angular [img]="X" class="w-4 h-4"></lucide-angular>
        </button>
      </div>
    </div>
  `,
  styles: []
})
export class ToastComponent implements OnInit, OnDestroy {
  readonly CheckCircle = CheckCircle;
  readonly XCircle = XCircle;
  readonly AlertCircle = AlertCircle;
  readonly Info = Info;
  readonly X = X;

  toasts: Toast[] = [];
  private destroy$ = new Subject<void>();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toast$
      .pipe(takeUntil(this.destroy$))
      .subscribe(toast => {
        this.toasts.push(toast);
        
        // Auto-remove after duration
        if (toast.duration) {
          setTimeout(() => {
            this.removeToast(toast.id);
          }, toast.duration);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  removeToast(id: string): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  trackById(_: number, toast: Toast): string {
    return toast.id;
  }

  getToastClass(type: Toast['type']): string {
    const baseClasses = 'bg-[var(--color-background)] border-l-4';
    switch (type) {
      case 'success':
        return `${baseClasses} border-[var(--color-success)]`;
      case 'error':
        return `${baseClasses} border-[var(--color-error)]`;
      case 'warning':
        return `${baseClasses} border-[var(--color-warning)]`;
      case 'info':
        return `${baseClasses} border-[var(--color-info)]`;
      default:
        return `${baseClasses} border-[var(--color-border)]`;
    }
  }
}


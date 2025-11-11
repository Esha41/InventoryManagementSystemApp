import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Notification } from '../models/notification.model';
import { NotificationService } from '@services/notification.service';
import { ToastService } from '@services/toast.service';

@Component({
  selector: 'app-notification-schedule-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './notification-schedule-page.component.html',
  styleUrls: ['./notification-schedule-page.component.css']
})
export class NotificationSchedulePageComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;

  notification: Notification | null = null;
  pickupDate = '';
  pickupTime = '';
  loading = true;
  notFound = false;
  saving = false;

  private destroy$ = new Subject<void>();
  private targetId: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
    private readonly toastService: ToastService,
    private readonly translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.notificationService.initialize();

    combineLatest([
      this.route.paramMap,
      this.notificationService.notifications$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, notifications]) => {
        const idParam = params.get('id');
        this.targetId = idParam ? Number(idParam) : null;
        if (!this.targetId || Number.isNaN(this.targetId)) {
          this.notFound = true;
          this.loading = false;
          return;
        }

        const list = notifications ?? [];
        const match = list.find(n => n.id === this.targetId);
        if (match) {
          this.notification = match;
          this.pickupDate = this.extractDate(match);
          this.pickupTime = this.extractTime(match);
          this.loading = false;
          this.notFound = false;
        } else {
          this.notificationService.refresh();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/notifications', this.targetId ?? '']);
  }

  onSubmit(form: NgForm): void {
    if (!this.notification || this.saving) {
      return;
    }

    if (!form.valid) {
      this.toastService.warning(
        this.translate.instant('notifications.provideSchedule'),
        this.translate.instant('toast.warning')
      );
      form.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.notificationService.proposeNewTime(this.notification.id, {
      pickupDate: this.pickupDate,
      pickupTime: this.pickupTime
    }).subscribe({
      next: () => {
        if (this.notification && !this.notification.isRead) {
          this.notificationService.markAsRead(this.notification.id).subscribe({
            next: () => this.navigateBackToList(),
            error: () => this.navigateBackToList()
          });
        } else {
          this.navigateBackToList();
        }
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  private extractDate(notification: Notification): string {
    const value = notification.metadata?.['pickupDate'] ?? notification.metadata?.['scheduledDate'];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return '';
    }
    return this.toDateInput(value);
  }

  private extractTime(notification: Notification): string {
    const value = notification.metadata?.['pickupTime'] ?? notification.metadata?.['scheduledTime'];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return '';
    }
    return this.toTimeInput(value);
  }

  private toDateInput(value: string): string {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(parsed, 'yyyy-MM-dd', 'en');
    }

    const fallback = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (fallback) {
      const day = Number(fallback[1]);
      const month = Number(fallback[2]);
      const year = Number(fallback[3]);
      if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
        return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    return '';
  }

  private toTimeInput(value: string): string {
    const normalized = value.trim();
    const match = normalized.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
    if (match) {
      let hours = Number(match[1]);
      const minutes = match[2];
      const meridiem = match[3];

      if (meridiem) {
        const upper = meridiem.toUpperCase();
        if (upper === 'PM' && hours < 12) {
          hours += 12;
        }
        if (upper === 'AM' && hours === 12) {
          hours = 0;
        }
      }

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    const parsed = Date.parse(`1970-01-01T${normalized}`);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    return '';
  }

  private navigateBackToList(): void {
    this.saving = false;
    this.router.navigate(['/notifications']);
  }
}


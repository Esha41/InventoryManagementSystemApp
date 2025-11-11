import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Subject, combineLatest } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { NotificationService } from '@services/notification.service';
import { Notification } from '../models/notification.model';

@Component({
  selector: 'app-notification-detail-page',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './notification-detail-page.component.html',
  styleUrls: ['./notification-detail-page.component.css']
})
export class NotificationDetailPageComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;

  notification: Notification | null = null;
  loading = true;
  notFound = false;
  confirming = false;

  private destroy$ = new Subject<void>();
  private targetId: number | null = null;
  private attemptedRefresh = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notificationService: NotificationService
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
          this.loading = false;
          this.notFound = false;
          if (!match.isRead) {
            this.notificationService.markAsRead(match.id).subscribe({
              error: () => this.notificationService.refresh()
            });
          }
        } else if (!this.attemptedRefresh) {
          this.attemptedRefresh = true;
          this.notificationService.refresh();
        } else {
          this.loading = false;
          this.notFound = true;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/notifications']);
  }

  onProposeNewTime(): void {
    if (!this.targetId) {
      return;
    }
    this.router.navigate(['/notifications', this.targetId, 'schedule']);
  }

  onConfirm(): void {
    if (!this.notification || this.confirming || this.isConfirmed) {
      return;
    }

    this.confirming = true;
    this.notificationService.confirmPickup(this.notification.id)
      .pipe(
        finalize(() => {
          this.confirming = false;
          this.router.navigate(['/notifications'], { queryParams: {}, replaceUrl: true });
        })
      )
      .subscribe({
        next: () => {},
        error: () => {}
      });
  }

  get orderId(): string {
    if (!this.notification) {
      return '';
    }
    const metadataOrderId = this.notification.metadata?.['orderId'];
    if (typeof metadataOrderId === 'string' && metadataOrderId.trim().length > 0) {
      return `#${metadataOrderId.trim()}`;
    }

    const message = this.notification.message || '';
    const regex = /([A-Z]{2,}-\d{4}-\d{6}-[A-Z]+)/;
    const match = message.match(regex);
    return match ? `#${match[1]}` : `#${this.notification.id}`;
  }

  get pickupDateLabel(): string | null {
    const raw = this.notification?.metadata?.['pickupDate']
      ?? this.notification?.metadata?.['scheduledDate']
      ?? null;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return null;
    }

    const parsed = this.parseDate(raw);
    if (parsed) {
      return formatDate(parsed, 'fullDate', 'en');
    }

    return raw;
  }

  get pickupTimeLabel(): string | null {
    const raw = this.notification?.metadata?.['pickupTime']
      ?? this.notification?.metadata?.['scheduledTime']
      ?? null;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return null;
    }

    const parsed = this.parseTime(raw);
    if (parsed) {
      return formatDate(parsed, 'hh:mm a', 'en');
    }

    return raw;
  }

  get warehouse(): string | null {
    const value = this.notification?.metadata?.['warehouse'] ?? this.notification?.metadata?.['location'];
    return typeof value === 'string' ? value : null;
  }

  get isConfirmed(): boolean {
    return !!this.notification?.metadata?.['confirmed'];
  }

  private parseDate(value: string): Date | null {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    const match = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]) - 1;
      const year = Number(match[3]);
      if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
        return new Date(year, month, day);
      }
    }

    return null;
  }

  private parseTime(value: string): Date | null {
    const trimmed = value.trim();
    const parsed = Date.parse(`1970-01-01T${trimmed}`);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }

    const match = trimmed.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
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

      if (!Number.isNaN(hours) && !Number.isNaN(Number(minutes))) {
        return new Date(1970, 0, 1, hours, Number(minutes));
      }
    }

    return null;
  }
}


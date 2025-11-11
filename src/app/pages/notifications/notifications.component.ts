import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ChevronLeft, ChevronDown } from 'lucide-angular';
import { takeUntil } from 'rxjs/operators';
import { Subject, combineLatest } from 'rxjs';
import { Notification } from './models/notification.model';
import { NotificationService } from '@services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ChevronLeft;
  readonly ChevronDown = ChevronDown;

  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  pagedNotifications: Notification[] = [];
  selectedNotification: Notification | null = null;

  unreadCount = 0;
  readCount = 0;
  totalCount = 0;
  loading = false;

  activeFilter: 'all' | 'unread' | 'read' = 'all';

  itemsPerPageOptions = [5, 10, 20];
  itemsPerPage = 5;
  currentPage = 1;

  private destroy$ = new Subject<void>();
  private pendingSelectionId: number | null = null;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.notificationService.initialize();

    combineLatest([
      this.notificationService.notifications$,
      this.route.queryParams
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([notifications, params]) => {
        this.notifications = notifications ?? [];
        this.pendingSelectionId = params['notificationId'] ? Number(params['notificationId']) : null;
        this.applyFilter(true);
      });

    this.notificationService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalPages(): number {
    const total = Math.ceil(this.filteredNotifications.length / this.itemsPerPage);
    return total > 0 ? total : 1;
  }

  get pages(): number[] {
    const total = this.totalPages;
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  setFilter(filter: 'all' | 'unread' | 'read'): void {
    if (this.activeFilter === filter) {
      return;
    }

    this.activeFilter = filter;
    this.applyFilter(true);
  }

  onNotificationSelect(notification: Notification): void {
    const wasRead = notification.isRead;
    this.markNotificationAsReadOptimistic(notification);
    const updated = this.notifications.find(n => n.id === notification.id) ?? notification;
    this.selectNotification(updated);
    if (!wasRead) {
      this.notificationService.markAsRead(notification.id).subscribe({
        error: () => this.notificationService.refresh()
      });
    }
    this.updateRoute(notification.id);
  }

  onMarkAsRead(notification: Notification, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    if (notification.isRead) {
      return;
    }

    this.markNotificationAsReadOptimistic(notification);
    this.notificationService.markAsRead(notification.id).subscribe({
      error: () => this.notificationService.refresh()
    });
  }

  markAllAsRead(): void {
    if (this.unreadCount === 0) {
      return;
    }

    this.markAllAsReadOptimistic();
    this.notificationService.markAllAsRead().subscribe({
      error: () => this.notificationService.refresh()
    });
  }

  onItemsPerPageChange(value: number): void {
    const numericValue = Number(value);
    if (!isNaN(numericValue) && numericValue > 0) {
      this.itemsPerPage = numericValue;
      this.currentPage = 1;
      this.updatePagination();
    }
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.updatePagination();
  }

  openDetail(notification: Notification, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/notifications', notification.id]);
  }

  isSelected(notification: Notification): boolean {
    return this.selectedNotification?.id === notification.id;
  }

  isUnread(notification: Notification): boolean {
    return !notification.isRead;
  }

  extractOrderId(notification: Notification): string {
    const metadataOrderIdValue = notification.metadata?.['orderId'];
    const metadataOrderId = typeof metadataOrderIdValue === 'string'
      ? metadataOrderIdValue
      : null;

    if (metadataOrderId && metadataOrderId.trim().length > 0) {
      return `#${metadataOrderId.trim()}`;
    }

    const message = notification.message || '';
    const regex = /([A-Z]{2,}-\d{4}-\d{6}-[A-Z]+)/;
    const match = message.match(regex);
    if (match) {
      return `#${match[1]}`;
    }

    return '#—';
  }

  getStatusLabel(notification: Notification): string {
    const title = notification.title?.trim();
    if (title) {
      return title;
    }

    const type = notification.type?.trim();
    if (type) {
      return type;
    }

    const message = (notification.message || '').trim();
    if (!message) {
      return '—';
    }

    const firstSentence = message.split('.').map(part => part.trim()).find(Boolean);
    return firstSentence || message;
  }

  getFormattedDate(notification: Notification): string {
    const date = new Date(notification.createdAt);
    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  getRelativeTime(notification: Notification): string {
    const created = new Date(notification.createdAt).getTime();
    const now = Date.now();
    const diffMs = now - created;
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes <= 1) {
      return 'Just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    return new Date(notification.createdAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  trackByNotification(_: number, notification: Notification): number {
    return notification.id;
  }

  private applyFilter(resetPage: boolean = false): void {
    this.totalCount = this.notifications.length;
    const read = this.notifications.filter(notification => notification.isRead).length;
    this.readCount = read;
    this.unreadCount = this.totalCount - read;

    switch (this.activeFilter) {
      case 'unread':
        this.filteredNotifications = this.notifications.filter(notification => !notification.isRead);
        break;
      case 'read':
        this.filteredNotifications = this.notifications.filter(notification => notification.isRead);
        break;
      default:
        this.filteredNotifications = [...this.notifications];
    }

    if (resetPage) {
      this.currentPage = 1;
    }

    if (this.filteredNotifications.length === 0) {
      this.selectNotification(null);
      this.updatePagination();
      return;
    }

    if (this.pendingSelectionId) {
      const matching = this.filteredNotifications.find(notification => notification.id === this.pendingSelectionId);
      if (matching) {
        this.selectNotification(matching);
        this.pendingSelectionId = null;
      }
    }

    if (!this.selectedNotification || !this.filteredNotifications.some(notification => notification.id === this.selectedNotification?.id)) {
      this.selectNotification(this.filteredNotifications[0]);
    }

    this.updatePagination();
  }

  private updatePagination(): void {
    const totalPages = this.totalPages;
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.pagedNotifications = this.filteredNotifications.slice(start, start + this.itemsPerPage);
  }

  private selectNotification(notification: Notification | null): void {
    this.selectedNotification = notification;

    if (!notification) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { notificationId: null },
        queryParamsHandling: 'merge'
      });
    }
  }

  private updateRoute(notificationId: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { notificationId },
      queryParamsHandling: 'merge'
    });
  }

  private markNotificationAsReadOptimistic(notification: Notification): void {
    if (!notification || notification.isRead) {
      return;
    }

    const id = notification.id;

    this.notifications = this.notifications.map(item => {
      if (item.id === id && !item.isRead) {
        return { ...item, isRead: true };
      }
      return item;
    });

    this.filteredNotifications = this.filteredNotifications.map(item => {
      if (item.id === id && !item.isRead) {
        return { ...item, isRead: true };
      }
      return item;
    });

    if (this.selectedNotification?.id === id && !this.selectedNotification.isRead) {
      this.selectedNotification = { ...this.selectedNotification, isRead: true };
    }

    this.pendingSelectionId = id;
    this.applyFilter();
  }

  private markAllAsReadOptimistic(): void {
    if (this.unreadCount === 0) {
      return;
    }

    this.notifications = this.notifications.map(item => ({ ...item, isRead: true }));
    this.filteredNotifications = this.filteredNotifications.map(item => ({ ...item, isRead: true }));
    if (this.selectedNotification && !this.selectedNotification.isRead) {
      this.selectedNotification = { ...this.selectedNotification, isRead: true };
    }

    this.pendingSelectionId = this.selectedNotification?.id ?? null;
    this.applyFilter();
  }
}

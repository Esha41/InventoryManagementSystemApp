import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Check, CircleDot } from 'lucide-angular';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './notification-list.component.html',
  styleUrls: ['./notification-list.component.css']
})
export class NotificationListComponent {
  @Input() notifications: Notification[] = [];
  @Input() selectedNotificationId: number | null = null;
  @Input() loading = false;
  @Input() totalCount = 0;

  @Output() notificationSelect = new EventEmitter<Notification>();
  @Output() markAsRead = new EventEmitter<Notification>();

  readonly Check = Check;
  readonly CircleDot = CircleDot;

  trackById(_: number, notification: Notification): number {
    return notification.id;
  }

  onNotificationClick(notification: Notification): void {
    this.notificationSelect.emit(notification);
  }

  onMarkAsRead(notification: Notification, event: MouseEvent): void {
    event.stopPropagation();
    this.markAsRead.emit(notification);
  }
}

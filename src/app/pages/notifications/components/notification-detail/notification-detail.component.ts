import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-notification-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './notification-detail.component.html',
  styleUrls: ['./notification-detail.component.css']
})
export class NotificationDetailComponent {
  @Input() notification: Notification | null = null;
  @Output() close = new EventEmitter<void>();

  readonly CloseIcon = X;

  onClose(): void {
    this.close.emit();
  }

  get metadataEntries(): Array<{ key: string; value: any }> {
    if (!this.notification?.metadata || typeof this.notification.metadata !== 'object') {
      return [];
    }

    return Object.entries(this.notification.metadata)
      .map(([key, value]) => ({ key, value }));
  }
}

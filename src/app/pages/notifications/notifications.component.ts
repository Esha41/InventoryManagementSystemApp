import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LucideAngularModule,
  Bell,
  CheckCircle2,
  Mail,
  MailOpen,
  Clock,
  Calendar,
  Search,
  Info,
  ArrowRight
} from 'lucide-angular';
import { combineLatest, Observable, Subject } from 'rxjs';
import { debounceTime, finalize, map, shareReplay, startWith, takeUntil, tap } from 'rxjs/operators';
import { Notification } from '@models/notification.model';
import { NotificationService } from '@services/notification.service';
import { ButtonComponent } from '@components/button/button.component';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderDto } from '@services/order.service';
import { ReturnDto } from '@services/return.service';
import { DiscardDto } from '@services/discard.service';
import { 
  NotificationFilter, 
  NotificationDetailType, 
  MetadataDisplayItem 
} from '@models/notification.model';
import { NOTIFICATION_ACTION_KEYS } from '@constants/notification.constants';
import {
  formatMetadataKey,
  getDisplayMetadata,
  canConfirmPickup,
  canProposeNewTime,
  getPriorityLabelTranslation,
  getStatusLabelTranslation
} from '@utils/notification.utils';
import { NotificationDetailService } from '@services/notification-detail.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    ModalComponent
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  readonly Bell = Bell;
  readonly CheckCircle2 = CheckCircle2;
  readonly Mail = Mail;
  readonly MailOpen = MailOpen;
  readonly Clock = Clock;
  readonly Calendar = Calendar;
  readonly Search = Search;
  readonly Info = Info;
  readonly ArrowRight = ArrowRight;

  readonly notifications$: Observable<Notification[]> = this.notificationService.notifications$;
  readonly unreadCount$ = this.notificationService.unreadCount$;
  readonly loading$ = this.notificationService.loading$;

  searchControl = new FormControl<string>('', { nonNullable: true });
  filterControl = new FormControl<NotificationFilter>('all', { nonNullable: true });

  proposeForm: FormGroup;
  isProposeModalOpen = false;
  isSubmittingProposal = false;
  markingAll = false;

  filteredNotifications$!: Observable<Notification[]>;
  selectedNotification: Notification | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly pendingActionIds = new Set<number>();

  detailLoading = false;
  detailError: string | null = null;
  detailType: NotificationDetailType = null;
  orderDetail: OrderDto | null = null;
  returnDetail: ReturnDto | null = null;
  discardDetail: DiscardDto | null = null;

  // Constants from separate file
  private readonly confirmActionKeys = NOTIFICATION_ACTION_KEYS.confirm;
  private readonly rescheduleActionKeys = NOTIFICATION_ACTION_KEYS.reschedule;
  private readonly hiddenMetadataKeys = NOTIFICATION_ACTION_KEYS.hidden;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly detailService: NotificationDetailService
  ) {
    this.proposeForm = this.fb.group({
      pickupDate: ['', Validators.required],
      pickupTime: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.notificationService.initialize();

    this.filteredNotifications$ = combineLatest([
      this.notifications$,
      this.searchControl.valueChanges.pipe(
        startWith(this.searchControl.value),
        debounceTime(200),
        map(term => term.trim().toLowerCase())
      ),
      this.filterControl.valueChanges.pipe(startWith(this.filterControl.value))
    ]).pipe(
      map(([notifications, searchTerm, filter]) => {
        let items = [...notifications];

        if (filter === 'unread') {
          items = items.filter(notification => !notification.isRead);
        }

        if (searchTerm) {
          items = items.filter(notification => {
            const haystack = [
              notification.title,
              notification.message,
              notification.type,
              notification.entityType,
              notification.metadata ? JSON.stringify(notification.metadata) : ''
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return haystack.includes(searchTerm);
          });
        }

        return items;
      }),
      tap(notifications => this.syncSelectionWith(notifications)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.notificationService.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setFilter(filter: NotificationFilter): void {
    this.filterControl.setValue(filter);
  }

  isFilterActive(filter: NotificationFilter): boolean {
    return this.filterControl.value === filter;
  }

  selectNotification(notification: Notification): void {
    this.selectedNotification = notification;
    this.loadNotificationDetail(notification);
  }

  trackByNotification(_: number, notification: Notification): number {
    return notification.id;
  }

  trackMetadata(_: number, item: { key: string }): string {
    return item.key;
  }

  markAsRead(notification: Notification): void {
    if (notification.isRead || this.pendingActionIds.has(notification.id)) {
      return;
    }

    this.togglePending(notification.id, true);
    this.notificationService.markAsRead(notification.id)
      .pipe(
        finalize(() => this.togglePending(notification.id, false)),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  markAllAsRead(): void {
    if (this.markingAll) {
      return;
    }

    this.markingAll = true;
    this.notificationService.markAllAsRead()
      .pipe(
        finalize(() => this.markingAll = false),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  confirmPickup(notification: Notification): void {
    if (!this.canConfirmPickup(notification) || this.pendingActionIds.has(notification.id)) {
      return;
    }

    this.togglePending(notification.id, true);
    this.notificationService.confirmPickup(notification.id)
      .pipe(
        finalize(() => this.togglePending(notification.id, false)),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (!notification.isRead) {
          this.markAsRead(notification);
        }
      });
  }

  openProposeModal(notification: Notification): void {
    if (!this.canProposeNewTime(notification)) {
      return;
    }

    this.selectedNotification = notification;
    const metadata = notification.metadata as Record<string, any> | null;

    this.proposeForm.patchValue({
      pickupDate: metadata?.['pickupDate'] ?? '',
      pickupTime: metadata?.['pickupTime'] ?? ''
    });

    this.isProposeModalOpen = true;
  }

  closeProposeModal(): void {
    this.isProposeModalOpen = false;
    this.proposeForm.reset({
      pickupDate: '',
      pickupTime: ''
    });
    this.isSubmittingProposal = false;
  }

  submitProposedTime(): void {
    const notification = this.selectedNotification;
    if (!notification || !this.canProposeNewTime(notification)) {
      return;
    }

    if (this.proposeForm.invalid || this.isSubmittingProposal) {
      this.proposeForm.markAllAsTouched();
      return;
    }

    this.isSubmittingProposal = true;
    const payload = {
      pickupDate: this.proposeForm.value.pickupDate,
      pickupTime: this.proposeForm.value.pickupTime
    };

    this.notificationService.proposeNewTime(notification.id, payload as { pickupDate: string; pickupTime: string })
      .pipe(
        finalize(() => this.isSubmittingProposal = false),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.closeProposeModal();
      });
  }

  canConfirmPickup(notification: Notification | null): boolean {
    return canConfirmPickup(notification, this.confirmActionKeys, this.hiddenMetadataKeys);
  }

  canProposeNewTime(notification: Notification | null): boolean {
    return canProposeNewTime(notification, this.rescheduleActionKeys, this.hiddenMetadataKeys);
  }

  isPending(notification: Notification | null): boolean {
    return !!notification && this.pendingActionIds.has(notification.id);
  }

  getDisplayMetadata(notification: Notification | null): MetadataDisplayItem[] {
    return getDisplayMetadata(notification, this.hiddenMetadataKeys, this.translateService);
  }

  formatMetadataKey(key: string): string {
    return formatMetadataKey(key, this.translateService);
  }

  getStatusLabel(notification: Notification | null): string {
    if (!notification) {
      return '';
    }

    if (notification.isRead) {
      return this.translateService.instant('notifications.filters.read');
    }

    return this.translateService.instant('notifications.unread');
  }

  private syncSelectionWith(notifications: Notification[]): void {
    if (!notifications.length) {
      this.selectedNotification = null;
      this.resetDetailState();
      return;
    }

    if (this.selectedNotification) {
      const existing = notifications.find(notification => notification.id === this.selectedNotification?.id);
      if (existing) {
        this.selectedNotification = existing;
        this.loadNotificationDetail(existing);
        return;
      }
    }

    this.selectedNotification = notifications[0];
    this.loadNotificationDetail(this.selectedNotification);
  }

  private loadNotificationDetail(notification: Notification | null): void {
    this.resetDetailState();

    if (!notification) {
      return;
    }

    this.detailLoading = true;
    this.detailService.loadDetail(notification)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.detailLoading = false;
          this.detailError = result.error;
          this.detailType = result.type;

          if (result.detail) {
            if (result.type === 'order') {
              this.orderDetail = result.detail as OrderDto;
            } else if (result.type === 'return') {
              this.returnDetail = result.detail as ReturnDto;
            } else if (result.type === 'discard') {
              this.discardDetail = result.detail as DiscardDto;
            }
          }
        },
        error: () => {
          this.detailLoading = false;
          this.detailError = this.translateService.instant('notifications.details.unknown');
        }
      });
  }

  private resetDetailState(): void {
    this.detailError = null;
    this.detailLoading = false;
    this.detailType = null;
    this.orderDetail = null;
    this.returnDetail = null;
    this.discardDetail = null;
  }

  getPriorityLabelTranslation(priority?: number | null): string {
    return getPriorityLabelTranslation(priority);
  }

  getStatusLabelTranslation(status?: number | null): string {
    return getStatusLabelTranslation(status);
  }

  hasNotificationActions(notification: Notification | null): boolean {
    if (!notification) {
      return false;
    }

    return !notification.isRead ||
      this.canConfirmPickup(notification) ||
      this.canProposeNewTime(notification);
  }

  private togglePending(id: number, isPending: boolean): void {
    if (isPending) {
      this.pendingActionIds.add(id);
    } else {
      this.pendingActionIds.delete(id);
    }
  }
}

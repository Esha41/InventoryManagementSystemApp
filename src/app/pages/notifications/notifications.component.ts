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
import { combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, finalize, map, shareReplay, startWith, takeUntil, tap } from 'rxjs/operators';
import { Notification } from '@models/notification.model';
import { NotificationService } from '@services/notification.service';
import { ButtonComponent } from '@components/button/button.component';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderService, OrderDto } from '@services/order.service';
import { ReturnService, ReturnDto } from '@services/return.service';
import { DiscardService, DiscardDto } from '@services/discard.service';

type NotificationFilter = 'all' | 'unread';

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
  private pendingActionIds = new Set<number>();
  private detailSubscription: Subscription | null = null;

  detailLoading = false;
  detailError: string | null = null;
  detailType: 'order' | 'return' | 'discard' | null = null;
  orderDetail: OrderDto | null = null;
  returnDetail: ReturnDto | null = null;
  discardDetail: DiscardDto | null = null;

  private readonly confirmActionKeys = ['confirmPickupUrl', 'confirmUrl', 'confirmEndpoint', 'confirm'];
  private readonly rescheduleActionKeys = ['proposeNewTimeUrl', 'rescheduleUrl', 'scheduleUrl', 'proposeUrl', 'updateScheduleUrl'];
  private readonly hiddenMetadataKeys = new Set([
    'actions',
    'actionUrls',
    'confirm',
    'confirmUrl',
    'confirmEndpoint',
    'confirmPickupUrl',
    'confirmPickupEndpoint',
    'confirmPickup',
    'proposeNewTimeUrl',
    'proposeUrl',
    'rescheduleUrl',
    'scheduleUrl',
    'updateScheduleUrl'
  ]);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly orderService: OrderService,
    private readonly returnService: ReturnService,
    private readonly discardService: DiscardService
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
    this.detailSubscription?.unsubscribe();
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
    if (!notification || !notification.metadata) {
      return false;
    }

    const metadata = notification.metadata as Record<string, any>;

    if (metadata['confirmed'] === true) {
      return false;
    }

    return this.hasMetadataAction(notification, this.confirmActionKeys);
  }

  canProposeNewTime(notification: Notification | null): boolean {
    if (!notification || !notification.metadata) {
      return false;
    }

    const metadata = notification.metadata as Record<string, any>;

    if (metadata['allowReschedule'] === false) {
      return false;
    }

    return this.hasMetadataAction(notification, this.rescheduleActionKeys);
  }

  isPending(notification: Notification | null): boolean {
    return !!notification && this.pendingActionIds.has(notification.id);
  }

  getDisplayMetadata(notification: Notification | null): Array<{ key: string; value: string }> {
    if (!notification?.metadata) {
      return [];
    }

    const iterable = Object.entries(notification.metadata)
      .filter(([key]) => !this.hiddenMetadataKeys.has(key));

    return iterable
      .map(([key, value]) => ({
        key,
        value: this.formatMetadataValue(value)
      }))
      .filter(item => item.value.length > 0);
  }

  formatMetadataKey(key: string): string {
    const translationKey = `notifications.${key}`;
    const translated = this.translateService.instant(translationKey);
    if (translated && translated !== translationKey) {
      return translated;
    }

    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
      .trim();
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

  private hasMetadataAction(notification: Notification, keys: string[]): boolean {
    if (!notification.metadata) {
      return false;
    }

    const metadata = notification.metadata as Record<string, any>;
    const actions = this.extractRecord(metadata['actions']) ?? this.extractRecord(metadata['actionUrls']);

    for (const key of keys) {
      const normalizedKey = key.replace(/Url$/i, '');
      const candidates = [
        metadata[key],
        metadata[`${key}Endpoint`],
        metadata[`${key}Url`],
        metadata[normalizedKey]
      ];

      if (actions) {
        candidates.push(
          actions[key],
          actions[`${key}Url`],
          actions[`${key}Endpoint`],
          actions[normalizedKey]
        );
      }

      if (candidates.some(value => typeof value === 'string' && value.trim().length > 0)) {
        return true;
      }
    }

    return false;
  }

  private extractRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, any>;
  }

  private formatMetadataValue(value: unknown): string {
    if (value == null) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  private loadNotificationDetail(notification: Notification | null): void {
    this.detailSubscription?.unsubscribe();
    this.resetDetailState();

    if (!notification) {
      return;
    }

    const entityId = notification.entityId ?? this.extractEntityIdFromMetadata(notification);
    const entityType = (notification.entityType ?? notification.type ?? '').toLowerCase();

    if (!entityType || entityId == null) {
      this.detailError = this.translateService.instant('notifications.details.unknown');
      return;
    }

    const numericId = Number(entityId);
    if (Number.isNaN(numericId)) {
      this.detailError = this.translateService.instant('notifications.details.unknown');
      return;
    }

    this.detailLoading = true;
    this.detailSubscription?.unsubscribe();

    switch (entityType) {
      case 'order':
        this.detailType = 'order';
        this.detailSubscription = this.orderService.getOrderById(numericId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: detail => {
              this.orderDetail = detail;
              this.detailLoading = false;
            },
            error: error => this.handleDetailError(error)
          });
        break;
      case 'return':
        this.detailType = 'return';
        this.detailSubscription = this.returnService.getReturnById(numericId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: detail => {
              this.returnDetail = detail;
              this.detailLoading = false;
            },
            error: error => this.handleDetailError(error)
          });
        break;
      case 'discard':
        this.detailType = 'discard';
        this.detailSubscription = this.discardService.getDiscardById(numericId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: detail => {
              this.discardDetail = detail;
              this.detailLoading = false;
            },
            error: error => this.handleDetailError(error)
          });
        break;
      default:
        this.detailLoading = false;
        this.detailError = this.translateService.instant('notifications.details.unknown');
    }
  }

  private extractEntityIdFromMetadata(notification: Notification): number | null {
    const metadata = notification.metadata as Record<string, unknown> | null;
    if (!metadata) {
      return null;
    }

    const possibleKeys = ['entityId', 'orderId', 'returnId', 'discardId', 'requestId', 'id'];
    for (const key of possibleKeys) {
      const value = metadata[key];
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string' && !Number.isNaN(Number(value))) {
        return Number(value);
      }
    }

    return null;
  }

  private handleDetailError(error: unknown): void {
    this.detailLoading = false;
    const message = (error as any)?.message ?? this.translateService.instant('notifications.details.unknown');
    this.detailError = message;
  }

  private resetDetailState(): void {
    this.detailError = null;
    this.detailLoading = false;
    this.detailType = null;
    this.orderDetail = null;
    this.returnDetail = null;
    this.discardDetail = null;
    this.detailSubscription = null;
  }

  getPriorityLabelTranslation(priority?: number | null): string {
    switch (priority) {
      case 2:
        return 'dashboard.priorityLabels.medium';
      case 3:
        return 'dashboard.priorityLabels.low';
      default:
        return 'dashboard.priorityLabels.high';
    }
  }

  getStatusLabelTranslation(status?: number | null): string {
    switch (status) {
      case 2:
        return 'dashboard.statusLabels.underProcess';
      case 3:
        return 'dashboard.statusLabels.approved';
      case 4:
        return 'dashboard.statusLabels.rejected';
      case 5:
        return 'dashboard.statusLabels.cancelled';
      default:
        return 'dashboard.statusLabels.new';
    }
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
      const next = new Set(this.pendingActionIds);
      next.add(id);
      this.pendingActionIds = next;
    } else if (this.pendingActionIds.has(id)) {
      const next = new Set(this.pendingActionIds);
      next.delete(id);
      this.pendingActionIds = next;
    }
  }
}

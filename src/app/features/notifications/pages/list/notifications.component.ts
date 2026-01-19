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
  ArrowRight,
  ArrowLeft
} from 'lucide-angular';
import { combineLatest, Observable, Subject } from 'rxjs';
import { debounceTime, finalize, map, shareReplay, startWith, takeUntil, tap } from 'rxjs/operators';
import { Notification } from '@notifications/models/notification.model';
import { NotificationService } from '@notifications/services/notification.service';
import { ButtonComponent } from '@components/button/button.component';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderDto } from '@services/order.service';
import { ReturnDto } from '@services/return.service';
import { DiscardDto } from '@services/discard.service';
import {
  NotificationFilter,
  NotificationDetailType,
  MetadataDisplayItem
} from '@notifications/models/notification.model';
import { NOTIFICATION_ACTION_KEYS } from '@constants/notification.constants';
import {
  formatMetadataKey,
  getDisplayMetadata,
  canConfirmPickup,
  canProposeNewTime,
  getPriorityLabelTranslation,
  getStatusLabelTranslation
} from '@utils/notification.utils';
import { formatTimeToMilitary } from '@utils/format.utils';
import { NotificationDetailService } from '@notifications/services/notification-detail.service';
import { TranslationService } from '@services/translation.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

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
  readonly ArrowLeft = ArrowLeft;

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

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get arrowIcon() {
    return this.isRTL ? ArrowLeft : ArrowRight;
  }

  constructor(
    private readonly notificationService: NotificationService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly detailService: NotificationDetailService,
    private readonly translationService: TranslationService
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

    // Automatically mark as read when opening/selecting a notification
    if (!notification.isRead) {
      this.markAsRead(notification);
    }
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

  /**
   * Formats time for display - converts to military format (HHMM)
   * Uses centralized formatTimeToMilitary function for consistency
   * Handles both string time values and Date objects
   */
  formatTimeForDisplay(timeStr: string | Date | null | undefined): string {
    return formatTimeToMilitary(timeStr);
  }

  formatMilitaryTime(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove non-digits

    // Limit to 4 digits
    if (value.length > 4) {
      value = value.substring(0, 4);
    }

    // Validate hours (00-23) and minutes (00-59)
    if (value.length >= 2) {
      const hours = parseInt(value.substring(0, 2), 10);
      if (hours > 23) {
        value = '23' + value.substring(2);
      }
    }

    if (value.length >= 4) {
      const minutes = parseInt(value.substring(2, 4), 10);
      if (minutes > 59) {
        value = value.substring(0, 2) + '59';
      }
    }

    input.value = value;
    this.proposeForm.patchValue({ pickupTime: value }, { emitEvent: false });
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
    // Convert military time format (HHMM) if needed
    let pickupTime = this.proposeForm.value.pickupTime || '';
    if (pickupTime && pickupTime.includes(':')) {
      pickupTime = pickupTime.replace(':', '');
    }

    const payload = {
      pickupDate: this.proposeForm.value.pickupDate,
      pickupTime: pickupTime
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
        // Mark as read if it's unread
        if (!existing.isRead) {
          this.markAsRead(existing);
        }
        return;
      }
    }

    this.selectedNotification = notifications[0];
    this.loadNotificationDetail(this.selectedNotification);
    // Mark as read if it's unread
    if (!this.selectedNotification.isRead) {
      this.markAsRead(this.selectedNotification);
    }
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
          this.detailError = 'notifications.details.unknown';
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

  /**
   * Get priority label translation key
   * Wrapper method for template type safety
   */
  getPriorityLabelTranslation(priority: number | string | null | undefined): string {
    return getPriorityLabelTranslation(priority);
  }

  /**
   * Get status label translation key
   * Wrapper method for template type safety
   */
  getStatusLabelTranslation(status: number | string | null | undefined): string {
    return getStatusLabelTranslation(status);
  }

  /**
   * Get localized department name with proper nested object support
   * Handles both flattened properties and nested department objects
   */
  getLocalizedDepartmentName(departmentNameEn?: string | null, departmentNameAr?: string | null): string {
    const lang = getCurrentLang(this.translateService);

    // Check if we have the values
    if (departmentNameEn || departmentNameAr) {
      return getLocalizedName(
        {
          nameEn: departmentNameEn,
          nameAr: departmentNameAr
        },
        lang
      ) || this.translateService.instant('common.notAvailable');
    }

    return this.translateService.instant('common.notAvailable');
  }

  /**
   * Get localized requester name with proper nested object support
   * Handles both simple string and nested requester objects
   */
  getLocalizedRequesterName(requesterName?: string | null): string {
    if (!requesterName) {
      return this.translateService.instant('common.notAvailable');
    }
    return requesterName;
  }

  /**
   * Get localized request purpose name (prefers Arabic when language is Arabic)
   */
  getLocalizedPurposeName(purposeNameEn?: string | null, purposeNameAr?: string | null, purposeName?: string | null): string {
    const lang = getCurrentLang(this.translateService);
    if (lang === 'ar') {
      return purposeNameAr || purposeNameEn || purposeName || this.translateService.instant('common.notAvailable');
    }
    return purposeNameEn || purposeNameAr || purposeName || this.translateService.instant('common.notAvailable');
  }

  /**
   * Get localized value helper (for ReturnDto and DiscardDto which may have single name field)
   */
  getLocalizedValue(en: string | undefined | null, ar: string | undefined | null): string {
    const lang = getCurrentLang(this.translateService);
    if (lang === 'ar') {
      return ar || en || this.translateService.instant('common.notAvailable');
    }
    return en || ar || this.translateService.instant('common.notAvailable');
  }

  /**
   * Translate notification title from backend English to current language
   */
  translateNotificationTitle(title: string | null | undefined): string {
    if (!title) {
      return this.translateService.instant('notifications.genericType');
    }

    const titleLower = title.trim();

    // Map common title patterns to translation keys
    const titleMap: Record<string, string> = {
      'order created': 'notifications.titles.orderCreated',
      'return created': 'notifications.titles.returnCreated',
      'discard created': 'notifications.titles.discardCreated',
      'order approved': 'notifications.titles.orderApproved',
      'order rejected': 'notifications.titles.orderRejected',
      'return approved': 'notifications.titles.returnApproved',
      'return rejected': 'notifications.titles.returnRejected',
      'discard approved': 'notifications.titles.discardApproved',
      'discard rejected': 'notifications.titles.discardRejected'
    };

    const translationKey = titleMap[titleLower.toLowerCase()];
    if (translationKey) {
      return this.translateService.instant(translationKey);
    }

    // If no match, return original (might be already translated or custom)
    return title;
  }

  /**
   * Translate notification message from backend English to current language
   */
  translateNotificationMessage(message: string | null | undefined): string {
    if (!message) {
      return '';
    }

    const messageTrimmed = message.trim();
    const messageLower = messageTrimmed.toLowerCase();

    // Extract request number (handles patterns like ORD-2025-000003-MP, RET-2025-000001, etc.)
    const requestNoMatch = messageTrimmed.match(/(ORD|RET|DIS)-[\d\-A-Z]+/i);
    const requestNo = requestNoMatch ? requestNoMatch[0] : '';

    // Check for "from allowance" pattern
    const fromAllowance = messageLower.includes('from allowance')
      ? this.translateService.instant('notifications.messages.orderCreatedFromAllowance')
      : '';

    // Map common message patterns to translation keys
    // Handle "Order request {RequestNo} has been created" pattern
    if (messageLower.includes('order request') && messageLower.includes('has been created')) {
      return this.translateService.instant('notifications.messages.orderCreated', {
        requestNo: requestNo,
        fromAllowance: fromAllowance
      });
    }
    // Handle "Return request {RequestNo} has been created" pattern
    if (messageLower.includes('return request') && messageLower.includes('has been created')) {
      return this.translateService.instant('notifications.messages.returnCreated', {
        requestNo: requestNo
      });
    }
    // Handle "Discard request {RequestNo} has been created" pattern
    if (messageLower.includes('discard request') && messageLower.includes('has been created')) {
      return this.translateService.instant('notifications.messages.discardCreated', {
        requestNo: requestNo
      });
    }
    // Handle approval patterns
    if (messageLower.includes('order request') && messageLower.includes('has been approved')) {
      return this.translateService.instant('notifications.messages.orderApproved', {
        requestNo: requestNo
      });
    }
    if (messageLower.includes('order request') && messageLower.includes('has been rejected')) {
      return this.translateService.instant('notifications.messages.orderRejected', {
        requestNo: requestNo
      });
    }
    if (messageLower.includes('return request') && messageLower.includes('has been approved')) {
      return this.translateService.instant('notifications.messages.returnApproved', {
        requestNo: requestNo
      });
    }
    if (messageLower.includes('return request') && messageLower.includes('has been rejected')) {
      return this.translateService.instant('notifications.messages.returnRejected', {
        requestNo: requestNo
      });
    }
    if (messageLower.includes('discard request') && messageLower.includes('has been approved')) {
      return this.translateService.instant('notifications.messages.discardApproved', {
        requestNo: requestNo
      });
    }
    if (messageLower.includes('discard request') && messageLower.includes('has been rejected')) {
      return this.translateService.instant('notifications.messages.discardRejected', {
        requestNo: requestNo
      });
    }

    // If no match, return original (might be already translated or custom)
    return messageTrimmed;
  }

  /**
   * Translate notification entity type
   */
  translateEntityType(type: string | null | undefined): string {
    if (!type) {
      return '';
    }

    const typeKey = `notifications.entityTypes.${type}`;
    const translated = this.translateService.instant(typeKey);

    // If translation key doesn't exist, it returns the key itself, so check if it's different
    if (translated !== typeKey) {
      return translated;
    }

    // Fallback: try with lowercase
    const typeKeyLower = `notifications.entityTypes.${type.toLowerCase()}`;
    const translatedLower = this.translateService.instant(typeKeyLower);
    if (translatedLower !== typeKeyLower) {
      return translatedLower;
    }

    // If still no match, return original
    return type;
  }

  hasNotificationActions(notification: Notification | null): boolean {
    if (!notification) {
      return false;
    }

    return this.canConfirmPickup(notification) ||
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

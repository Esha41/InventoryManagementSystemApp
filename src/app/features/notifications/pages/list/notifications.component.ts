import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
  Info
} from 'lucide-angular';
import { Router } from '@angular/router';
import { combineLatest, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, finalize, map, shareReplay, startWith, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { Notification } from '@notifications/models/notification.model';
import { NotificationService } from '@notifications/services/notification.service';
import { ButtonComponent } from '@components/button/button.component';
import { ModalComponent } from '@components/modal/modal.component';
import { DiscardDto } from '@models/discard.model';
import {
  NotificationFilter,
  NotificationDetailType,
  MetadataDisplayItem
} from '@notifications/models/notification.model';
import { NOTIFICATION_ACTION_KEYS } from '@notifications/constants/notification.constants';
import {
  formatMetadataKey,
  getDisplayMetadata,
  canConfirmPickup,
  canProposeNewTime,
  getPriorityLabelTranslation,
  getStatusLabelTranslation,
  asNotificationMetadata
} from '@notifications/utils/notification.utils';
import {
  splitTranslatedNotificationMessage,
  hasWorkflowApprovalNavigation,
  NotificationMessagePart
} from '@notifications/utils/notification-workflow-navigation.utils';
import { formatTimeToMilitary } from '@utils/format.utils';
import { NotificationDetailService } from '@notifications/services/notification-detail.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { NotificationRichMessageComponent } from '@notifications/components/notification-rich-message/notification-rich-message.component';
import { NotificationRequestNoResolverService } from '@notifications/services/notification-request-no.resolver.service';
import {
  extractRequestNoFromMessage,
  getNotificationEntityId,
  isSupplyPickupNotification,
  translateNotificationMessageText
} from '@notifications/utils/notification-message.utils';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    ModalComponent,
    AppDatePipe,
    AppDateTimePipe,
    NotificationRichMessageComponent
  ],
  templateUrl: './notifications.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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

  /** Shared layout tokens — keeps template readable */
  readonly shell =
    'overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm';
  readonly toolbar =
    'border-b border-[var(--color-border)] bg-[var(--color-background-soft)]/40 px-4 py-4 sm:px-5';
  readonly searchField =
    'flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 shadow-sm transition-[box-shadow,border-color] focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[var(--color-brand-soft)]';
  readonly metaTile =
    'flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 shadow-sm';
  readonly detailCard =
    'rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 shadow-sm';
  readonly detailFieldLabel =
    'text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]';
  readonly detailFieldValue = 'break-words text-sm font-medium text-[var(--color-text)]';
  readonly itemCard =
    'rounded-lg border border-[var(--color-border)] bg-[var(--color-background-soft)] px-3 py-2.5';

  readonly skeletonPlaceholders = [0, 1];

  readonly modalInput =
    'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-soft)]';

  readonly spinnerSm =
    'h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-brand)] border-r-[var(--color-brand)]';

  readonly spinnerMd =
    'h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-brand)] border-r-[var(--color-brand)]';

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
  discardDetail: DiscardDto | null = null;

  // Constants from separate file
  private readonly confirmActionKeys = NOTIFICATION_ACTION_KEYS.confirm;
  private readonly rescheduleActionKeys = NOTIFICATION_ACTION_KEYS.reschedule;
  private readonly hiddenMetadataKeys = NOTIFICATION_ACTION_KEYS.hidden;

  filterChipClass(active: boolean): string {
    const base =
      'inline-flex flex-1 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-[color,background-color,border-color] duration-150 sm:flex-initial';
    return active
      ? `${base} border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]`
      : `${base} border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-background-soft)] hover:text-[var(--color-text)]`;
  }

  notificationListItemClass(notification: Notification): string {
    const base =
      'cursor-pointer rounded-xl border px-4 py-3.5 outline-none transition-[border-color,box-shadow,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-brand-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]';
    const selected = this.selectedNotification?.id === notification.id;
    return selected
      ? `${base} border-[var(--color-brand)] bg-[var(--color-brand-soft)] shadow-md`
      : `${base} border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-background-soft)]`;
  }

  statusPillClass(isRead: boolean): string {
    const base =
      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide';
    return isRead
      ? `${base} bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-600/10`
      : `${base} bg-amber-500/10 text-amber-900 ring-1 ring-amber-600/15`;
  }

  constructor(
    private readonly notificationService: NotificationService,
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService,
    private readonly detailService: NotificationDetailService,
    private readonly requestNoResolver: NotificationRequestNoResolverService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.proposeForm = this.fb.group({
      pickupDate: ['', Validators.required],
      pickupTime: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.notificationService.initialize();

    this.notifications$
      .pipe(
        switchMap(notifications => this.requestNoResolver.prefetch(notifications)),
        tap(() => this.cdr.markForCheck()),
        takeUntil(this.destroy$)
      )
      .subscribe();

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
    this.cdr.markForCheck();
    this.notificationService.markAsRead(notification.id)
      .pipe(
        finalize(() => { this.togglePending(notification.id, false); this.cdr.markForCheck(); }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  markAllAsRead(): void {
    if (this.markingAll) {
      return;
    }

    this.markingAll = true;
    this.cdr.markForCheck();
    this.notificationService.markAllAsRead()
      .pipe(
        finalize(() => { this.markingAll = false; this.cdr.markForCheck(); }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  confirmPickup(notification: Notification): void {
    if (!this.canConfirmPickup(notification) || this.pendingActionIds.has(notification.id)) {
      return;
    }

    this.togglePending(notification.id, true);
    this.cdr.markForCheck();
    this.notificationService.confirmPickup(notification.id)
      .pipe(
        finalize(() => { this.togglePending(notification.id, false); this.cdr.markForCheck(); }),
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
    this.cdr.markForCheck();
    const metadata = asNotificationMetadata(notification.metadata ?? null);

    this.proposeForm.patchValue({
      pickupDate: (metadata?.['pickupDate'] as string | number | undefined) ?? '',
      pickupTime: (metadata?.['pickupTime'] as string | number | undefined) ?? ''
    });

    this.isProposeModalOpen = true;
    this.cdr.markForCheck();
  }

  closeProposeModal(): void {
    this.isProposeModalOpen = false;
    this.proposeForm.reset({
      pickupDate: '',
      pickupTime: ''
    });
    this.isSubmittingProposal = false;
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
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
        finalize(() => { this.isSubmittingProposal = false; this.cdr.markForCheck(); }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.closeProposeModal();
        this.cdr.markForCheck();
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

    // Only maintain existing selection if it still exists in the filtered list
    if (this.selectedNotification) {
      const existing = notifications.find(notification => notification.id === this.selectedNotification?.id);
      if (existing) {
        this.selectedNotification = existing;
        this.loadNotificationDetail(existing);
        // Don't auto-mark as read during sync - only when user clicks
        return;
      } else {
        // Selected notification is no longer in the filtered list, clear selection
        this.selectedNotification = null;
        this.resetDetailState();
      }
    }
    // Don't auto-select first notification - wait for user to click
  }

  private loadNotificationDetail(notification: Notification | null): void {
    this.resetDetailState();

    if (!notification) {
      return;
    }

    this.detailLoading = true;
    this.cdr.markForCheck();
    this.detailService.loadDetail(notification)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.detailLoading = false;
          this.detailError = result.error;
          this.detailType = result.type;

          if (result.detail && result.type === 'discard') {
            this.discardDetail = result.detail as DiscardDto;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.detailLoading = false;
          this.detailError = 'notifications.details.unknown';
          this.cdr.markForCheck();
        }
      });
  }

  private resetDetailState(): void {
    this.detailError = null;
    this.detailLoading = false;
    this.detailType = null;
    this.discardDetail = null;
  }

  /**
   * Get priority label translation key
   * Wrapper method for template type safety
   */
  getPriorityLabelTranslation(priority: number | null | undefined): string {
    return getPriorityLabelTranslation(priority);
  }

  /**
   * Get status label translation key
   * Wrapper method for template type safety
   */
  getStatusLabelTranslation(status: number | null | undefined): string {
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
   * Prefers Arabic when current language is Arabic.
   */
  getLocalizedRequesterName(
    requesterNameEn?: string | null,
    requesterNameAr?: string | null,
    userName?: string | null,
    fallback?: string | null
  ): string {
    const lang = getCurrentLang(this.translateService);
    const preferred = lang === 'ar'
      ? (requesterNameAr || requesterNameEn)
      : (requesterNameEn || requesterNameAr);

    return preferred || userName || fallback || this.translateService.instant('common.notAvailable');
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

    const trimmed = title.trim();

    const returned = trimmed.match(/^Request #(.+) Returned for Review$/i);
    if (returned) {
      return this.translateService.instant('notifications.titles.workflowRequestReturnedForReview', {
        requestNo: returned[1].trim()
      });
    }

    const workflowTitle = trimmed.match(/^Request #(.+) (Approved|Rejected|Cancelled)$/i);
    if (workflowTitle) {
      const requestNo = workflowTitle[1].trim();
      const action = workflowTitle[2].toLowerCase();
      const key =
        action === 'approved'
          ? 'notifications.titles.workflowRequestApproved'
          : action === 'rejected'
            ? 'notifications.titles.workflowRequestRejected'
            : 'notifications.titles.workflowRequestCancelled';
      return this.translateService.instant(key, { requestNo });
    }

    const titleLower = trimmed.toLowerCase();

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
      'discard rejected': 'notifications.titles.discardRejected',
      // Approval workflow notifications
      'new approval required': 'notifications.titles.approvalRequired',
      'supply pickup date set': 'notifications.titles.supplyPickupDateSet',
      'supply pickup date confirmed': 'notifications.titles.supplyPickupDateConfirmed'
    };

    const translationKey = titleMap[titleLower.toLowerCase()];
    if (translationKey) {
      return this.translateService.instant(translationKey);
    }

    // If no match, return original (might be already translated or custom)
    return title;
  }

  translateNotificationMessage(
    message: string | null | undefined,
    fallbackRequestNo = ''
  ): string {
    return translateNotificationMessageText(this.translateService, message, fallbackRequestNo);
  }

  getNotificationMessageParts(notification: Notification, enableLinks = true): NotificationMessagePart[] {
    const fallbackRequestNo = this.resolveFallbackRequestNo(notification);
    const text = this.translateNotificationMessage(notification.message, fallbackRequestNo);
    const canLink = enableLinks && hasWorkflowApprovalNavigation(notification);
    return splitTranslatedNotificationMessage(text, canLink);
  }

  private resolveFallbackRequestNo(notification: Notification): string {
    if (isSupplyPickupNotification(notification)) {
      return extractRequestNoFromMessage(notification.message);
    }
    const entityId = getNotificationEntityId(notification);
    if (entityId == null) {
      return '';
    }
    return this.requestNoResolver.getCached(entityId) ?? '';
  }

  openWorkflowFromNotification(notification: Notification, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();

    this.requestNoResolver.resolveWorkflowOrderId(notification).pipe(
      take(1),
      takeUntil(this.destroy$)
    ).subscribe(orderId => {
      if (orderId == null) {
        return;
      }
      void this.router.navigate([
        '/requests/requests-management',
        String(orderId),
        'workflow-approval'
      ]);
    });
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

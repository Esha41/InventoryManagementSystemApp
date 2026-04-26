import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Trash2 } from 'lucide-angular';
import { Subject, merge, takeUntil } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';

import { HelpCenterService } from '@help-center/services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { HelpCenterContactMessageDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { CardComponent } from '@components/card/card.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { APP_CONSTANTS, defaultPageSize } from '@constants/app.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { adminBadgePositive, adminTotalPages } from '../../help-center-admin.utils';

@Component({
  selector: 'app-help-center-messages-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    ConfirmDialogComponent,
    ModalComponent,
    ButtonComponent,
    PaginationComponent,
    CardComponent,
    RowsPerPageComponent,
    AppDateTimePipe
  ],
  templateUrl: './help-center-messages-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterMessagesTabComponent implements OnInit, OnDestroy {
  /** Emits current unread count whenever the message list changes (for tab badge in parent). */
  @Output() unreadCountChange = new EventEmitter<number>();

  private readonly helpCenter = inject(HelpCenterService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(BackendAuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly Trash2 = Trash2;

  readonly pageSizeOptions = [...APP_CONSTANTS.PAGE_SIZE_OPTIONS];
  rowsPerPage = defaultPageSize;
  messages: HelpCenterContactMessageDto[] = [];
  loadingMessages = false;
  messagesListPage = 1;

  messageModalOpen = false;
  selectedMessage: HelpCenterContactMessageDto | null = null;
  loadingMessageDetail = false;

  showDeleteMessageDialog = false;
  messageToDelete: HelpCenterContactMessageDto | null = null;

  /** Client-side filters (API returns full list). */
  readonly statusFilter = new FormControl<string>('all', { nonNullable: true });
  readonly searchQuery = new FormControl<string>('', { nonNullable: true });

  ngOnInit(): void {
    merge(
      this.statusFilter.valueChanges,
      this.searchQuery.valueChanges.pipe(debounceTime(250), distinctUntilChanged())
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.messagesListPage = 1;
        this.cdr.markForCheck();
      });
    this.loadMessages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  badgePositive = adminBadgePositive;

  canDelete(): boolean {
    return this.auth.hasPermission(PERMISSIONS.ADMIN.HELP_CENTER.DELETE);
  }

  private emitUnreadCount(): void {
    const n = this.messages.filter(m => !m.isRead).length;
    this.unreadCountChange.emit(n);
  }

  statusFilterOptions(): DropdownOption<string>[] {
    return [
      { label: this.i18n.getTranslation('helpCenter.messagesFilterAll'), value: 'all' },
      { label: this.i18n.getTranslation('helpCenter.messagesFilterUnread'), value: 'unread' },
      { label: this.i18n.getTranslation('helpCenter.messagesFilterRead'), value: 'read' }
    ];
  }

  /** Messages after status + sender/subject search (no mutation of API list). */
  filteredMessages(): HelpCenterContactMessageDto[] {
    let list = this.messages;
    const status = this.statusFilter.value ?? 'all';
    if (status === 'read') {
      list = list.filter(m => m.isRead);
    } else if (status === 'unread') {
      list = list.filter(m => !m.isRead);
    }
    const q = (this.searchQuery.value ?? '').trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter(m => {
      const name = (m.senderName ?? '').toLowerCase();
      const email = (m.senderEmail ?? '').toLowerCase();
      const subj = (m.subject ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || subj.includes(q);
    });
  }

  loadMessages(): void {
    this.loadingMessages = true;
    this.helpCenter
      .getAllContactMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: rows => {
          this.messages = rows;
          this.messagesListPage = 1;
          this.loadingMessages = false;
          this.emitUnreadCount();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.loadMessagesError'));
          this.loadingMessages = false;
          this.unreadCountChange.emit(0);
          this.cdr.markForCheck();
        }
      });
  }

  openMessage(m: HelpCenterContactMessageDto): void {
    this.selectedMessage = m;
    this.messageModalOpen = true;
    this.loadingMessageDetail = true;
    this.helpCenter
      .getContactMessageById(m.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: detail => {
          this.selectedMessage = detail;
          this.loadingMessageDetail = false;
          this.loadMessages();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.loadMessageError'));
          this.loadingMessageDetail = false;
          this.cdr.markForCheck();
        }
      });
  }

  closeMessageModal(): void {
    this.messageModalOpen = false;
    this.selectedMessage = null;
    this.cdr.markForCheck();
  }

  confirmDeleteMessage(m: HelpCenterContactMessageDto): void {
    this.messageToDelete = m;
    this.showDeleteMessageDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteMessageConfirm(): void {
    const m = this.messageToDelete;
    this.showDeleteMessageDialog = false;
    this.messageToDelete = null;
    if (!m) return;
    this.helpCenter
      .deleteContactMessage(m.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.messageDeleted'));
          if (this.selectedMessage?.id === m.id) this.closeMessageModal();
          this.loadMessages();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.messageDeleteError'));
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteMessageCancel(): void {
    this.showDeleteMessageDialog = false;
    this.messageToDelete = null;
    this.cdr.markForCheck();
  }

  safeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  messagesTableTotalPages(): number {
    return adminTotalPages(this.filteredMessages().length, this.rowsPerPage);
  }

  effectiveMessagesPage(): number {
    return Math.min(Math.max(1, this.messagesListPage), this.messagesTableTotalPages());
  }

  paginatedMessages(): HelpCenterContactMessageDto[] {
    const all = this.filteredMessages();
    const page = this.effectiveMessagesPage();
    const start = (page - 1) * this.rowsPerPage;
    return all.slice(start, start + this.rowsPerPage);
  }

  onMessagesPageChange(p: number): void {
    const t = this.messagesTableTotalPages();
    this.messagesListPage = Math.max(1, Math.min(p, t));
    this.cdr.markForCheck();
  }

  onMessagesRowsPerPageChange(size: number): void {
    this.rowsPerPage = size;
    this.messagesListPage = 1;
    this.cdr.markForCheck();
  }
}

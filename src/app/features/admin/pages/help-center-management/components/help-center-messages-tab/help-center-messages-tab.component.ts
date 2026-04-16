import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Send, Trash2 } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { HelpCenterService } from '@services/help-center.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { BackendAuthService } from '@services/backend-auth.service';
import { HelpCenterContactMessageDto } from '@models/help-center.model';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { APP_CONSTANTS } from '@constants/app.constants';
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
    ConfirmDialogComponent,
    ModalComponent,
    ButtonComponent,
    PaginationComponent,
    AppDateTimePipe
  ],
  templateUrl: './help-center-messages-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterMessagesTabComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly auth = inject(BackendAuthService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly Send = Send;
  readonly Trash2 = Trash2;

  readonly adminPageSize = APP_CONSTANTS.DEFAULT_PAGE_SIZE;
  messages: HelpCenterContactMessageDto[] = [];
  loadingMessages = false;
  messagesListPage = 1;

  messageModalOpen = false;
  selectedMessage: HelpCenterContactMessageDto | null = null;
  loadingMessageDetail = false;
  savingReply = false;
  replyForm = this.fb.nonNullable.group({
    adminReply: ['', Validators.required]
  });

  showDeleteMessageDialog = false;
  messageToDelete: HelpCenterContactMessageDto | null = null;

  ngOnInit(): void {
    this.loadMessages();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  badgePositive = adminBadgePositive;
  totalPagesFor = adminTotalPages;

  canEdit(): boolean {
    return this.auth.hasPermission('helpcenter.edit');
  }
  canDelete(): boolean {
    return this.auth.hasPermission('helpcenter.delete');
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
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.loadMessagesError'));
          this.loadingMessages = false;
          this.cdr.markForCheck();
        }
      });
  }

  openMessage(m: HelpCenterContactMessageDto): void {
    this.selectedMessage = m;
    this.replyForm.reset({ adminReply: '' });
    this.messageModalOpen = true;
    this.loadingMessageDetail = true;
    this.helpCenter
      .getContactMessageById(m.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: detail => {
          this.selectedMessage = detail;
          this.replyForm.patchValue({ adminReply: detail.adminReply ?? '' });
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

  submitReply(): void {
    const msg = this.selectedMessage;
    if (!msg || this.replyForm.invalid) {
      this.replyForm.markAllAsTouched();
      return;
    }
    const reply = this.replyForm.getRawValue().adminReply.trim();
    if (!reply) return;
    this.savingReply = true;
    this.helpCenter
      .replyToContactMessage(msg.id, { adminReply: reply })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.replySaved'));
          this.savingReply = false;
          this.closeMessageModal();
          this.loadMessages();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.replyError'));
          this.savingReply = false;
          this.cdr.markForCheck();
        }
      });
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

  effectiveMessagesPage(): number {
    return Math.min(Math.max(1, this.messagesListPage), this.totalPagesFor(this.messages.length));
  }

  paginatedMessages(): HelpCenterContactMessageDto[] {
    const page = this.effectiveMessagesPage();
    const start = (page - 1) * this.adminPageSize;
    return this.messages.slice(start, start + this.adminPageSize);
  }

  onMessagesPageChange(p: number): void {
    const t = this.totalPagesFor(this.messages.length);
    this.messagesListPage = Math.max(1, Math.min(p, t));
    this.cdr.markForCheck();
  }
}

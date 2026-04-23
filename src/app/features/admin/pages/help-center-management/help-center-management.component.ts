import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, BookOpen, Download, FileText, Inbox, Phone } from 'lucide-angular';
import { Subject, catchError, of, takeUntil } from 'rxjs';

import { HelpCenterService } from '@help-center/services/help-center.service';
import { HelpCenterArticlesTabComponent } from './components/help-center-articles-tab/help-center-articles-tab.component';
import { HelpCenterMessagesTabComponent } from './components/help-center-messages-tab/help-center-messages-tab.component';
import { HelpCenterTermsTabComponent } from './components/help-center-terms-tab/help-center-terms-tab.component';
import { HelpCenterContactTabComponent } from './components/help-center-contact-tab/help-center-contact-tab.component';
import { HelpCenterManualTabComponent } from './components/help-center-manual-tab/help-center-manual-tab.component';

type AdminTab = 'articles' | 'messages' | 'terms' | 'manual' | 'contact';

@Component({
  selector: 'app-help-center-management',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    HelpCenterArticlesTabComponent,
    HelpCenterMessagesTabComponent,
    HelpCenterTermsTabComponent,
    HelpCenterManualTabComponent,
    HelpCenterContactTabComponent
  ],
  templateUrl: './help-center-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterManagementComponent implements OnInit, OnDestroy {
  private readonly helpCenter = inject(HelpCenterService);
  private readonly destroy$ = new Subject<void>();

  readonly BookOpen = BookOpen;
  readonly Download = Download;
  readonly FileText = FileText;
  readonly Inbox = Inbox;
  readonly Phone = Phone;

  activeTab = signal<AdminTab>('articles');
  /** Unread contact messages (`isRead === false`). Shown on Messages tab. */
  unreadMessageCount = signal(0);

  ngOnInit(): void {
    this.refreshUnreadMessageCount();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Called when the messages tab refreshes its list (open, delete, load). */
  onMessagesUnreadCountChange(count: number): void {
    this.unreadMessageCount.set(Math.max(0, count));
  }

  private refreshUnreadMessageCount(): void {
    this.helpCenter
      .getAllContactMessages()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([]))
      )
      .subscribe(messages => {
        const n = messages.filter(m => !m.isRead).length;
        this.unreadMessageCount.set(n);
      });
  }

  tabClasses(isActive: boolean): string {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg border-0 px-4 py-2 text-sm font-semibold cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]';
    const active =
      'bg-[var(--color-brand)] text-white shadow-sm hover:bg-[var(--color-brand-dark)] hover:text-white';
    const inactive =
      'bg-transparent text-[color-mix(in_srgb,var(--color-text)_72%,var(--color-background)_28%)] hover:bg-[var(--color-background)] hover:text-[var(--color-text)]';
    return `${base} ${isActive ? active : inactive}`;
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
  }
}

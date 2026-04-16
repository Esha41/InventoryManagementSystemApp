import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, BookOpen, FileText, Inbox } from 'lucide-angular';

import { HelpCenterArticlesTabComponent } from './components/help-center-articles-tab/help-center-articles-tab.component';
import { HelpCenterMessagesTabComponent } from './components/help-center-messages-tab/help-center-messages-tab.component';
import { HelpCenterTermsTabComponent } from './components/help-center-terms-tab/help-center-terms-tab.component';

type AdminTab = 'articles' | 'messages' | 'terms';

@Component({
  selector: 'app-help-center-management',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    HelpCenterArticlesTabComponent,
    HelpCenterMessagesTabComponent,
    HelpCenterTermsTabComponent
  ],
  templateUrl: './help-center-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterManagementComponent {
  readonly BookOpen = BookOpen;
  readonly FileText = FileText;
  readonly Inbox = Inbox;

  activeTab = signal<AdminTab>('articles');

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

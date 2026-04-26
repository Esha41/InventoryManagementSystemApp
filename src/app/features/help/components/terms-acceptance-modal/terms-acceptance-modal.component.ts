import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { HelpCenterTermsDto } from '@models/help-center.model';
import { TermsAcceptanceFacade } from '../../facades/terms-acceptance.facade';
import { HelpCenterHtmlSanitizerService } from '@help-center/services/help-center-html-sanitizer.service';

@Component({
  selector: 'app-terms-acceptance-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './terms-acceptance-modal.component.html',
  styleUrl: './terms-acceptance-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsAcceptanceModalComponent {
  readonly facade: TermsAcceptanceFacade = inject(TermsAcceptanceFacade);
  private readonly htmlSanitizer = inject(HelpCenterHtmlSanitizerService);

  /** User must check this before Continue is enabled. */
  readonly hasReadAndAgreed = signal(false);

  constructor() {
    effect(() => {
      const terms: HelpCenterTermsDto | null = this.facade.pendingTerms();
      if (terms != null) {
        this.hasReadAndAgreed.set(false);
      }
    });
  }

  safeContent(html: string): SafeHtml {
    return this.htmlSanitizer.sanitizeRichHtml(html);
  }

  onAgreedChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.hasReadAndAgreed.set(checked);
  }

  onAccept(): void {
    if (!this.hasReadAndAgreed()) return;
    this.facade.submitAcceptance();
  }
}

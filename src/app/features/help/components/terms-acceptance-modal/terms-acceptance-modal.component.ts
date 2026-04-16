import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { TermsAcceptanceFacade } from '@features/help-me-user/facades/terms-acceptance.facade';

@Component({
  selector: 'app-terms-acceptance-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './terms-acceptance-modal.component.html',
  styleUrl: './terms-acceptance-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsAcceptanceModalComponent {
  readonly facade = inject(TermsAcceptanceFacade);
  private readonly sanitizer = inject(DomSanitizer);

  safeContent(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onAccept(): void {
    this.facade.submitAcceptance();
  }
}

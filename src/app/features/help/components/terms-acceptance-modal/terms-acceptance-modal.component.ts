import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TermsAcceptanceFacade } from '../../facades/terms-acceptance.facade';
import { TranslationService } from '@services/translation.service';

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
  private readonly translation = inject(TranslationService);

  readonly hasReadAndAgreed = signal(false);

  constructor() {
    effect(() => {
      if (this.facade.pendingTerms() != null) {
        this.hasReadAndAgreed.set(false);
      }
    });
  }

  isAppRtl(): boolean {
    return this.translation.isRTL();
  }

  onAgreedChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.hasReadAndAgreed.set(checked);
  }

  onAccept(): void {
    if (!this.hasReadAndAgreed()) return;
    this.facade.submitAcceptance();
  }

  onRetry(): void {
    this.facade.retryTermsGate();
  }
}

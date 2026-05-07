import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-weapon-asset-bulk-progress-overlay',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    @if (visible) {
      <div
        class="weapon-bulk-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
        role="alertdialog"
        aria-modal="true"
        aria-busy="true"
        [attr.aria-label]="'addWeaponAsset.progress.title' | translate"
      >
        <div
          class="weapon-bulk-panel mx-4 flex w-full max-w-sm flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-8 py-10 shadow-xl"
        >
          <div class="weapon-bulk-spinner mb-6" aria-hidden="true"></div>
          <h3 class="text-center text-lg font-semibold tracking-tight text-[var(--color-text)]">
            {{ 'addWeaponAsset.progress.title' | translate }}
          </h3>
          <p class="mt-2 max-w-[16rem] text-center text-sm leading-relaxed text-[var(--color-text-muted)]">
            {{ 'addWeaponAsset.progress.subtitle' | translate }}
          </p>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @keyframes weapon-bulk-spin {
        to {
          transform: rotate(360deg);
        }
      }
      .weapon-bulk-spinner {
        width: 2.75rem;
        height: 2.75rem;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-brand);
        border-radius: 50%;
        animation: weapon-bulk-spin 0.75s linear infinite;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAssetBulkProgressOverlayComponent {
  @Input({ required: true }) visible!: boolean;
}

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
        role="progressdialog"
        aria-modal="true"
        [attr.aria-valuenow]="percentComplete"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="100"
        [attr.aria-label]="'addWeaponAsset.progress.title' | translate"
      >
        <div
          class="weapon-bulk-panel mx-4 flex w-full max-w-md flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-8 py-10 shadow-xl"
        >
          <!-- Spinner -->
          <div class="mb-6 flex justify-center">
            <div class="weapon-bulk-spinner" aria-hidden="true"></div>
          </div>

          <!-- Title -->
          <h3 class="text-center text-lg font-semibold tracking-tight text-[var(--color-text)]">
            {{ 'addWeaponAsset.progress.title' | translate }}
          </h3>

          <!-- Progress Stats -->
          <div class="mt-6 space-y-3">
            <!-- Percentage -->
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-[var(--color-text)]">{{ 'addWeaponAsset.progress.percentLabel' | translate }}</span>
              <span class="text-sm font-semibold text-[var(--color-brand)]">{{ percentComplete }}%</span>
            </div>

            <!-- Progress Bar -->
            <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                class="h-full bg-[var(--color-brand)] transition-all duration-500"
                [style.width.%]="percentComplete"
                role="presentation"
              ></div>
            </div>

            <!-- Count -->
            <div class="mt-4 space-y-1 text-sm">
              <p class="text-[var(--color-text-muted)]">
                {{ processedCount | number:'0,0' }} / {{ totalCount | number:'0,0' }} {{ 'common.records' | translate }}
              </p>
              @if (elapsedSeconds > 0) {
                <p class="text-xs text-[var(--color-text-muted)]">
                  ⏱️ {{ formatDuration(elapsedSeconds) }}
                  @if (estimatedSecondsRemaining > 0) {
                    <span class="ms-2 text-[var(--color-text-muted)]">
                      | {{ 'common.estimatedTime' | translate }}: {{ formatDuration(estimatedSecondsRemaining) }}
                    </span>
                  }
                </p>
              }
            </div>
          </div>

          <!-- Subtitle -->
          <p class="mt-6 text-center text-xs text-[var(--color-text-muted)]">
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
  @Input() percentComplete = 0;
  @Input() processedCount = 0;
  @Input() totalCount = 0;
  @Input() elapsedSeconds = 0;

  get estimatedSecondsRemaining(): number {
    if (this.percentComplete <= 0 || this.elapsedSeconds <= 0) return 0;
    const rate = this.elapsedSeconds / this.percentComplete;
    return Math.max(0, Math.round(rate * (100 - this.percentComplete)));
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }
}

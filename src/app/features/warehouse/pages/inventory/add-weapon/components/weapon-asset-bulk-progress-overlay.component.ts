import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-weapon-asset-bulk-progress-overlay',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    @if (visible) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div class="bg-[var(--color-background)] p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
          <h3 class="text-lg font-bold mb-4">{{ 'addWeaponAsset.progress.title' | translate }}</h3>
          <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              class="bg-[var(--color-brand)] h-2.5 rounded-full transition-all duration-300"
              [style.width.%]="progressPercent"></div>
          </div>
          <p class="text-sm text-[var(--color-text-muted)] text-center">
            {{
              'addWeaponAsset.progress.status'
                | translate
                  : { current: progress.current, total: progress.total }
            }}
          </p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAssetBulkProgressOverlayComponent {
  @Input({ required: true }) visible!: boolean;
  @Input({ required: true }) progress!: { current: number; total: number };

  get progressPercent(): number {
    const { current, total } = this.progress;
    if (!total || total <= 0) {
      return 0;
    }
    return (current / total) * 100;
  }
}

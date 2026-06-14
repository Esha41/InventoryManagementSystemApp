import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Database, Download, ScanLine } from 'lucide-angular';

export type ImportLoaderPhase = 'preview' | 'importing' | 'finalizing';

/**
 * Full-screen, non-dismissable progress loader shown while a bulk import is
 * being processed by the server. Items "enter" the system during this phase
 * and we cannot let the user navigate away or trigger another import.
 *
 * The loader is purely presentational — the parent component owns state and
 * passes the current phase + optional metadata (entity name, item count,
 * file name) via signal inputs.
 */
@Component({
  selector: 'app-import-progress-loader',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-progress-loader.component.html',
  styleUrls: ['./import-progress-loader.component.css']
})
export class ImportProgressLoaderComponent {
  /** Whether the overlay is visible. */
  isOpen = input.required<boolean>();

  /** Which step of the import flow is currently running. Drives icon, title, message. */
  phase = input<ImportLoaderPhase>('importing');

  /** Translated entity name shown in messages, e.g. "weapons", "ammunition". */
  entityName = input<string>('');

  /** Total rows being imported (from preview). When set, shown as a count badge. */
  itemCount = input<number | null>(null);

  /** Source file name shown as subtle subtext (e.g. "weapons.xlsx"). */
  fileName = input<string | null>(null);

  /** RTL flag — flips icon position. Forwarded from parent. */
  isRTL = input<boolean>(false);

  // Lucide icon refs (import uses Download — same as Import buttons across the app)
  readonly Download = Download;
  readonly Database = Database;
  readonly ScanLine = ScanLine;

  /** Icon shown above the title — varies per phase to give visual context. */
  phaseIcon = computed(() => {
    switch (this.phase()) {
      case 'preview': return this.ScanLine;
      case 'finalizing': return this.Database;
      case 'importing':
      default: return this.Download;
    }
  });

  /** i18n key for the title — parent doesn't pass a string, we derive it from phase. */
  titleKey = computed(() => {
    switch (this.phase()) {
      case 'preview': return 'importLoader.titlePreview';
      case 'finalizing': return 'importLoader.titleFinalizing';
      case 'importing':
      default: return 'importLoader.titleImporting';
    }
  });

  /** i18n key for the body message. */
  messageKey = computed(() => {
    switch (this.phase()) {
      case 'preview': return 'importLoader.messagePreview';
      case 'finalizing': return 'importLoader.messageFinalizing';
      case 'importing':
      default: return 'importLoader.messageImporting';
    }
  });

  /** Object passed to translate pipe so {{entityName}} / {{count}} are interpolated. */
  translateParams = computed(() => ({
    entityName: this.entityName(),
    count: this.itemCount() ?? 0
  }));
}

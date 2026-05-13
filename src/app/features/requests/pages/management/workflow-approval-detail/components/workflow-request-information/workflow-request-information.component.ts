import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, FileText, Eye, User, Download } from 'lucide-angular';
import { RequestDetail, FileUploadDto } from '@models/workflow-approval.model';
import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';
import { getLocalizedValue as getLocalizedValueHelper } from '../../utils/workflow-approval-helpers';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { getPriorityKey } from '@utils/priority.utils';

@Component({
  selector: 'app-workflow-request-information',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    AppDateTimePipe
  ],
  templateUrl: './workflow-request-information.component.html',
  styleUrls: ['./workflow-request-information.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowRequestInformationComponent {
  readonly FileText = FileText;
  readonly Eye = Eye;
  readonly User = User;
  readonly Download = Download;

  @Input() requestDetail: RequestDetail | null = null;
  @Input() orderFiles: FileUploadDto[] = [];
  @Input() destroy$!: Subject<void>;

  constructor(
    private translateService: TranslateService,
    private supplyServiceHelper: WorkflowApprovalSupplyService
  ) { }

  /**
   * Get localized value
   */
  getLocalizedValue(en: string | undefined, ar: string | undefined): string {
    return getLocalizedValueHelper(en, ar, this.translateService);
  }

  /** Stable key suffix for `common.priorityLevels.*` (Normal / Urgent / VeryUrgent). */
  getPriorityI18nSuffix(priority?: string | number | null): string {
    return getPriorityKey(priority);
  }

  /**
   * Get priority text color class.
   * All priority levels now render in the brand color for visual cohesion with
   * the workflow approval page theme; the priority text label itself remains
   * the source of differentiation between levels.
   */
  getPriorityTextColor(priority?: number | string | null): string {
    return priority ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]';
  }

  private normalizePriorityToNumber(priority?: number | string | null): number | undefined {
    if (priority === null || priority === undefined) return undefined;
    if (typeof priority === 'number') return priority;

    const raw = String(priority).trim();
    if (!raw) return undefined;

    const asNumber = Number(raw);
    if (!Number.isNaN(asNumber)) return asNumber;

    const key = raw.toLowerCase().replace(/\s+/g, '');
    if (key === 'normal') return 1;
    if (key === 'urgent') return 2;
    if (key === 'veryurgent') return 3;
    if (key === 'critical') return 4;
    return undefined;
  }

  isVeryUrgentOrCritical(priority?: number | string | null): boolean {
    const n = this.normalizePriorityToNumber(priority);
    return n === 3 || n === 4;
  }

  /**
   * Download a request file (order/return/discard files)
   */
  downloadFile(fileId: number, fileName: string): void {
    if (!fileId || !fileName) {
      return;
    }

    this.supplyServiceHelper.downloadFile(fileId, fileName, this.destroy$)
      .subscribe({
        next: (blob: Blob) => {
          // Create blob URL and trigger download
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        },
        error: () => {
          // Error already handled in service
        }
      });
  }
}

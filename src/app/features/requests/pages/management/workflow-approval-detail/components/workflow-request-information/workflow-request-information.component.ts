import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, FileText, Eye, User, Download } from 'lucide-angular';
import { RequestDetail, FileUploadDto, Priority } from '@models/workflow-approval.model';
import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';
import { getLocalizedValue as getLocalizedValueHelper } from '../../utils/workflow-approval-helpers';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

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

  /** Request types that show the order/return/discard file list in this card. */
  private static readonly attachmentRequestTypes = new Set(['Order', 'Return', 'Discard']);

  @Input() requestDetail: RequestDetail | null = null;
  @Input() orderFiles: FileUploadDto[] = [];
  @Input() destroy$!: Subject<void>;

  constructor(
    private translateService: TranslateService,
    private supplyServiceHelper: WorkflowApprovalSupplyService
  ) { }

  showsRequestAttachmentsSection(): boolean {
    const t = this.requestDetail?.requestType;
    if (!t || !WorkflowRequestInformationComponent.attachmentRequestTypes.has(t)) return false;
    return (this.orderFiles?.length ?? 0) > 0;
  }

  hasAttachmentRequirementSlots(): boolean {
    return (this.orderFiles ?? []).some(f => this.slotId(f) != null);
  }

  /** Grouped slot-bound files, sorted by requirement id. */
  attachmentRequirementGroups(): { requirementId: number; label: string; files: FileUploadDto[] }[] {
    const map = new Map<number, FileUploadDto[]>();
    for (const f of this.orderFiles ?? []) {
      const id = this.slotId(f);
      if (id == null) continue;
      const list = map.get(id) ?? [];
      list.push(f);
      map.set(id, list);
    }
    const ids = [...map.keys()].sort((a, b) => a - b);
    return ids.map(requirementId => {
      const files = map.get(requirementId) ?? [];
      const first = files[0];
      const en = this.slotNameEn(first);
      const ar = this.slotNameAr(first);
      const label =
        (en || ar) ? this.getLocalizedValue(en || undefined, ar || undefined) : `#${requirementId}`;
      return { requirementId, label, files };
    });
  }

  otherAttachments(): FileUploadDto[] {
    return (this.orderFiles ?? []).filter(f => this.slotId(f) == null);
  }

  private slotId(f: FileUploadDto): number | null {
    const ext = f as FileUploadDto & { AttachmentRequirementId?: number | null };
    const raw = f.attachmentRequirementId ?? ext.AttachmentRequirementId;
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  private slotNameEn(f: FileUploadDto): string | undefined {
    const ext = f as FileUploadDto & { AttachmentRequirementNameEn?: string | null };
    return f.attachmentRequirementNameEn ?? ext.AttachmentRequirementNameEn ?? undefined;
  }

  private slotNameAr(f: FileUploadDto): string | undefined {
    const ext = f as FileUploadDto & { AttachmentRequirementNameAr?: string | null };
    return f.attachmentRequirementNameAr ?? ext.AttachmentRequirementNameAr ?? undefined;
  }

  /**
   * Get localized value
   */
  getLocalizedValue(en: string | undefined, ar: string | undefined): string {
    return getLocalizedValueHelper(en, ar, this.translateService);
  }

  /** Stable key suffix for `common.priorityLevels.*` (Normal / Urgent / VeryUrgent). */
  getPriorityI18nSuffix(priority?: string | null): string {
    if (!priority) return 'Normal';
    const key = priority.toLowerCase().replace(/\s+/g, '');
    if (key === 'veryurgent') return 'VeryUrgent';
    if (key === 'urgent') return 'Urgent';
    return 'Normal';
  }

  /**
   * Get priority text color class.
   * All priority levels now render in the brand color for visual cohesion with
   * the workflow approval page theme; the priority text label itself remains
   * the source of differentiation between levels.
   */
  getPriorityTextColor(priority?: Priority | null): string {
    return priority ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]';
  }

  isVeryUrgentOrCritical(priority?: Priority | null): boolean {
    return priority === 'VeryUrgent' || priority === 'Critical';
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

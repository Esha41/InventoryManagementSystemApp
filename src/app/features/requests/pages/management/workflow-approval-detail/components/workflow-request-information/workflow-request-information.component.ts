import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, FileText, Eye, User, Download } from 'lucide-angular';
import { RequestDetail, FileUploadDto } from '@models/workflow-approval.model';
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

  /**
   * Get priority text color class
   * Colors: Normal = Green, Urgent = Orange, VeryUrgent = Red, Critical = Red
   */
  getPriorityTextColor(priority?: number | string | null): string {
    if (!priority) return 'text-gray-600';

    // Normalize priority to string
    let priorityStr: string;
    if (typeof priority === 'number') {
      switch (priority) {
        case 1: priorityStr = 'Normal'; break;
        case 2: priorityStr = 'Urgent'; break;
        case 3: priorityStr = 'VeryUrgent'; break;
        case 4: priorityStr = 'Critical'; break;
        default: return 'text-gray-600';
      }
    } else {
      priorityStr = priority.toString();
    }

    // Handle Priority type values: 'Normal' | 'Urgent' | 'VeryUrgent' | 'Critical'
    switch (priorityStr) {
      case 'Normal':
        return 'text-green-600';
      case 'Urgent':
        return 'text-orange-600';
      case 'VeryUrgent':
        return 'text-red-600';
      case 'Critical':
        return 'text-red-600';
      default: {
        const priorityLower = priorityStr.toLowerCase().trim().replace(/\s+/g, '');
        if (priorityLower === 'normal' || priorityLower === '1') {
          return 'text-green-600';
        } else if (priorityLower === 'urgent' || priorityLower === '2') {
          return 'text-orange-600';
        } else if (priorityLower === 'veryurgent' || priorityLower === '3') {
          return 'text-red-600';
        } else if (priorityLower === 'critical' || priorityLower === '4') {
          return 'text-red-600';
        }
        return 'text-gray-600';
      }
    }
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

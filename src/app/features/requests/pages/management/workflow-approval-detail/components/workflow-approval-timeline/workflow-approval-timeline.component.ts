import { Component, Input, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, CheckCircle, AlertTriangle, Clock, FileText, Eye, ChevronDown, ChevronUp, Download } from 'lucide-angular';
import { RequestDetail, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';
import {
  getDisplayApprovalHistory,
  formatApprovalDateTime,
  getLocalizedValue as getLocalizedValueHelper,
  getApproverName as getApproverNameHelper
} from '../../utils/workflow-approval-helpers';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';

@Component({
  selector: 'app-workflow-approval-timeline',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './workflow-approval-timeline.component.html',
  styleUrls: ['./workflow-approval-timeline.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowApprovalTimelineComponent implements OnDestroy {
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly Clock = Clock;
  readonly FileText = FileText;
  readonly Eye = Eye;
  readonly Download = Download;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  @Input() requestDetail: RequestDetail | null = null;
  @Input() destroy$!: Subject<void>;

  // Collapsible state
  isExpanded: boolean = true;

  constructor(
    private translateService: TranslateService,
    private supplyServiceHelper: WorkflowApprovalSupplyService
  ) { }

  ngOnDestroy(): void {
    // Component cleanup if needed
  }

  /**
   * Toggle expanded state
   */
  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  /**
   * Get approval history with requester as the first step
   */
  get displayApprovalHistory(): WorkflowApprovalStep[] {
    return getDisplayApprovalHistory(this.requestDetail, this.translateService);
  }

  /**
   * Get approval status icon based on status
   */
  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.AlertTriangle;
      case 'Pending': return this.Clock;
      case 'Returned':
      case 'ReturnedForReview': return this.CheckCircle;
      default: return this.Clock;
    }
  }

  /**
   * Get approval status class for badge
   */
  getApprovalStatusClass(status: string): string {
    return getApprovalStatusBadgeClass(status);
  }

  /**
   * Format approval date time
   */
  formatApprovalDateTime(dateTime: string | Date | undefined, changedAt?: string | Date | undefined): string {
    return formatApprovalDateTime(dateTime, changedAt, this.translateService);
  }

  /**
   * Get approver name
   */
  getApproverName(approval: WorkflowApprovalStep): string {
    return getApproverNameHelper(approval, this.translateService);
  }

  /**
   * Get localized value
   */
  getLocalizedValue(en: string | undefined, ar: string | undefined): string {
    return getLocalizedValueHelper(en, ar, this.translateService);
  }

  getDelegationMessageKey(approval: WorkflowApprovalStep): string {
    switch (approval.status) {
      case 'Approved':
        return 'workflowApprovalDetail.approvedThroughDelegation';
      case 'Rejected':
        return 'workflowApprovalDetail.rejectedThroughDelegation';
      case 'Returned':
      case 'ReturnedForReview':
        return 'workflowApprovalDetail.returnedThroughDelegation';
      default:
        return 'workflowApprovalDetail.actedThroughDelegation';
    }
  }

  showPerformedAsRole(approval: WorkflowApprovalStep): boolean {
    if (
      approval.isPending ||
      approval.isDelegation === true ||
      approval.isDelegation === 1 ||
      !approval.changedByRoleId ||
      !approval.applicationRoleId
    ) {
      return false;
    }
    if (!approval.changedByRoleName && !approval.changedByRoleNameAr) {
      return false;
    }
    return String(approval.changedByRoleId) !== String(approval.applicationRoleId);
  }

  /**
   * Download a file from approval history
   */
  downloadApprovalFile(file: any): void {
    if (!file || !file.id) {
      return;
    }
    const fileName = file.originalName || file.fileName || 'download';

    this.supplyServiceHelper.downloadFile(file.id, fileName, this.destroy$)
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

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, CheckCircle, AlertTriangle, Clock, FileText, Eye, ChevronDown, ChevronUp, Download, Ban } from 'lucide-angular';
import { RequestDetail, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { FileUploadDto } from '@models/file-upload.model';
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
export class WorkflowApprovalTimelineComponent {
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly Clock = Clock;
  readonly FileText = FileText;
  readonly Eye = Eye;
  readonly Download = Download;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Ban = Ban;

  @Input() requestDetail: RequestDetail | null = null;
  @Input() destroy$!: Subject<void>;

  // Collapsible state
  isExpanded: boolean = true;

  constructor(
    private translateService: TranslateService,
    private supplyServiceHelper: WorkflowApprovalSupplyService
  ) { }

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
  getApprovalStatusIcon(status: string): typeof CheckCircle | typeof AlertTriangle | typeof Clock | typeof Ban {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.AlertTriangle;
      case 'AutoRejected': return this.AlertTriangle;
      case 'Cancelled': return this.Ban;
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
   * Show acting-role caption for cancellation (parallel to delegation line for approve/reject).
   */
  showCancelledActingRole(approval: WorkflowApprovalStep): boolean {
    if (approval.status !== 'Cancelled') {
      return false;
    }
    if (approval.isDelegation === true || approval.isDelegation === 1) {
      return false;
    }
    const role = this.getLocalizedValue(approval.changedByRoleName, approval.changedByRoleNameAr);
    return !!role;
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
      case 'AutoRejected':
        return 'workflowApprovalDetail.rejectedThroughDelegation';
      case 'Returned':
      case 'ReturnedForReview':
        return 'workflowApprovalDetail.returnedThroughDelegation';
      case 'Cancelled':
        return 'common.statuses.Cancelled';
      default:
        return 'workflowApprovalDetail.actedThroughDelegation';
    }
  }

  showPerformedAsRole(approval: WorkflowApprovalStep): boolean {
    if (approval.isPending || approval.isDelegation === true || approval.isDelegation === 1) {
      return false;
    }

    if (!approval.changedByRoleId) {
      return false;
    }

    if (approval.applicationRoleId && String(approval.changedByRoleId) === String(approval.applicationRoleId)) {
      return false;
    }

    return (
      approval.status === 'Approved' ||
      approval.status === 'Rejected' ||
      approval.status === 'AutoRejected' ||
      approval.status === 'Returned' ||
      approval.status === 'ReturnedForReview'
    );
  }

  getPerformedAsRoleValue(approval: WorkflowApprovalStep): string {
    return (
      this.getLocalizedValue(approval.changedByRoleName, approval.changedByRoleNameAr) ||
      this.getLocalizedValue(approval.applicationRoleName, approval.applicationRoleNameAr) ||
      ''
    );
  }

  getNonDelegationActionKey(approval: WorkflowApprovalStep): string {
    switch (approval.status) {
      case 'Approved':
        return 'common.statuses.Approved';
      case 'Rejected':
        return 'common.statuses.Rejected';
      case 'AutoRejected':
        return 'common.statuses.AutoRejected';
      case 'Returned':
      case 'ReturnedForReview':
        return 'common.statuses.ReturnedForReview';
      default:
        return 'common.statuses.Pending';
    }
  }

  getByLabel(): string {
    return this.translateService.instant('workflowApprovalDetail.delegationByRoleLabel');
  }

  /**
   * Download a file from approval history
   */
  downloadApprovalFile(file: FileUploadDto | null | undefined): void {
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

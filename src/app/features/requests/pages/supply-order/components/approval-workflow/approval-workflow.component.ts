import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle } from 'lucide-angular';
import { WorkflowApprovalStep } from '@models/workflow-approval.model';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { getApproverName as getApproverNameUtil } from '@requests/utils/supply-order-format.utils';
import { TranslationService } from '@services/translation.service';
import { getLocalizedValue as getLocalizedValueHelper } from '../../../management/workflow-approval-detail/utils/workflow-approval-helpers';

/**
 * Approval Workflow Component
 * Displays the approval workflow with expandable/collapsible functionality
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-approval-workflow',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './approval-workflow.component.html',
  styleUrls: ['./approval-workflow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApprovalWorkflowComponent implements OnInit {
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly AlertTriangle = AlertTriangle;

  @Input() approvalHistory: WorkflowApprovalStep[] = [];
  @Input() isExpanded: boolean = true;

  isApprovalWorkflowExpanded: boolean = true;

  constructor(
    private translationService: TranslationService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.isApprovalWorkflowExpanded = this.isExpanded;
  }

  toggleExpanded(): void {
    this.isApprovalWorkflowExpanded = !this.isApprovalWorkflowExpanded;
  }

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

  getApprovalStatusClass(status: string): string {
    return getApprovalStatusBadgeClass(status);
  }

  /**
   * Get localized approver name based on current language
   */
  getApproverName(approval: WorkflowApprovalStep): string {
    return getApproverNameUtil(approval, this.translationService);
  }

  getLocalizedExtra(en?: string, ar?: string): string {
    return getLocalizedValueHelper(en, ar, this.translate);
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
    return String(approval.changedByRoleId) !== String(approval.applicationRoleId);
  }
}


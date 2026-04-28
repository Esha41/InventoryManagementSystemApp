import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrderReportApprovalStep } from '@models/order-report.model';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';

/**
 * Component for displaying approval workflow cards
 */
@Component({
  selector: 'app-approval-workflow',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDateTimePipe],
  templateUrl: './approval-workflow.component.html',
  styleUrls: ['./approval-workflow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApprovalWorkflowComponent {
  @Input() workflow: OrderReportApprovalStep[] = [];
  @Input() isRTL: boolean = false;

  private readonly statusMap: Record<string, string> = {
    'approved': 'Approved',
    'submitted': 'Approved',
    'rejected': 'Rejected',
    'auto-rejected': 'AutoRejected',
    'autorejected': 'AutoRejected',
    'returned': 'Returned',
    'returnedforreview': 'ReturnedForReview',
    'pending': 'Pending',
    'in-progress': 'Pending',
  };

  getStepStatusClass(status: string): string {
    const badgeClass = this.statusMap[status.toLowerCase()];
    return badgeClass
      ? getApprovalStatusBadgeClass(badgeClass)
      : 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border-[var(--color-border)]';
  }
}

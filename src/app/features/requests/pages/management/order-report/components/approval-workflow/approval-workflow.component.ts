import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrderReportApprovalStep } from '@models/order-report.model';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

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
}

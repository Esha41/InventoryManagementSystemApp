import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrderSummary } from '@models/order-report.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';
import { TranslateService } from '@ngx-translate/core';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';

/**
 * Component for displaying order information section
 */
@Component({
  selector: 'app-order-info-section',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDatePipe],
  templateUrl: './order-info-section.component.html',
  styleUrls: ['./order-info-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderInfoSectionComponent {
  @Input() orderSummary!: OrderSummary;
  @Input() isRTL: boolean = false;

  constructor(private translate: TranslateService) {}

  getOrderSummaryStatusClass(statusKey: string): string {
    if (!statusKey) {
      return 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border-[var(--color-border)]';
    }

    const key = statusKey.toLowerCase();
    if (key.includes('autorejected') || key.includes('auto-rejected') || key.includes('auto rejected')) {
      return getApprovalStatusBadgeClass('AutoRejected');
    }
    if (key.includes('approved') || key.includes('completed')) {
      return getApprovalStatusBadgeClass('Approved');
    }
    if (key.includes('cancelled')) {
      return getApprovalStatusBadgeClass('Cancelled');
    }
    if (key.includes('rejected')) {
      return getApprovalStatusBadgeClass('Rejected');
    }
    if (key.includes('returned')) {
      return getApprovalStatusBadgeClass('ReturnedForReview');
    }
    if (key.includes('underprocess') || key.includes('pending') || key.includes('new')) {
      return getApprovalStatusBadgeClass('Pending');
    }

    return 'text-[var(--color-text-muted)] bg-[var(--color-background-muted)] border-[var(--color-border)]';
  }

  getPriorityColorClass(priority: string): string {
    const priorityLabel = priority.toLowerCase();
    if (priorityLabel === 'normal') {
      return 'priority-normal';
    } else if (priorityLabel === 'urgent') {
      return 'priority-urgent';
    } else if (priorityLabel === 'veryurgent') {
      return 'priority-veryurgent';
    }
    return 'priority-normal'; // default
  }

  resolveUsagePurpose(): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(
      {
        nameEn: this.orderSummary.requestPurposeNameEn,
        nameAr: this.orderSummary.requestPurposeNameAr
      },
      currentLang
    ) || this.orderSummary.usagePurpose || 'N/A';
  }

  resolveUsagePurposeNotes(): string {
    const raw = this.orderSummary.usagePurposeNotes;
    if (raw == null || String(raw).trim() === '') return 'N/A';
    return String(raw);
  }
}

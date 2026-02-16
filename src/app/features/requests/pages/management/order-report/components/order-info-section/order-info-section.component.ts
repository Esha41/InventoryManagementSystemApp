import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrderSummary } from '@models/order-report.model';
import { mapOrderPriorityToString } from '@utils/priority.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { BackendAuthService } from '@services/backend-auth.service';

/**
 * Component for displaying order information section
 */
@Component({
  selector: 'app-order-info-section',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDatePipe, AppDateTimePipe],
  templateUrl: './order-info-section.component.html',
  styleUrls: ['./order-info-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderInfoSectionComponent {
  @Input() orderSummary!: OrderSummary;
  @Input() isRTL: boolean = false;

  constructor(
    private translate: TranslateService,
    private authService: BackendAuthService
  ) {}

  get canViewSupplyDate(): boolean {
    return this.authService.hasPermission('ViewSupplyDate');
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
}

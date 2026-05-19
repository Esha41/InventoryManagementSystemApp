import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrderSummary } from '@models/order-report.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { getOrderSummaryStatusBadgeNgClass } from '@utils/status-class.utils';
import { TranslateService } from '@ngx-translate/core';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { getPriorityKey } from '@utils/priority.utils';
import { formatDateShort, formatTimeToMilitary } from '@utils/format.utils';

/**
 * Component for displaying order information section
 */
@Component({
  selector: 'app-order-info-section',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppDateTimePipe],
  templateUrl: './order-info-section.component.html',
  styleUrls: ['./order-info-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderInfoSectionComponent {
  @Input() orderSummary!: OrderSummary;
  @Input() isRTL: boolean = false;

  constructor(private translate: TranslateService) {}

  /**
   * Status pill in report body matches sidebar / system badges (avoid substring heuristics on i18n keys).
   */
  getOrderSummaryStatusBadgeClass(): string {
    return getOrderSummaryStatusBadgeNgClass(this.orderSummary?.requestStatusCode, this.orderSummary?.status);
  }

  /** Maps human label or enum text to Normal | Urgent | VeryUrgent for translation keys */
  getPriorityI18nSuffix(priority: string): string {
    return getPriorityKey(priority);
  }

  getPriorityColorClass(priority: string): string {
    const key = getPriorityKey(priority).toLowerCase();
    if (key === 'normal') {
      return 'priority-normal';
    } else if (key === 'urgent') {
      return 'priority-urgent';
    } else if (key === 'veryurgent') {
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

  /** Usage window start for orders: calendar date plus military time when available. */
  formatOrderUsageFrom(): string {
    return this.formatOrderUsageDateTime(
      this.orderSummary.usageDateFrom,
      this.orderSummary.usageTimeFrom
    );
  }

  /** Usage window end for orders: calendar date plus military time when available. */
  formatOrderUsageTo(): string {
    return this.formatOrderUsageDateTime(
      this.orderSummary.usageDateTo,
      this.orderSummary.usageTimeTo
    );
  }

  showOrderUsageFrom(): boolean {
    return this.orderSummary.requestType === 'Order' && this.formatOrderUsageFrom().length > 0;
  }

  showOrderUsageTo(): boolean {
    return this.orderSummary.requestType === 'Order' && this.formatOrderUsageTo().length > 0;
  }

  private formatOrderUsageDateTime(
    dateVal: string | Date | null | undefined,
    timeVal?: string | null
  ): string {
    if (dateVal === null || dateVal === undefined || dateVal === '') {
      return '';
    }
    const datePart = formatDateShort(dateVal);
    if (!datePart || datePart === 'N/A') {
      return '';
    }
    let timePart = formatTimeToMilitary(timeVal ?? '');
    if (!timePart) {
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal as string);
      if (!isNaN(d.getTime())) {
        const str = typeof dateVal === 'string' ? dateVal : '';
        const hasClock =
          d.getHours() !== 0 ||
          d.getMinutes() !== 0 ||
          d.getSeconds() !== 0 ||
          str.includes('T') ||
          /\d{2}:\d{2}/.test(str);
        if (hasClock) {
          timePart = formatTimeToMilitary(d);
        }
      }
    }
    return timePart ? `${datePart} ${timePart}` : datePart;
  }
}

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OrderDto } from '@models/order.model';
import { formatDate as formatDateUtil, formatTimeToMilitary } from '@utils/format.utils';
import { getPriorityClass } from '@utils/priority.utils';
import {
  getPriorityTranslationKey,
  resolveUsagePurpose,
  resolveDepartmentName,
  resolveRequesterName
} from '@utils/supply-order-format.utils';

/**
 * Supply Order Info Component
 * Displays request information (order number, department, requester, priority, etc.)
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-supply-order-info',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule
  ],
  templateUrl: './supply-order-info.component.html',
  styleUrls: ['./supply-order-info.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyOrderInfoComponent {
  @Input() orderData: OrderDto | null = null;

  formatDate = formatDateUtil;
  formatTimeToMilitary = formatTimeToMilitary;
  getPriorityClass = getPriorityClass;

  constructor(private translateService: TranslateService) {}

  /**
   * Get priority translation key
   * Handles both number and string priority values
   */
  getPriorityText(priority?: number | string | null): string {
    return getPriorityTranslationKey(priority);
  }

  /**
   * Resolve usage purpose with proper localization
   */
  resolveUsagePurpose(): string {
    return resolveUsagePurpose(this.orderData, this.translateService);
  }

  /**
   * Resolve department name with proper localization
   */
  resolveDepartmentName(): string {
    return resolveDepartmentName(this.orderData, this.translateService);
  }

  /**
   * Resolve requester name with proper localization
   */
  resolveRequesterName(): string {
    return resolveRequesterName(this.orderData, this.translateService);
  }
}


/**
 * Discharge Summary Card Component
 * Displays discharge totals and process button
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SupplyRequestDetail } from '@models/supply-request.model';
import { calculateDischargeTotals, canProcessDischarge } from '../../../utils/supply-request.mapper';
import { formatNumber as formatNumberUtil } from '@utils/format.utils';

@Component({
  selector: 'app-discharge-summary-card',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './discharge-summary-card.component.html',
  styleUrls: ['./discharge-summary-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DischargeSummaryCardComponent {
  @Input() requestDetail: SupplyRequestDetail | null = null;
  @Input() processingDischarge: boolean = false;
  @Output() processDischarge = new EventEmitter<void>();

  getTotalApproved(): number {
    if (!this.requestDetail?.items) return 0;
    return calculateDischargeTotals(this.requestDetail.items).totalApproved;
  }

  getTotalSelectedForDischarge(): number {
    if (!this.requestDetail?.items) return 0;
    return calculateDischargeTotals(this.requestDetail.items).totalSelected;
  }

  getTotalRemaining(): number {
    if (!this.requestDetail?.items) return 0;
    return calculateDischargeTotals(this.requestDetail.items).totalRemaining;
  }

  canProcessDischarge(): boolean {
    if (!this.requestDetail?.items) return false;
    return canProcessDischarge(this.requestDetail.items);
  }

  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  onProcessDischarge(): void {
    this.processDischarge.emit();
  }
}


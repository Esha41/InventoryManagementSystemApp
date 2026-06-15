/**
 * Discharge Summary Card Component
 * Displays discharge totals and process button
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SupplyRequestDetail } from '@models/supply-request.model';
import { calculateDischargeTotals, canProcessDischarge } from '../../../utils/supply-request.mapper';
import { AppNumberPipe } from '@shared/pipes/app-number.pipe';

@Component({
  selector: 'app-discharge-summary-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppNumberPipe],
  templateUrl: './discharge-summary-card.component.html',
  styleUrls: ['./discharge-summary-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DischargeSummaryCardComponent {
  @Input() requestDetail: SupplyRequestDetail | null = null;
  @Input() processingDischarge: boolean = false;
  @Output() processDischarge = new EventEmitter<void>();

  get dischargeTotals() {
    return this.requestDetail?.items ? calculateDischargeTotals(this.requestDetail.items) : null;
  }

  canProcessDischarge(): boolean {
    if (!this.requestDetail?.items) return false;
    return canProcessDischarge(this.requestDetail.items);
  }

  onProcessDischarge(): void {
    this.processDischarge.emit();
  }
}

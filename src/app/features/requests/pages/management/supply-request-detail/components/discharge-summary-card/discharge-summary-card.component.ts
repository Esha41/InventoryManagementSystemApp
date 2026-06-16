/**
 * Discharge Summary Card Component
 * Displays discharge totals and process button
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AppNumberPipe } from '@shared/pipes/app-number.pipe';

export interface DischargeTotals {
  totalApproved: number;
  totalSelected: number;
  totalRemaining: number;
}

@Component({
  selector: 'app-discharge-summary-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppNumberPipe],
  templateUrl: './discharge-summary-card.component.html',
  styleUrls: ['./discharge-summary-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DischargeSummaryCardComponent {
  @Input() dischargeTotals: DischargeTotals | null = null;
  @Input() processingDischarge: boolean = false;
  @Output() processDischarge = new EventEmitter<void>();

  canProcessDischarge(): boolean {
    if (!this.dischargeTotals) {
      return false;
    }
    const { totalSelected, totalApproved } = this.dischargeTotals;
    return totalSelected > 0 && totalSelected <= totalApproved;
  }

  onProcessDischarge(): void {
    this.processDischarge.emit();
  }
}

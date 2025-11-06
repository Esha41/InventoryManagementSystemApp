import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '../cartridge-list/cartridge-list.component';

@Component({
  selector: 'app-usage-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent],
  templateUrl: './usage-form.component.html',
  styleUrls: ['./usage-form.component.css']
})
export class UsageFormComponent {
  @Input() fromReserve: string = 'Yes';
  @Input() usePurpose: string = '';
  @Input() annualDiscardSpecialOps: string = '';
  @Input() usageLocation: string = '';
  @Input() numberOfOfficers: number | null = null;
  @Input() numberOfOtherRanks: number | null = null;
  @Input() usageDate: string = '';
  @Input() usageTime: string = '';
  @Input() totalReserve: number = 0;
  @Input() availableReserve: number = 0;
  @Input() orderedQuantity: number = 0;
  @Input() utilizedQuantity: number = 0;
  @Input() selectedCartridges: Cartridge[] = [];
  @Output() removeCartridge = new EventEmitter<number>();
  onRemoveCartridge(id: number): void {
    this.removeCartridge.emit(id);
  }

  @Output() fromReserveChange = new EventEmitter<string>();
  @Output() usePurposeChange = new EventEmitter<string>();
  @Output() annualDiscardSpecialOpsChange = new EventEmitter<string>();
  @Output() usageLocationChange = new EventEmitter<string>();
  @Output() numberOfOfficersChange = new EventEmitter<number | null>();
  @Output() numberOfOtherRanksChange = new EventEmitter<number | null>();
  @Output() usageDateChange = new EventEmitter<string>();
  @Output() usageTimeChange = new EventEmitter<string>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  onFromReserveChange(value: string): void {
    this.fromReserveChange.emit(value);
  }

  onUsePurposeChange(value: string): void {
    this.usePurposeChange.emit(value);
  }

  onAnnualDiscardSpecialOpsChange(value: string): void {
    this.annualDiscardSpecialOpsChange.emit(value);
  }

  onUsageLocationChange(value: string): void {
    this.usageLocationChange.emit(value);
  }

  onNumberOfOfficersChange(value: number | null): void {
    this.numberOfOfficersChange.emit(value);
  }

  onNumberOfOtherRanksChange(value: number | null): void {
    this.numberOfOtherRanksChange.emit(value);
  }

  onUsageDateChange(value: string): void {
    this.usageDateChange.emit(value);
  }

  onUsageTimeChange(value: string): void {
    this.usageTimeChange.emit(value);
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onNext(): void {
    this.next.emit();
  }
}


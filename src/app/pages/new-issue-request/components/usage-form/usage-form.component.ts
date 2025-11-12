import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '../cartridge-list/cartridge-list.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';

@Component({
  selector: 'app-usage-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, DropdownComponent],
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
  @Input() reserveDetailsByItem: any[] = [];
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() orderPriority: string = '';
  @Input() orderPriorities: string[] = ['High Priority', 'Medium Priority', 'Low Priority'];
  @Input() requesterComments: string = '';
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
  @Output() orderPriorityChange = new EventEmitter<string>();
  @Output() requesterCommentsChange = new EventEmitter<string>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  private readonly defaultErrors: UsageFormErrors = {
    usePurpose: null,
    usageLocation: null,
    usageDate: null,
    usageTime: null,
    orderPriority: null
  };

  formErrors: UsageFormErrors = { ...this.defaultErrors };
  hasAttemptedSubmit = false;

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

  onOrderPriorityChange(value: string): void {
    this.orderPriorityChange.emit(value);
  }

  onRequesterCommentsChange(value: string): void {
    this.requesterCommentsChange.emit(value);
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onNext(): void {
    this.hasAttemptedSubmit = true;
    if (this.validateForm()) {
      this.next.emit();
    }
  }

  isItemSelected(itemId: number): boolean {
    return this.selectedCartridges.some(cartridge => cartridge.id === itemId);
  }

  hasError(field: keyof UsageFormErrors): boolean {
    return this.hasAttemptedSubmit && !!this.formErrors[field];
  }

  hasAnyError(): boolean {
    return Object.values(this.formErrors).some(error => !!error);
  }

  private validateForm(): boolean {
    this.formErrors = { ...this.defaultErrors };
    let isValid = true;

    if (!this.usePurpose || this.usePurpose.trim().length === 0) {
      this.formErrors.usePurpose = 'newIssueRequest.validation.usePurposeRequired';
      isValid = false;
    }

    if (!this.usageLocation || this.usageLocation.trim().length === 0) {
      this.formErrors.usageLocation = 'newIssueRequest.validation.usageLocationRequired';
      isValid = false;
    }

    if (!this.usageDate || this.usageDate.trim().length === 0) {
      this.formErrors.usageDate = 'newIssueRequest.validation.usageDateRequired';
      isValid = false;
    }

    if (!this.usageTime || this.usageTime.trim().length === 0) {
      this.formErrors.usageTime = 'newIssueRequest.validation.usageTimeRequired';
      isValid = false;
    }

    if (!this.orderPriority || this.orderPriority.trim().length === 0) {
      this.formErrors.orderPriority = 'newIssueRequest.validation.orderPriorityRequired';
      isValid = false;
    }

    return isValid;
  }
}

type UsageFormErrors = {
  usePurpose: string | null;
  usageLocation: string | null;
  usageDate: string | null;
  usageTime: string | null;
  orderPriority: string | null;
};

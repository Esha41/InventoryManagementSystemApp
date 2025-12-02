import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '../cartridge-list/cartridge-list.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';

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
  @Input() selectedUsePurposeId: number | null = null;
  @Input() usePurposeOptions: DropdownOption<number>[] = [];
  @Input() usageLocation: string = '';
  @Input() numberOfOfficers: number | null = null;
  @Input() numberOfOtherRanks: number | null = null;
  @Input() usageDateFrom: string = '';
  @Input() usageTimeFrom: string = '';
  @Input() usageDateTo: string = '';
  @Input() usageTimeTo: string = '';
  @Input() totalReserve: number = 0;
  @Input() availableReserve: number = 0;
  @Input() orderedQuantity: number = 0;
  @Input() usedQuantity: number = 0;
  @Input() reserveDetailsByItem: any[] = [];
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() orderPriority: string = '';
  @Input() orderPriorities: string[] = ['High Priority', 'Medium Priority', 'Low Priority'];
  @Input() requesterComments: string = '';
  @Output() removeCartridge = new EventEmitter<number>();
  onRemoveCartridge(id: number): void {
    this.removeCartridge.emit(id);
  }

  @Output() usePurposeChange = new EventEmitter<string>();
  @Output() selectedUsePurposeIdChange = new EventEmitter<number | null>();
  @Output() usageLocationChange = new EventEmitter<string>();
  @Output() numberOfOfficersChange = new EventEmitter<number | null>();
  @Output() numberOfOtherRanksChange = new EventEmitter<number | null>();
  @Output() usageDateFromChange = new EventEmitter<string>();
  @Output() usageTimeFromChange = new EventEmitter<string>();
  @Output() usageDateToChange = new EventEmitter<string>();
  @Output() usageTimeToChange = new EventEmitter<string>();
  @Output() orderPriorityChange = new EventEmitter<string>();
  @Output() requesterCommentsChange = new EventEmitter<string>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  private readonly defaultErrors: UsageFormErrors = {
    usePurpose: null,
    usageLocation: null,
    usageDateFrom: null,
    usageTimeFrom: null,
    usageDateTo: null,
    usageTimeTo: null,
    orderPriority: null
  };

  formErrors: UsageFormErrors = { ...this.defaultErrors };
  hasAttemptedSubmit = false;

  clearError(field: keyof UsageFormErrors): void {
    if (this.formErrors[field]) {
      this.formErrors[field] = null;
    }
  }

  onUsePurposeChange(value: number | null): void {
    this.selectedUsePurposeId = value;
    this.selectedUsePurposeIdChange.emit(value);
    const label = this.resolveUsePurposeLabel(value);
    this.usePurposeChange.emit(label);
    
    this.clearError('usePurpose');
    
    if (this.hasAttemptedSubmit) {
      if (value === null || value === undefined) {
        this.formErrors.usePurpose = 'newIssueRequest.validation.usePurposeRequired';
      } else {
        this.clearError('usePurpose');
      }
    }
  }

  onUsageLocationChange(value: string): void {
    this.usageLocationChange.emit(value);
    
    this.clearError('usageLocation');
    
    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageLocation = 'newIssueRequest.validation.usageLocationRequired';
      } else {
        this.clearError('usageLocation');
      }
    }
  }

  onNumberOfOfficersChange(value: number | null): void {
    this.numberOfOfficersChange.emit(value);
  }

  onNumberOfOtherRanksChange(value: number | null): void {
    this.numberOfOtherRanksChange.emit(value);
  }

  onUsageDateFromChange(value: string): void {
    this.usageDateFromChange.emit(value);
    
    this.clearError('usageDateFrom');
    
    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateRequired';
      } else {
        this.clearError('usageDateFrom');
      }
    }
  }

  onUsageTimeFromChange(value: string): void {
    this.usageTimeFromChange.emit(value);
    
    this.clearError('usageTimeFrom');
    
    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageTimeFrom = 'newIssueRequest.validation.usageTimeRequired';
      } else {
        this.clearError('usageTimeFrom');
      }
    }
  }

  onUsageDateToChange(value: string): void {
    this.usageDateToChange.emit(value);
    
    this.clearError('usageDateTo');
    
    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageDateTo = 'newIssueRequest.validation.usageDateRequired';
      } else {
        this.clearError('usageDateTo');
      }
    }
  }

  onUsageTimeToChange(value: string): void {
    this.usageTimeToChange.emit(value);
    
    this.clearError('usageTimeTo');
    
    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.usageTimeTo = 'newIssueRequest.validation.usageTimeRequired';
      } else {
        this.clearError('usageTimeTo');
      }
    }
  }

  onOrderPriorityChange(value: string): void {
    this.orderPriorityChange.emit(value);
    
    this.clearError('orderPriority');
    
    if (this.hasAttemptedSubmit) {
      if (!value || value.trim().length === 0) {
        this.formErrors.orderPriority = 'newIssueRequest.validation.orderPriorityRequired';
      } else {
        this.clearError('orderPriority');
      }
    }
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

    if (this.selectedUsePurposeId === null || this.selectedUsePurposeId === undefined) {
      this.formErrors.usePurpose = 'newIssueRequest.validation.usePurposeRequired';
      isValid = false;
    }

    if (!this.usageLocation || this.usageLocation.trim().length === 0) {
      this.formErrors.usageLocation = 'newIssueRequest.validation.usageLocationRequired';
      isValid = false;
    }

    if (!this.usageDateFrom || this.usageDateFrom.trim().length === 0) {
      this.formErrors.usageDateFrom = 'newIssueRequest.validation.usageDateRequired';
      isValid = false;
    }

    if (!this.usageTimeFrom || this.usageTimeFrom.trim().length === 0) {
      this.formErrors.usageTimeFrom = 'newIssueRequest.validation.usageTimeRequired';
      isValid = false;
    }

    if (!this.usageDateTo || this.usageDateTo.trim().length === 0) {
      this.formErrors.usageDateTo = 'newIssueRequest.validation.usageDateRequired';
      isValid = false;
    }

    if (!this.usageTimeTo || this.usageTimeTo.trim().length === 0) {
      this.formErrors.usageTimeTo = 'newIssueRequest.validation.usageTimeRequired';
      isValid = false;
    }

    if (!this.orderPriority || this.orderPriority.trim().length === 0) {
      this.formErrors.orderPriority = 'newIssueRequest.validation.orderPriorityRequired';
      isValid = false;
    }

    return isValid;
  }

  private resolveUsePurposeLabel(value: number | null): string {
    if (value === null || value === undefined) {
      return '';
    }
    const match = this.usePurposeOptions.find(option => option.value === value);
    return match?.label ?? '';
  }
}

type UsageFormErrors = {
  usePurpose: string | null;
  usageLocation: string | null;
  usageDateFrom: string | null;
  usageTimeFrom: string | null;
  usageDateTo: string | null;
  usageTimeTo: string | null;
  orderPriority: string | null;
};

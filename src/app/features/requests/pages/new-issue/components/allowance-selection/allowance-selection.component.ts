import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';

/**
 * Allowance Selection Component
 * Step 0 of the new issue request flow
 * Allows user to select whether to order from allowance or all ammunition
 */
@Component({
  selector: 'app-allowance-selection',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent],
  templateUrl: './allowance-selection.component.html',
  styleUrls: ['./allowance-selection.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllowanceSelectionComponent {
  @Input() fromReserve: boolean = true;
  @Output() fromReserveChange = new EventEmitter<boolean>();
  @Output() next = new EventEmitter<void>();

  onFromReserveChange(value: boolean): void {
    this.fromReserveChange.emit(value);
  }

  onNext(): void {
    this.next.emit();
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent],
  templateUrl: './review-form.component.html',
  styleUrls: ['./review-form.component.css']
})
export class ReviewFormComponent {
  @Input() requesterName: string = '';
  @Input() requesterNameReadonly: boolean = false;
  @Input() requesterComments: string = '';
  @Input() orderType: string = '';
  @Input() selectedPriority: string = '';
  @Input() fromReserve: string = '';
  @Input() usePurpose: string = '';
  @Input() usageDate: string = '';

  @Output() requesterNameChange = new EventEmitter<string>();
  @Output() requesterCommentsChange = new EventEmitter<string>();
  @Output() orderTypeChange = new EventEmitter<string>();
  @Output() fromReserveChange = new EventEmitter<string>();
  @Output() usePurposeChange = new EventEmitter<string>();
  @Output() usageDateChange = new EventEmitter<string>();
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  onRequesterNameChange(value: string): void {
    this.requesterNameChange.emit(value);
  }

  onRequesterCommentsChange(value: string): void {
    this.requesterCommentsChange.emit(value);
  }

  onOrderTypeChange(value: string): void {
    this.orderTypeChange.emit(value);
  }

  onFromReserveChange(value: string): void {
    this.fromReserveChange.emit(value);
  }

  onUsePurposeChange(value: string): void {
    this.usePurposeChange.emit(value);
  }

  onUsageDateChange(value: string): void {
    this.usageDateChange.emit(value);
  }

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }
}


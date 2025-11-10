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
  @Input() requesterComments: string = '';
  @Input() orderType: string = '';
  @Input() orderPriority: string = '';
  @Input() fromReserve: string = '';
  @Input() usePurpose: string = '';
  @Input() usageDate: string = '';

  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }
}


import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, HasPermissionDirective],
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
  @Input() usageDateFrom: string = '';
  @Input() usageTimeFrom: string = '';
  @Input() usageDateTo: string = '';
  @Input() usageTimeTo: string = '';

  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }

  getFormattedUsageDateFrom(): string {
    if (!this.usageDateFrom) return '';
    const date = new Date(this.usageDateFrom);
    const dateStr = date.toLocaleDateString('en-GB');
    return this.usageTimeFrom ? `${dateStr} ${this.usageTimeFrom.substring(0, 5)}` : dateStr;
  }

  getFormattedUsageDateTo(): string {
    if (!this.usageDateTo) return '';
    const date = new Date(this.usageDateTo);
    const dateStr = date.toLocaleDateString('en-GB');
    return this.usageTimeTo ? `${dateStr} ${this.usageTimeTo.substring(0, 5)}` : dateStr;
  }
}


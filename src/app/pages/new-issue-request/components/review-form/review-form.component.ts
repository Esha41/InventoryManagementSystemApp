import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { Cartridge } from '../cartridge-list/cartridge-list.component';

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
  @Input() usageLocation: string = '';
  @Input() numberOfOfficers: number | null = null;
  @Input() numberOfOtherRanks: number | null = null;
  @Input() usageDateFrom: string = '';
  @Input() usageTimeFrom: string = '';
  @Input() usageDateTo: string = '';
  @Input() usageTimeTo: string = '';
  @Input() selectedCartridges: Cartridge[] = [];

  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  constructor(private translate: TranslateService) {}

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }

  getTranslatedPriority(): string {
    if (!this.orderPriority) return '';
    // If it's already a translation key, translate it
    if (this.orderPriority.startsWith('newIssueRequest.')) {
      return this.translate.instant(this.orderPriority);
    }
    // Otherwise, try to map the old English values to translation keys
    const priorityMap: { [key: string]: string } = {
      'High Priority': 'newIssueRequest.highPriority',
      'Medium Priority': 'newIssueRequest.mediumPriority',
      'Low Priority': 'newIssueRequest.lowPriority'
    };
    const translationKey = priorityMap[this.orderPriority];
    return translationKey ? this.translate.instant(translationKey) : this.orderPriority;
  }

  getFormattedUsageDateFrom(): string {
    if (!this.usageDateFrom) return '';
    const date = new Date(this.usageDateFrom);
    const dateStr = date.toLocaleDateString('en-GB');
    // Display time in military format (HHMM)
    return this.usageTimeFrom ? `${dateStr} ${this.usageTimeFrom}` : dateStr;
  }

  getFormattedUsageDateTo(): string {
    if (!this.usageDateTo) return '';
    const date = new Date(this.usageDateTo);
    const dateStr = date.toLocaleDateString('en-GB');
    // Display time in military format (HHMM)
    return this.usageTimeTo ? `${dateStr} ${this.usageTimeTo}` : dateStr;
  }
}


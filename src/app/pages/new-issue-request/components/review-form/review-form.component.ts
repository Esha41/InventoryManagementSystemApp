import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { Cartridge } from '../cartridge-list/cartridge-list.component';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { getFileSizeFromFile, viewFile as viewFileUtil } from '@utils/file.utils';
import { formatDateTimeMilitary } from '@utils/format.utils';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, HasPermissionDirective, LucideAngularModule],
  templateUrl: './review-form.component.html',
  styleUrls: ['./review-form.component.css']
})
export class ReviewFormComponent {
  readonly Eye = Eye;
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
  @Input() files: File[] = [];

  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  constructor(public translateService: TranslateService) {}
  
  get currentLang(): string {
    return this.translateService.currentLang || 'en';
  }
  
  get isArabic(): boolean {
    return this.currentLang === 'ar';
  }

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
      return this.translateService.instant(this.orderPriority);
    }
    // Map the actual values to translation keys
    const priorityMap: { [key: string]: string } = {
      'High': 'newIssueRequest.highPriority',
      'Normal': 'newIssueRequest.mediumPriority',
      'Low': 'newIssueRequest.lowPriority',
      'High Priority': 'newIssueRequest.highPriority',
      'Medium Priority': 'newIssueRequest.mediumPriority',
      'Low Priority': 'newIssueRequest.lowPriority'
    };
    const translationKey = priorityMap[this.orderPriority];
    return translationKey ? this.translateService.instant(translationKey) : this.orderPriority;
  }

  getFormattedUsageDateFrom(): string {
    if (!this.usageDateFrom) return '';
    const dateStr = formatDateTimeMilitary(this.usageDateFrom, false);
    
    // Format time - convert HHMM to "HH mm"
    if (this.usageTimeFrom) {
      const timeStr = this.usageTimeFrom.length === 4 && /^\d{4}$/.test(this.usageTimeFrom)
        ? `${this.usageTimeFrom.substring(0, 2)} ${this.usageTimeFrom.substring(2, 4)}`
        : this.usageTimeFrom.includes(':')
        ? this.usageTimeFrom.replace(':', ' ')
        : this.usageTimeFrom;
      return `${dateStr} ${timeStr}`;
    }
    return dateStr;
  }

  getFormattedUsageDateTo(): string {
    if (!this.usageDateTo) return '';
    const dateStr = formatDateTimeMilitary(this.usageDateTo, false);
    
    // Format time - convert HHMM to "HH mm"
    if (this.usageTimeTo) {
      const timeStr = this.usageTimeTo.length === 4 && /^\d{4}$/.test(this.usageTimeTo)
        ? `${this.usageTimeTo.substring(0, 2)} ${this.usageTimeTo.substring(2, 4)}`
        : this.usageTimeTo.includes(':')
        ? this.usageTimeTo.replace(':', ' ')
        : this.usageTimeTo;
      return `${dateStr} ${timeStr}`;
    }
    return dateStr;
  }

  getFileSize = getFileSizeFromFile;
  viewFile = viewFileUtil;
}


import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { Cartridge } from '@models/cartridge.model';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { getFileSizeFromFile, viewFile as viewFileUtil } from '@utils/file.utils';
import { formatDateTimeExtended } from '@utils/format.utils';
import { getOrderPriorityTranslationKeyFromUsageDateYmd } from '@requests/utils/order-priority-from-usage.utils';
import { formatDateForInput } from '@core/utils/format.utils';

@Component({
  selector: 'app-review-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, HasPermissionDirective, LucideAngularModule],
  templateUrl: './review-form.component.html',
  styleUrls: ['./review-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewFormComponent {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Eye = Eye;
  @Input() requesterName: string = '';
  @Input() requesterComments: string = '';
  @Input() orderType: string = '';
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

  constructor(public translateService: TranslateService) { }

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
    const ymd = formatDateForInput(this.usageDateFrom) || this.usageDateFrom;
    const key = getOrderPriorityTranslationKeyFromUsageDateYmd(ymd);
    return this.translateService.instant(key);
  }


  getFormattedUsageDateFrom(): string {
    return formatDateTimeExtended(this.usageDateFrom, this.usageTimeFrom);
  }

  getFormattedUsageDateTo(): string {
    return formatDateTimeExtended(this.usageDateTo, this.usageTimeTo);
  }

  getFileSize = getFileSizeFromFile;
  viewFile = viewFileUtil;
}


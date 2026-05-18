import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '@models/cartridge.model';
import { ReturnItemType } from '../../return-request.state';

@Component({
  selector: 'app-return-review-step',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent],
  templateUrl: './return-review-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnReviewStepComponent {
  constructor(private readonly translate: TranslateService) {}

  get isArabic(): boolean {
    return (this.translate.currentLang || 'en') === 'ar';
  }

  @Input() selectedItemType: ReturnItemType = 'Ammunition';
  @Input() requesterName = '';
  @Input() requesterDepartment = '';
  @Input() reason = '';
  @Input() priority = 1;
  @Input() requestPurposeName = '';
  @Input() requestPurposeNotes = '';
  @Input() selectedFiles: File[] = [];
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() getPriorityLabel!: (priority: number) => string;
  @Input() isLoading = false;

  @Output() previous = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();
}

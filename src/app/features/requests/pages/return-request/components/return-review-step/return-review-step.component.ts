import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { Cartridge } from '@models/cartridge.model';
import {
  AttachmentRequirementDto,
  AttachmentUploadsState,
  createInitialAttachmentUploadsState,
  ReturnItemType
} from '../../return-request.state';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { viewFile as viewFileUtil } from '@utils/file.utils';

@Component({
  selector: 'app-return-review-step',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, LucideAngularModule],
  templateUrl: './return-review-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnReviewStepComponent {
  constructor(private readonly translate: TranslateService) {}

  readonly Eye = Eye;

  get isArabic(): boolean {
    return (this.translate.currentLang || 'en') === 'ar';
  }

  @Input() selectedItemType: ReturnItemType = 'Ammunition';
  @Input() reason = '';
  @Input() priority = 1;
  @Input() requestPurposeName = '';
  @Input() requestPurposeNotes = '';
  @Input() notes = '';
  @Input() selectedFiles: File[] = [];
  @Input() attachmentRequirements: AttachmentRequirementDto[] = [];
  @Input() attachmentUploads: AttachmentUploadsState = createInitialAttachmentUploadsState();
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() getPriorityLabel!: (priority: number) => string;
  @Input() isLoading = false;

  @Output() previous = new EventEmitter<void>();
  @Output() submit = new EventEmitter<void>();

  trackRequirementById = (_: number, req: AttachmentRequirementDto): number => req.id;

  get hasAttachmentRequirementSlots(): boolean {
    return (this.attachmentRequirements?.length ?? 0) > 0;
  }

  getRequirementLabel(req: AttachmentRequirementDto): string {
    if (this.isArabic) {
      return req.nameAr || req.nameEn || '';
    }
    return req.nameEn || req.nameAr || '';
  }

  getFilesForRequirement(requirementId: number): File[] {
    return this.attachmentUploads?.filesByRequirementId?.get(requirementId) ?? [];
  }

  /** Mirrors new-issue review: optional state bucket + legacy flat list (`selectedFiles`). */
  get reviewBucketFiles(): File[] {
    const legacy = this.selectedFiles ?? [];
    if (!this.hasAttachmentRequirementSlots) {
      return legacy;
    }
    const fromState = this.attachmentUploads?.otherFiles ?? [];
    return [...fromState, ...legacy];
  }

  viewFile = viewFileUtil;
}

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { Cartridge } from '@models/cartridge.model';
import type { WeaponAssociation } from '@models/request-item.model';
import {
  AttachmentRequirementDto,
  AttachmentUploadsState,
  createInitialAttachmentUploadsState
} from '../../new-issue-request.state';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { getFileSizeFromFile, viewFile as viewFileUtil } from '@utils/file.utils';
import { formatDateTimeExtended } from '@utils/format.utils';

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

  private readonly cdr = inject(ChangeDetectorRef);

  readonly Eye = Eye;
  @Input() requesterName: string = '';
  @Input() requesterDepartment = '';
  @Input() fromReserve: string = '';
  @Input() usePurpose: string = '';
  @Input() requestPurposeNotes: string = '';
  @Input() usageLocation: string = '';
  @Input() numberOfOfficers: number | null = null;
  @Input() numberOfOtherRanks: number | null = null;
  @Input() usageDateFrom: string = '';
  @Input() usageTimeFrom: string = '';
  @Input() usageDateTo: string = '';
  @Input() usageTimeTo: string = '';
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() weaponAssociations: Map<number, WeaponAssociation[]> = new Map();
  /** Legacy / “other” bucket files from the usage step (`usageFormFiles`). */
  @Input() files: File[] = [];
  @Input() attachmentRequirements: AttachmentRequirementDto[] = [];
  @Input() attachmentUploads: AttachmentUploadsState = createInitialAttachmentUploadsState();

  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  constructor(public translateService: TranslateService) {
    this.translateService.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }

  get currentLang(): string {
    return this.translateService.currentLang || 'en';
  }

  get isArabic(): boolean {
    return this.currentLang === 'ar';
  }

  get hasAttachmentRequirementSlots(): boolean {
    return (this.attachmentRequirements?.length ?? 0) > 0;
  }

  trackRequirementById = (_: number, req: AttachmentRequirementDto): number => req.id;

  getRequirementLabel(req: AttachmentRequirementDto): string {
    if (this.isArabic) {
      return req.nameAr || req.nameEn || '';
    }
    return req.nameEn || req.nameAr || '';
  }

  getFilesForRequirement(requirementId: number): File[] {
    return this.attachmentUploads?.filesByRequirementId?.get(requirementId) ?? [];
  }

  /**
   * Files shown next to “Other Attachments”: optional bucket + legacy picker list,
   * mirroring `IssueRequestFacade.buildSubmissionContext`.
   */
  get reviewBucketFiles(): File[] {
    const legacy = this.files ?? [];
    if (!this.hasAttachmentRequirementSlots) {
      return legacy;
    }
    const fromState = this.attachmentUploads?.otherFiles ?? [];
    return [...fromState, ...legacy];
  }

  getWeaponLabel(cartridge: Cartridge): string {
    const list = this.weaponAssociations.get(cartridge.id);
    if (!list?.length) return '—';
    return list
      .map(a => {
        if (a.type === 'catalog') return a.weaponName ?? `Catalog #${a.weaponItemId}`;
        if (a.type === 'other') return `${a.otherName} (Custom)`;
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
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


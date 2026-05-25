import {

  Component,

  Input,

  OnInit,

  OnChanges,

  OnDestroy,

  SimpleChanges,

  ChangeDetectionStrategy,

  ChangeDetectorRef

} from '@angular/core';

import { CommonModule } from '@angular/common';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Subject, takeUntil } from 'rxjs';

import { getCurrentLang, getLocalizedName } from '@core/utils/localization.utils';

import { Download, FileText, LucideAngularModule, Package, Paperclip } from 'lucide-angular';

import { SupplyService, WorkflowSupplySummaryDto } from '@requests/services/supply.service';

import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';

import { ErrorHandler } from '@utils/error-handler.utils';

import { TableClampTooltipDirective } from '@components/table-clamp-tooltip/table-clamp-tooltip.directive';

import { groupAmmoSupplyLines, type AmmoSupplyLineGroup } from '../../../utils/ammo-supply-line-groups.util';

import { FileUploadDto, isOrderReceiverSignatureFile } from '@models/file-upload.model';

import { FileUploadService } from '@services/file-upload.service';

import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';



@Component({

  selector: 'app-workflow-supply-summary',

  standalone: true,

  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe, TableClampTooltipDirective],

  templateUrl: './workflow-supply-summary.component.html',

  styleUrls: ['./workflow-supply-summary.component.css'],

  changeDetection: ChangeDetectionStrategy.OnPush

})

export class WorkflowSupplySummaryComponent implements OnInit, OnChanges, OnDestroy {

  readonly Package = Package;

  readonly Download = Download;

  readonly FileText = FileText;

  readonly Paperclip = Paperclip;



  @Input({ required: true }) orderId!: number;

  @Input({ required: true }) destroy$!: Subject<void>;

  /** Parent increments this after supply/pickup updates so the summary reloads without leaving the page. */

  @Input() refreshTick = 0;



  loading = true;

  error: string | null = null;

  summary: WorkflowSupplySummaryDto | null = null;

  /** Ammunition / explosives lines grouped by `itemId` (set when summary loads). */

  ammoGroups: AmmoSupplyLineGroup[] = [];

  /** Blob preview URLs for receiver signature images (completed orders). */

  signaturePreviewUrls = new Map<number, string>();



  constructor(

    private supplyService: SupplyService,

    private fileUploadService: FileUploadService,

    private supplyServiceHelper: WorkflowApprovalSupplyService,

    private cdr: ChangeDetectorRef,

    private translate: TranslateService

  ) {}



  ngOnInit(): void {

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());

    this.loadSummary();

  }



  ngOnChanges(changes: SimpleChanges): void {

    if (changes['orderId'] && !changes['orderId'].firstChange) {

      this.loadSummary();

      return;

    }

    if (changes['refreshTick'] && !changes['refreshTick'].firstChange) {

      this.loadSummary();

    }

  }



  ngOnDestroy(): void {

    this.clearSignaturePreviews();

  }



  private loadSummary(): void {

    this.loading = true;

    this.error = null;

    this.ammoGroups = [];

    this.clearSignaturePreviews();

    this.cdr.markForCheck();



    this.supplyService.getWorkflowSupplySummary(this.orderId)

      .pipe(takeUntil(this.destroy$))

      .subscribe({

        next: (data) => {

          this.summary = data;

          this.ammoGroups = groupAmmoSupplyLines(data.lines ?? []);

          this.loading = false;

          this.error = null;

          if (data.isOrderCompleted) {

            this.loadSignaturePreviews(this.signatureFiles(data));

          }

          this.cdr.markForCheck();

        },

        error: (err) => {

          this.error = ErrorHandler.extractErrorMessage(err, 'workflowApprovalDetail.workflowSupplySummary.loadError');

          this.loading = false;

          this.summary = null;

          this.ammoGroups = [];

          this.cdr.markForCheck();

        }

      });

  }



  private clearSignaturePreviews(): void {

    for (const url of this.signaturePreviewUrls.values()) {

      URL.revokeObjectURL(url);

    }

    this.signaturePreviewUrls.clear();

  }



  private loadSignaturePreviews(files: FileUploadDto[]): void {

    for (const file of files) {

      this.fileUploadService.getFileBlob(file.id)

        .pipe(takeUntil(this.destroy$))

        .subscribe({

          next: (blob) => {

            this.signaturePreviewUrls.set(file.id, URL.createObjectURL(blob));

            this.cdr.markForCheck();

          }

        });

    }

  }



  isOrderCompleted(): boolean {

    return this.summary?.isOrderCompleted === true;

  }



  showReceiverSection(): boolean {

    return !!(

      this.summary?.receiverName ||

      this.summary?.receiverRankName ||

      this.summary?.receiverMilitaryId ||

      (this.isOrderCompleted() && this.signatureFiles().length > 0)

    );

  }



  signatureFiles(summary: WorkflowSupplySummaryDto | null = this.summary): FileUploadDto[] {

    return (summary?.files ?? []).filter(isOrderReceiverSignatureFile);

  }



  attachmentFiles(): FileUploadDto[] {

    return (this.summary?.files ?? []).filter(f => !isOrderReceiverSignatureFile(f));

  }



  notesLabelKey(): string {

    return this.isOrderCompleted()

      ? 'workflowApprovalDetail.workflowSupplySummary.notes'

      : 'workflowApprovalDetail.workflowSupplySummary.supplyNotes';

  }



  downloadFile(file: FileUploadDto): void {

    const fileName = file.originalName || file.fileName;

    this.supplyServiceHelper.downloadFile(file.id, fileName, this.destroy$)

      .pipe(takeUntil(this.destroy$))

      .subscribe({

        next: (blob) => {

          const url = URL.createObjectURL(blob);

          const anchor = document.createElement('a');

          anchor.href = url;

          anchor.download = fileName;

          anchor.click();

          URL.revokeObjectURL(url);

        }

      });

  }



  showProvisionalBanner(): boolean {

    return !!this.summary && this.summary.isOrderCompleted === false;

  }



  showSupplyDateRow(): boolean {

    return !!this.summary?.supplyDate && this.summary.isOrderCompleted === true;

  }



  showFulfillmentStatusRow(): boolean {

    return this.isOrderCompleted() && (this.summary?.fulfillmentStatus ?? 0) > 0;

  }



  isSelectionPhase(): boolean {

    return this.summary?.phase === 'Selection';

  }



  isSuppliedPhase(): boolean {

    return this.summary?.phase === 'Supplied';

  }



  isAmmoPhase(): boolean {

    return !this.summary?.isWeaponOrder || this.summary?.phase === 'None' || !this.summary?.phase;

  }



  hasWeaponSelectionLines(): boolean {

    return !!this.summary?.selectionLines?.length;

  }



  hasWeaponSuppliedLines(): boolean {

    return !!this.summary?.weaponLines?.length;

  }



  fulfillmentLabelKey(status: number): string {

    if (status === 2) {

      return 'workflowApprovalDetail.workflowSupplySummary.fulfillmentFull';

    }

    return 'workflowApprovalDetail.workflowSupplySummary.fulfillmentPartial';

  }



  suppliedColumnKey(): string {

    return this.summary?.isOrderCompleted

      ? 'workflowApprovalDetail.workflowSupplySummary.colSupplied'

      : 'workflowApprovalDetail.workflowSupplySummary.colShouldBeSupplied';

  }



  depotDisplay(line: {

    depotName?: string | null;

    depotNameEn?: string | null;

    depotNameAr?: string | null;

    depotCode?: string | null;

  }): string {

    const name = getLocalizedName(

      {

        nameEn: line.depotNameEn ?? line.depotName ?? undefined,

        nameAr: line.depotNameAr ?? undefined

      },

      getCurrentLang(this.translate)

    ).trim();

    const code = (line.depotCode || '').trim();

    if (name && code) {

      return `${name} (${code})`;

    }

    return name || code || '—';

  }

}



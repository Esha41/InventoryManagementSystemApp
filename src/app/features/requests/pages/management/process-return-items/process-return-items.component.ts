import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, ArrowLeft, ArrowRight, Package, Trash2, Paperclip, ChevronDown, ChevronRight } from 'lucide-angular';
import { ReturnService, ProcessReturnItemsDto } from '@services/return.service';
import { FileUploadService, FileUploadDto, FileEntityType } from '@services/file-upload.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { validateFile, showFileValidationErrors, getFileSizeFromFile, MAX_FILE_SIZE_MB } from '@utils/file.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

interface AmmoExplosiveRow {
  itemId: number;
  itemName: string;
  /** Quantity in the return request (read-only in UI). */
  returnedQuantity: number | null;
  /** Quantity actually received / posted to inventory (editable). */
  receivedQuantity: number | null;
  lot: string;
}

/** One weapon line on the return: summary fields + one row per received unit. */
interface WeaponLine {
  itemId: number;
  itemName: string;
  returnedQuantity: number;
  /** How many units were actually received (drives number of serial/batch rows). */
  receivedQuantity: number | null;
  /** Line-level batch: used as default for newly added unit rows when received qty increases. */
  lineBatch: string;
  units: { serialNumber: string; batchNumber: string }[];
}

@Component({
  selector: 'app-process-return-items',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './process-return-items.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessReturnItemsComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly Package = Package;
  readonly Trash2 = Trash2;
  readonly Paperclip = Paperclip;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;

  private destroy$ = new Subject<void>();

  /** Index in {@link weaponLines} of the row expanded for serial/batch entry; null if none. */
  expandedWeaponLineIndex: number | null = null;

  requestId = 0;
  loading = true;
  error: string | null = null;
  processing = false;
  requestNo = '';
  /** Localized return depot (backend uses one depot for all ammo lines). */
  returnDepotDisplayName = '';

  ammoExplosiveRows: AmmoExplosiveRow[] = [];
  weaponLines: WeaponLine[] = [];

  /** New files to upload with submit (optional). */
  attachmentFiles: File[] = [];
  /** Files already linked to this return (same entity as order on create). */
  existingFiles: FileUploadDto[] = [];

  MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;

  // Raw request items for reference
  requestItems: any[] = [];

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  get hasAmmoExplosiveItems(): boolean {
    return this.requestItems.some(i => i.itemType === 1 || i.itemType === 3 || i.itemType === 'Ammunition' || i.itemType === 'Explosive');
  }

  get hasWeaponItems(): boolean {
    return this.requestItems.some(i => i.itemType === 2 || i.itemType === 'Weapon');
  }

  get canSubmit(): boolean {
    const hasAmmoData = this.ammoExplosiveRows.length > 0 &&
      this.ammoExplosiveRows.every(r =>
        r.itemId && r.receivedQuantity != null && r.receivedQuantity > 0 && r.lot?.trim());
    const hasWeaponData = this.weaponLines.length > 0 &&
      this.weaponLines.every(line =>
        line.itemId &&
        line.receivedQuantity != null &&
        line.receivedQuantity >= 1 &&
        line.receivedQuantity <= line.returnedQuantity &&
        line.units.length === line.receivedQuantity &&
        line.units.every(u => u.serialNumber?.trim() && u.batchNumber?.trim())
      );
    return hasAmmoData || hasWeaponData;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private returnService: ReturnService,
    private fileUploadService: FileUploadService,
    private toastService: ToastService,
    private translateService: TranslateService,
    public translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = parseInt(this.route.snapshot.params['id'], 10);
    if (isNaN(id)) {
      this.error = 'Invalid request ID';
      this.loading = false;
      return;
    }
    this.requestId = id;
    this.loadReturnData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadReturnData(): void {
    this.returnService.getReturnById(this.requestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (returnData: any) => {
          this.requestNo = returnData.requestNo || '';
          this.requestItems = returnData.requestItems || [];
          this.returnDepotDisplayName = this.resolveReturnDepotName(returnData);
          this.initializeRows();
          this.loading = false;
          this.cdr.markForCheck();
          this.loadExistingAttachments();
        },
        error: (err) => {
          this.error = ErrorHandler.extractErrorMessage(err, 'Failed to load return request');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** Return files use Order + entity id (same as create-return flow). */
  private loadExistingAttachments(): void {
    this.fileUploadService.getFilesByEntity(FileEntityType.Order, this.requestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (files) => {
          this.existingFiles = files ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.existingFiles = [];
          this.cdr.markForCheck();
        }
      });
  }

  onAttachmentInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    if (!list?.length) return;

    const invalidErrors: string[] = [];
    const added: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const validation = validateFile(file);
      if (!validation.isValid) {
        invalidErrors.push(validation.errorMessage);
      } else {
        added.push(file);
      }
    }
    if (invalidErrors.length > 0) {
      showFileValidationErrors(this.translateService, this.toastService, invalidErrors, 'workflowApprovalDetail');
      input.value = '';
      return;
    }
    this.attachmentFiles = [...this.attachmentFiles, ...added];
    input.value = '';
    this.cdr.markForCheck();
  }

  removeAttachmentAt(index: number): void {
    this.attachmentFiles.splice(index, 1);
    this.cdr.markForCheck();
  }

  getFileSize(file: File): string {
    return getFileSizeFromFile(file);
  }

  getAttachmentDownloadUrl(file: FileUploadDto): string {
    return this.fileUploadService.getFileDownloadUrl(file.id);
  }

  private resolveReturnDepotName(returnData: any): string {
    const depot = returnData?.returnToDepot;
    if (!depot) return '';
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(depot, lang) || depot.nameEn || depot.nameAr || depot.code || '';
  }

  private initializeRows(): void {
    this.ammoExplosiveRows = [];
    this.weaponLines = [];

    for (const item of this.requestItems) {
      const type = item.itemType;
      const isAmmoOrExplosive = type === 1 || type === 3 || type === 'Ammunition' || type === 'Explosive';
      const isWeapon = type === 2 || type === 'Weapon';
      const itemName = item.itemName || item.name || 'Unknown Item';
      const itemId = item.itemId || item.id;
      const requested = item.quantity != null ? Number(item.quantity) : null;

      if (isAmmoOrExplosive) {
        const reqOk = requested != null && !isNaN(requested);
        this.ammoExplosiveRows.push({
          itemId,
          itemName,
          returnedQuantity: reqOk ? requested : null,
          receivedQuantity: reqOk ? requested : null,
          lot: ''
        });
      } else if (isWeapon) {
        const returned = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const line: WeaponLine = {
          itemId,
          itemName,
          returnedQuantity: returned,
          receivedQuantity: returned,
          lineBatch: '',
          units: []
        };
        this.syncUnitsFromReceived(line);
        this.weaponLines.push(line);
      }
    }
    this.expandedWeaponLineIndex = null;
  }

  /**
   * Keep {@link WeaponLine.units} length equal to {@link WeaponLine.receivedQuantity}.
   * New slots copy the current line-level batch string.
   */
  syncUnitsFromReceived(line: WeaponLine): void {
    const n = line.receivedQuantity != null && !isNaN(Number(line.receivedQuantity))
      ? Math.floor(Number(line.receivedQuantity))
      : 0;
    const capped = Math.min(Math.max(n, 0), line.returnedQuantity);
    const defaultBatch = line.lineBatch ?? '';

    while (line.units.length < capped) {
      line.units.push({ serialNumber: '', batchNumber: defaultBatch });
    }
    if (line.units.length > capped) {
      line.units = line.units.slice(0, capped);
    }
  }

  isWeaponLineExpanded(index: number): boolean {
    return this.expandedWeaponLineIndex === index;
  }

  toggleWeaponLine(index: number): void {
    this.expandedWeaponLineIndex = this.expandedWeaponLineIndex === index ? null : index;
    this.cdr.markForCheck();
  }

  onWeaponMasterRowClick(index: number, event: Event): void {
    const el = event.target as HTMLElement | null;
    if (el?.closest('input, button, select, textarea, a, label')) {
      return;
    }
    this.toggleWeaponLine(index);
  }

  onWeaponReceivedQtyChange(line: WeaponLine, raw: number | string | null): void {
    let n = raw === '' || raw == null ? NaN : Number(raw);
    if (isNaN(n) || n < 1) {
      n = 1;
    }
    if (n > line.returnedQuantity) {
      n = line.returnedQuantity;
    }
    line.receivedQuantity = Math.floor(n);
    this.syncUnitsFromReceived(line);
    this.cdr.markForCheck();
  }

  /** When the line default batch changes, push the same value to every unit row for that line. */
  onWeaponLineBatchChange(line: WeaponLine, value: string | null): void {
    const v = value ?? '';
    line.lineBatch = v;
    for (const u of line.units) {
      u.batchNumber = v;
    }
    this.cdr.markForCheck();
  }

  goBack(): void {
    this.router.navigate(['/requests-management', this.requestId, 'workflow-approval']);
  }

  submit(): void {
    if (this.processing || !this.canSubmit) return;

    this.processing = true;

    const dto: ProcessReturnItemsDto = {
      ammoExplosiveItems: this.ammoExplosiveRows
        .filter(r => r.itemId && r.receivedQuantity != null && r.receivedQuantity > 0 && r.lot?.trim())
        .map(r => ({
          itemId: r.itemId,
          quantity: r.receivedQuantity!,
          lot: r.lot.trim()
        })),
      weaponItems: this.weaponLines.flatMap(line =>
        line.units
          .filter(u => u.serialNumber?.trim() && u.batchNumber?.trim())
          .map(u => ({
            itemId: line.itemId,
            serialNumber: u.serialNumber.trim(),
            batchNumber: u.batchNumber.trim()
          }))
      )
    };

    const filesToSend = this.attachmentFiles.length > 0 ? this.attachmentFiles : undefined;

    this.returnService.processReturnItems(this.requestId, dto, filesToSend)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processing = false;
          this.translateService.get(['toast.success', 'processReturnItems.success'])
            .pipe(takeUntil(this.destroy$))
            .subscribe(t => {
              this.toastService.success(
                t['processReturnItems.success'] || 'Request reviewed and completed successfully.',
                t['toast.success'] || 'Success'
              );
            });
          this.router.navigate(['/requests-management', this.requestId, 'workflow-approval']);
        },
        error: (error) => {
          this.processing = false;
          const msg = ErrorHandler.extractErrorMessage(error, 'Failed to review return items');
          this.translateService.get('toast.error')
            .pipe(takeUntil(this.destroy$))
            .subscribe(title => {
              this.toastService.error(msg, title);
            });
          this.cdr.markForCheck();
        }
      });
  }
}

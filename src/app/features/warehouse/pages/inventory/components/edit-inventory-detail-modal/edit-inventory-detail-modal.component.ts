import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, InventoryDto, UpdateInventoryDto, ItemType } from '@models/inventory.model';
import { LookupService, LookupItem } from '@services/lookup.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateShort } from '@core/utils/format.utils';
import { FileUploadDto, FileUploadService } from '@services/file-upload.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ToastService } from '@services/toast.service';
import { validateAttachments, showAttachmentValidationToast } from '@utils/file.utils';

@Component({
  selector: 'app-edit-inventory-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    TranslateModule,
    DropdownComponent
  ],
  templateUrl: './edit-inventory-detail-modal.component.html',
  styleUrls: ['./edit-inventory-detail-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditInventoryDetailModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() inventoryDetail?: InventoryDetailDto;
  @Input() inventory?: InventoryDto;
  @Input() inventoryId!: number;
  @ViewChild('invEditFileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto; files?: File[]; removedFileIds?: number[] }>();

  detailForm!: FormGroup;
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  countries: LookupItem[] = [];
  /** From GET /Ammunition/:id or GET /Explosive/:id when inventory payload omits `item.primaryPurposes`. */
  catalogItemPrimaryPurposes: Array<{ id: number; nameAr: string; nameEn: string }> = [];
  private catalogPurposesSub?: Subscription;
  isLoading = false;
  errorMessage = '';
  showInvoiceChangeConfirmation = false;
  pendingSubmitData: { detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto } | null = null;
  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) => this.getLookupName(this.unwrapLookupOption(option));
  selectedFiles: File[] = [];
  existingFiles: FileUploadDto[] = [];
  /** Existing uploaded file ids the user removed in UI; deleted on Save by backend. */
  removedExistingFileIds: number[] = [];

  private readonly destroy$ = new Subject<void>();

  readonly readyForIssueOptions: DropdownOption<boolean>[] = [
    { label: 'editInventoryDetail.readyForIssueYes', value: true },
    { label: 'editInventoryDetail.readyForIssueNo', value: false }
  ];

  readonly primaryPurposeOptionLabel = (
    option: DropdownOption<{ id: number; nameAr: string; nameEn: string }> | { id: number; nameAr: string; nameEn: string } | null
  ) => {
    const o = this.unwrapPrimaryPurposeOption(option);
    return o ? getLocalizedName(o, getCurrentLang(this.translateService)) : '';
  };

  constructor(
    private fb: FormBuilder,
    private lookupService: LookupService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef,
    private fileUploadService: FileUploadService,
    private ammunitionService: AmmunitionService,
    private explosiveService: ExplosiveService,
    private toastService: ToastService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadLookupData();
  }

  ngOnDestroy(): void {
    this.catalogPurposesSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (changes['isOpen'].currentValue) {
        // Modal opened: reset form state and clear any unsaved file selections
        this.initializeForm();
        this.errorMessage = '';
        this.selectedFiles = [];
        this.removedExistingFileIds = [];
        this.resetFileInput();
        // Also ensure existing files are shown even if inputs update order differs
        this.loadFormData();
        this.loadExistingFiles();
      } else {
        // Modal closed: ensure selected files are cleared
        this.selectedFiles = [];
        this.removedExistingFileIds = [];
        this.resetFileInput();
        this.clearCatalogPrimaryPurposesState();
      }
    }
    if ((changes['inventoryDetail'] && this.inventoryDetail) || (changes['inventory'] && this.inventory)) {
      // Switching items while modal is open: clear any unsaved selections
      this.selectedFiles = [];
      this.removedExistingFileIds = [];
      this.resetFileInput();
      this.loadFormData();
      this.loadExistingFiles();
    }
    if (this.isOpen && this.inventoryDetail) {
      this.loadCatalogPrimaryPurposesIfNeeded();
    }
  }

  private clearCatalogPrimaryPurposesState(): void {
    this.catalogPurposesSub?.unsubscribe();
    this.catalogPurposesSub = undefined;
    this.catalogItemPrimaryPurposes = [];
  }

  /**
   * Same resolution as add-inventory: prefer `primaryPurposes`, else legacy `primaryPurpos`.
   */
  private primaryPurposesFromCatalogRow(
    selected: { primaryPurposes?: Array<{ id: number; nameAr: string; nameEn: string }>; primaryPurpos?: { id: number; nameAr: string; nameEn: string } } | null | undefined
  ): Array<{ id: number; nameAr: string; nameEn: string }> {
    if (!selected) {
      return [];
    }
    const list = selected.primaryPurposes ?? [];
    if (list.length > 0) {
      return list;
    }
    if (selected.primaryPurpos?.id != null) {
      return [selected.primaryPurpos];
    }
    return [];
  }

  /**
   * Loads item-scoped purposes from catalog API when inventory line does not include them inline.
   */
  private loadCatalogPrimaryPurposesIfNeeded(): void {
    this.catalogPurposesSub?.unsubscribe();
    this.catalogPurposesSub = undefined;
    this.catalogItemPrimaryPurposes = [];

    const detail = this.inventoryDetail;
    if (!detail?.item || !detail.itemId) {
      this.cdr.markForCheck();
      return;
    }

    const item = detail.item;
    const t = this.normalizeItemType(item.itemType);
    if (t !== ItemType.Ammunition && t !== ItemType.Explosive) {
      this.cdr.markForCheck();
      return;
    }

    if ((item.primaryPurposes?.length ?? 0) > 0) {
      this.cdr.markForCheck();
      return;
    }
    if (detail.primaryPurpos?.id != null) {
      this.cdr.markForCheck();
      return;
    }

    const onRow = (row: { primaryPurposes?: Array<{ id: number; nameAr: string; nameEn: string }>; primaryPurpos?: { id: number; nameAr: string; nameEn: string } }) => {
      this.catalogItemPrimaryPurposes = this.primaryPurposesFromCatalogRow(row);
      this.cdr.markForCheck();
    };
    const onErr = () => {
      this.catalogItemPrimaryPurposes = [];
      this.cdr.markForCheck();
    };

    if (t === ItemType.Ammunition) {
      this.catalogPurposesSub = this.ammunitionService.getById(detail.itemId).subscribe({ next: onRow, error: onErr });
    } else {
      this.catalogPurposesSub = this.explosiveService.getById(detail.itemId).subscribe({ next: onRow, error: onErr });
    }
  }

  private coerceToNumber(value: unknown, fallback: number): number {
    if (value === null || value === undefined) return fallback;
    const n = Number(value);
    return !isNaN(n) && n > 0 ? n : fallback;
  }

  private coerceLotString(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private coerceReadyForIssue(value: unknown): boolean {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return true;
  }

  /** Normalize optional ID: null, undefined, 0, or empty string become null for dropdowns */
  private normalizeOptionalId(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return !isNaN(n) && n > 0 ? n : null;
  }

  /**
   * API may send itemType as number, string ("1"), or enum name — align with warehouse filter behavior.
   */
  private normalizeItemType(itemType: ItemType | string | number | undefined | null): number | undefined {
    if (itemType === undefined || itemType === null) {
      return undefined;
    }
    if (typeof itemType === 'number') {
      return itemType;
    }
    if (typeof itemType === 'string') {
      const enumMap: Record<string, number> = {
        Ammunition: ItemType.Ammunition,
        Weapon: ItemType.Weapon,
        Explosive: ItemType.Explosive
      };
      if (enumMap[itemType] !== undefined) {
        return enumMap[itemType];
      }
      const parsed = parseInt(itemType, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return Number(itemType);
  }

  private initializeForm(): void {
    const lot = this.coerceLotString(this.inventoryDetail?.lot);
    const originalQuantity = this.coerceToNumber(this.inventoryDetail?.originalQuantity, 1000);
    this.detailForm = this.fb.group({
      // Inventory Detail fields
      lot: [lot, [Validators.required, Validators.maxLength(64)]],
      originalQuantity: [originalQuantity, [Validators.required, Validators.min(1)]],
      batchNo: [this.inventoryDetail?.batchNo || ''],
      expiryDate: [this.formatDateForDisplay(this.inventoryDetail?.expiryDate)],
      readyForIssue: [this.inventoryDetail?.readyForIssue ?? true],
      supplierId: [this.normalizeOptionalId(this.inventoryDetail?.supplierId)],
      manufacturerId: [this.normalizeOptionalId(this.inventoryDetail?.manufacturerId)],
      countryId: [this.normalizeOptionalId(this.inventoryDetail?.countryId)],
      primaryPurposId: [this.normalizeOptionalId(this.inventoryDetail?.primaryPurposId)],
      // Invoice Information fields
      deliveryReceipt: [this.inventory?.deliveryReceipt || this.inventoryDetail?.deliveryReceipt || ''],
      invoiceNumber: [this.inventoryDetail?.invoiceNumber || this.inventory?.invoiceNumber || ''],
      invoiceDate: [this.formatDateForDisplay(this.inventoryDetail?.invoiceDate || this.inventory?.invoiceDate)],
      recievedDate: [this.formatDateForDisplay(this.inventoryDetail?.recievedDate || this.inventory?.recievedDate)],
      contractNumber: [this.inventoryDetail?.contractNumber || this.inventory?.contractNumber || ''],
      notes: [this.inventoryDetail?.notes || this.inventory?.notes || '']
    });
  }

  private loadFormData(): void {
    if (this.inventoryDetail || this.inventory) {
      const lot = this.inventoryDetail?.lot;
      const originalQuantity = this.inventoryDetail?.originalQuantity;
      this.detailForm.patchValue({
        lot: this.coerceLotString(lot),
        originalQuantity: this.coerceToNumber(originalQuantity, 1000),
        batchNo: this.inventoryDetail?.batchNo || '',
        expiryDate: this.formatDateForDisplay(this.inventoryDetail?.expiryDate),
        readyForIssue: this.inventoryDetail?.readyForIssue ?? true,
        supplierId: this.normalizeOptionalId(this.inventoryDetail?.supplierId),
        manufacturerId: this.normalizeOptionalId(this.inventoryDetail?.manufacturerId),
        countryId: this.normalizeOptionalId(this.inventoryDetail?.countryId),
        primaryPurposId: this.normalizeOptionalId(this.inventoryDetail?.primaryPurposId),
        // Invoice Information
        deliveryReceipt: this.inventory?.deliveryReceipt || this.inventoryDetail?.deliveryReceipt || '',
        invoiceNumber: this.inventoryDetail?.invoiceNumber || this.inventory?.invoiceNumber || '',
        invoiceDate: this.formatDateForDisplay(this.inventoryDetail?.invoiceDate || this.inventory?.invoiceDate),
        recievedDate: this.formatDateForDisplay(this.inventoryDetail?.recievedDate || this.inventory?.recievedDate),
        contractNumber: this.inventoryDetail?.contractNumber || this.inventory?.contractNumber || '',
        notes: this.inventoryDetail?.notes || this.inventory?.notes || ''
      });
    }
  }

  /**
   * Item-scoped only: embedded inventory `item.primaryPurposes`, line `primaryPurpos`, or catalog GET by itemId.
   */
  getPrimaryPurposeOptions(): Array<{ id: number; nameAr: string; nameEn: string }> {
    const item = this.inventoryDetail?.item;
    if (!item) {
      return [];
    }
    const list = item.primaryPurposes ?? [];
    if (list.length > 0) {
      return list;
    }
    if (this.inventoryDetail?.primaryPurpos?.id != null) {
      return [this.inventoryDetail.primaryPurpos];
    }
    const t = this.normalizeItemType(item.itemType);
    if (t === ItemType.Ammunition || t === ItemType.Explosive) {
      return this.catalogItemPrimaryPurposes;
    }
    return [];
  }

  get showPrimaryPurposeSection(): boolean {
    const item = this.inventoryDetail?.item;
    if (!item) {
      return false;
    }
    const t = this.normalizeItemType(item.itemType);
    if (t !== ItemType.Ammunition && t !== ItemType.Explosive) {
      return false;
    }
    return this.getPrimaryPurposeOptions().length > 0;
  }

  private unwrapPrimaryPurposeOption(
    option: DropdownOption<{ id: number; nameAr: string; nameEn: string }> | { id: number; nameAr: string; nameEn: string } | null
  ): { id: number; nameAr: string; nameEn: string } | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && 'value' in option) {
      return option.value as { id: number; nameAr: string; nameEn: string };
    }
    return option as { id: number; nameAr: string; nameEn: string };
  }

  private loadLookupData(): void {
    this.lookupService.getSuppliers().subscribe({
      next: (data: LookupItem[]) => {
        this.suppliers = data;
        this.cdr.markForCheck();
      },
      error: () => { this.cdr.markForCheck(); }
    });

    this.lookupService.getManufacturers().subscribe({
      next: (data: LookupItem[]) => {
        this.manufacturers = data;
        this.cdr.markForCheck();
      },
      error: () => { this.cdr.markForCheck(); }
    });

    this.lookupService.getCountries().subscribe({
      next: (data: LookupItem[]) => {
        this.countries = data;
        this.cdr.markForCheck();
      },
      error: () => { this.cdr.markForCheck(); }
    });
  }

  onSubmit(): void {
    if (this.detailForm.invalid) {
      const invalidFields = this.getInvalidFieldNames();
      this.translateService.get('editInventoryDetail.requiredFieldsError').pipe(takeUntil(this.destroy$)).subscribe(msg => {
        this.errorMessage = invalidFields.length > 0
          ? `${msg} (${invalidFields.join(', ')})`
          : msg;
        this.cdr.markForCheck();
      });
      Object.keys(this.detailForm.controls).forEach(key => {
        this.detailForm.get(key)?.markAsTouched();
      });
      return;
    }

    const updateDetailDto: UpdateInventoryDetailDto = {
      id: this.inventoryDetail?.id,
      itemId: this.inventoryDetail!.itemId,
      lot: String(this.detailForm.value.lot ?? '').trim(),
      supplierId: this.detailForm.value.supplierId || undefined,
      manufacturerId: this.detailForm.value.manufacturerId || undefined,
      countryId: this.detailForm.value.countryId || undefined,
      originalQuantity: this.detailForm.value.originalQuantity,
      batchNo: this.detailForm.value.batchNo?.trim() || undefined,
      expiryDate: this.parseDateFromDisplay(this.detailForm.value.expiryDate) || undefined,
      readyForIssue: this.coerceReadyForIssue(this.detailForm.value.readyForIssue)
    };

    if (this.showPrimaryPurposeSection) {
      const ppid = this.normalizeOptionalId(this.detailForm.value.primaryPurposId);
      updateDetailDto.primaryPurposId = ppid ?? undefined;
    } else if (this.inventoryDetail?.primaryPurposId != null && this.inventoryDetail.primaryPurposId > 0) {
      updateDetailDto.primaryPurposId = this.inventoryDetail.primaryPurposId;
    }

    // Prepare invoice information
    const updateInventoryDto: UpdateInventoryDto = {
      depoId: this.inventory?.depoId || 0,
      deliveryReceipt: this.detailForm.value.deliveryReceipt?.trim() || undefined,
      invoiceNumber: this.detailForm.value.invoiceNumber?.trim() || undefined,
      invoiceDate: this.parseDateFromDisplay(this.detailForm.value.invoiceDate) || undefined,
      recievedDate: this.parseDateFromDisplay(this.detailForm.value.recievedDate) || undefined,
      contractNumber: this.detailForm.value.contractNumber?.trim() || undefined,
      notes: this.detailForm.value.notes?.trim() || undefined,
      inventoryDetails: [] // Will be populated by the parent component
    };

    // Check if invoice information or attachments change requires confirmation
    const requiresConfirmation =
      this.hasInvoiceInfoChanged(updateInventoryDto) ||
      (this.selectedFiles && this.selectedFiles.length > 0) ||
      (this.removedExistingFileIds && this.removedExistingFileIds.length > 0);

    if (requiresConfirmation) {
      // Store the data for later submission after confirmation
      this.pendingSubmitData = { detail: updateDetailDto, inventory: updateInventoryDto };
      // Show confirmation dialog
      this.showInvoiceChangeConfirmation = true;
    } else {
      // No invoice info change, proceed directly
      this.saved.emit({
        detail: updateDetailDto,
        inventory: updateInventoryDto,
        files: this.selectedFiles && this.selectedFiles.length ? this.selectedFiles : undefined,
        removedFileIds: this.removedExistingFileIds && this.removedExistingFileIds.length ? this.removedExistingFileIds : undefined
      });
    }
  }

  /**
   * Check if invoice information has changed from the original values
   */
  private hasInvoiceInfoChanged(updateInventoryDto: UpdateInventoryDto): boolean {
    const originalInvoiceNumber = (this.inventory?.invoiceNumber || this.inventoryDetail?.invoiceNumber || '').trim();
    const originalDeliveryReceipt = (this.inventory?.deliveryReceipt || this.inventoryDetail?.deliveryReceipt || '').trim();
    const originalInvoiceDate = this.inventory?.invoiceDate || this.inventoryDetail?.invoiceDate;
    const originalReceivedDate = this.inventory?.recievedDate || this.inventoryDetail?.recievedDate;
    const originalContractNumber = (this.inventory?.contractNumber || this.inventoryDetail?.contractNumber || '').trim();
    const originalNotes = (this.inventory?.notes || this.inventoryDetail?.notes || '').trim();

    const newInvoiceNumber = (updateInventoryDto.invoiceNumber || '').trim();
    const newDeliveryReceipt = (updateInventoryDto.deliveryReceipt || '').trim();
    const newInvoiceDate = updateInventoryDto.invoiceDate;
    const newReceivedDate = updateInventoryDto.recievedDate;
    const newContractNumber = (updateInventoryDto.contractNumber || '').trim();
    const newNotes = (updateInventoryDto.notes || '').trim();

    // Compare invoice number
    if (newInvoiceNumber !== originalInvoiceNumber) {
      return true;
    }

    // Compare delivery receipt
    if (newDeliveryReceipt !== originalDeliveryReceipt) {
      return true;
    }

    // Compare invoice date (normalize dates for comparison)
    const normalizeDate = (date: string | Date | undefined | null): string | undefined => {
      if (!date) return undefined;
      // If it's already a string in YYYY-MM-DD format, return as-is
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // Otherwise, format and parse to normalize
      return this.parseDateFromDisplay(this.formatDateForDisplay(date));
    };

    const originalInvoiceDateStr = normalizeDate(originalInvoiceDate);
    const newInvoiceDateStr = newInvoiceDate ? normalizeDate(newInvoiceDate) : undefined;
    if (newInvoiceDateStr !== originalInvoiceDateStr) {
      return true;
    }

    // Compare received date
    const originalReceivedDateStr = normalizeDate(originalReceivedDate);
    const newReceivedDateStr = newReceivedDate ? normalizeDate(newReceivedDate) : undefined;
    if (newReceivedDateStr !== originalReceivedDateStr) {
      return true;
    }

    // Compare contract number
    if (newContractNumber !== originalContractNumber) {
      return true;
    }

    // Compare notes
    if (newNotes !== originalNotes) {
      return true;
    }

    return false;
  }

  /**
   * Handle confirmation dialog - proceed with save
   */
  onInvoiceChangeConfirmed(): void {
    this.showInvoiceChangeConfirmation = false;
    if (this.pendingSubmitData) {
      this.saved.emit({
        ...this.pendingSubmitData,
        files: this.selectedFiles && this.selectedFiles.length ? this.selectedFiles : undefined,
        removedFileIds: this.removedExistingFileIds && this.removedExistingFileIds.length ? this.removedExistingFileIds : undefined
      });
      this.pendingSubmitData = null;
    }
  }

  /**
   * Handle confirmation dialog cancellation
   */
  onInvoiceChangeCancelled(): void {
    this.showInvoiceChangeConfirmation = false;
    this.pendingSubmitData = null;
  }

  onAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newlySelected = input.files ? Array.from(input.files) : [];
    if (newlySelected.length) {
      const check = validateAttachments(newlySelected);
      if (!check.valid) {
        showAttachmentValidationToast(this.translateService, this.toastService, check.errorMessage);
        input.value = '';
        this.cdr.markForCheck();
        return;
      }
      const combined = [...this.selectedFiles, ...newlySelected];
      const seen = new Set<string>();
      this.selectedFiles = combined.filter(f => {
        const key = `${f.name}::${f.size}::${f.lastModified ?? 0}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    // Clear the native input so selecting the same file again will trigger change
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  removeAttachment(index: number): void {
    if (index >= 0 && index < this.selectedFiles.length) {
      this.selectedFiles.splice(index, 1);
    }
  }

  getFileSize(file: File): string {
    const bytes = file.size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = (bytes / Math.pow(1024, i)).toFixed(2);
    return `${value} ${sizes[i]}`;
  }

  private loadExistingFiles(): void {
    this.existingFiles = this.inventoryDetail?.files || [];
    this.cdr.markForCheck();
  }

  getDownloadUrl(file: FileUploadDto): string {
    return this.fileUploadService.getFileDownloadUrl(file.id);
  }

  openExistingFile(file: FileUploadDto): void {
    this.fileUploadService.getFileBlob(file.id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        // Revoke after a while to avoid breaking the opened tab immediately
        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        // Fallback: open raw URL (may 401 if browser doesn't send token, but keeps old behavior)
        window.open(this.getDownloadUrl(file), '_blank', 'noopener');
      }
    });
  }

  removeExistingFile(file: FileUploadDto): void {
    const fileId = file?.id;
    if (!fileId) return;
    if (!this.removedExistingFileIds.includes(fileId)) {
      this.removedExistingFileIds = [...this.removedExistingFileIds, fileId];
    }
    // Hide immediately in UI; actual deletion will happen on Save by backend.
    this.existingFiles = (this.existingFiles || []).filter(f => f.id !== fileId);
    this.cdr.markForCheck();
  }

  /**
   * Get the number of items in the same invoice
   */
  get itemsInSameInvoice(): number {
    const details = this.inventory?.inventoryDetails || [];
    const currentType = this.inventoryDetail?.item?.itemType;
    if (!currentType) {
      return details.length;
    }
    // Show count scoped to the same item type (Ammunition vs Explosive)
    return details.filter(d => d?.item?.itemType === currentType).length;
  }

  close(): void {
    this.detailForm.reset();
    this.errorMessage = '';
    this.showInvoiceChangeConfirmation = false;
    this.pendingSubmitData = null;
    // Clear any unsaved attachment selections on close
    this.selectedFiles = [];
    this.resetFileInput();
    this.closed.emit();
  }

  private unwrapLookupOption(option: DropdownOption<LookupItem> | LookupItem | null): LookupItem | null {
    if (!option) {
      return null;
    }
    if (typeof option === 'object' && 'value' in option) {
      return option.value as LookupItem;
    }
    return option as LookupItem;
  }

  private getLookupName(item: LookupItem | null): string {
    if (!item) {
      return '';
    }
    return getLocalizedName(item, getCurrentLang(this.translateService));
  }

  /**
   * Get names of form controls that have validation errors (for diagnostic feedback)
   */
  private getInvalidFieldNames(): string[] {
    const fieldLabels: Record<string, string> = {
      lot: 'Lot Number',
      originalQuantity: 'Item Quantity',
      batchNo: 'Batch No',
      expiryDate: 'Expiry Date',
      supplierId: 'Supplier',
      manufacturerId: 'Manufacturer',
      countryId: 'Country',
      primaryPurposId: 'Primary purpose',
      invoiceNumber: 'Invoice Number',
      invoiceDate: 'Invoice Date',
      recievedDate: 'Received Date',
      contractNumber: 'Contract Number',
      notes: 'Notes'
    };
    return Object.keys(this.detailForm.controls)
      .filter(key => this.detailForm.get(key)?.invalid)
      .map(key => fieldLabels[key] || key);
  }

  getFieldError(fieldName: string): string {
    const control = this.detailForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        const key = `editInventoryDetail.${fieldName}Required`;
        return this.translateService.instant(key) || `${fieldName} is required`;
      }
      if (control.errors['min']) {
        const key = `editInventoryDetail.${fieldName}MustBeGreater`;
        return this.translateService.instant(key) || `${fieldName} must be greater than ${control.errors['min'].min}`;
      }
      if (control.errors['maxlength']) {
        return this.translateService.instant('editInventoryDetail.lotMaxLength') ||
          `Maximum length is ${control.errors['maxlength'].requiredLength}`;
      }
    }
    return '';
  }

  get title(): string {
    return this.translateService.instant('editInventoryDetail.title');
  }

  /**
   * Format date for display in DD/MM/YYYY format
   */
  private formatDateForDisplay(date: string | Date | undefined | null): string {
    if (!date) return '';
    const formatted = formatDateShort(date);
    return formatted === 'N/A' ? '' : formatted;
  }

  /**
   * Parse date from DD/MM/YYYY display format to ISO string (YYYY-MM-DD)
   * Also handles YYYY-MM-DD format if user types it directly
   */
  private parseDateFromDisplay(dateString: string | undefined | null): string | undefined {
    if (!dateString || !dateString.trim()) return undefined;

    const trimmed = dateString.trim();

    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Try to parse DD/MM/YYYY format
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10);
      const year = parseInt(ddmmyyyyMatch[3], 10);

      // Validate date
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1900) {
        const date = new Date(year, month - 1, day);
        // Check if date is valid (handles invalid dates like 31/02/2024)
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
          const yearStr = String(year);
          const monthStr = String(month).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          return `${yearStr}-${monthStr}-${dayStr}`;
        }
      }
    }

    // Try to parse as Date object and convert to YYYY-MM-DD
    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      // Invalid date format
    }

    return undefined;
  }

  private resetFileInput(): void {
    const el = this.fileInputRef?.nativeElement;
    if (el) {
      el.value = '';
    }
  }
}


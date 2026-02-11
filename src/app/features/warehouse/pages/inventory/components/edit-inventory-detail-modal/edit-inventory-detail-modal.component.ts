import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalComponent } from '@components/modal/modal.component';
import { ButtonComponent } from '@components/button/button.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto, UpdateInventoryDetailDto, InventoryDto, UpdateInventoryDto } from '@models/inventory.model';
import { LookupService, LookupItem } from '@services/lookup.service';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateShort } from '@core/utils/format.utils';

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
  styleUrls: ['./edit-inventory-detail-modal.component.css']
})
export class EditInventoryDetailModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() inventoryDetail?: InventoryDetailDto;
  @Input() inventory?: InventoryDto;
  @Input() inventoryId!: number;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto }>();

  detailForm!: FormGroup;
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  countries: LookupItem[] = [];
  isLoading = false;
  errorMessage = '';
  showInvoiceChangeConfirmation = false;
  pendingSubmitData: { detail: UpdateInventoryDetailDto; inventory: UpdateInventoryDto } | null = null;
  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem | null) => this.getLookupName(this.unwrapLookupOption(option));

  constructor(
    private fb: FormBuilder,
    private lookupService: LookupService,
    private translateService: TranslateService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadLookupData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.initializeForm();
      this.errorMessage = '';
    }
    if ((changes['inventoryDetail'] && this.inventoryDetail) || (changes['inventory'] && this.inventory)) {
      this.loadFormData();
    }
  }

  private initializeForm(): void {
    this.detailForm = this.fb.group({
      // Inventory Detail fields
      lot: [this.inventoryDetail?.lot || 1, [Validators.required, Validators.min(1)]],
      originalQuantity: [this.inventoryDetail?.originalQuantity || 1000, [Validators.required, Validators.min(1)]],
      batchNo: [this.inventoryDetail?.batchNo || ''],
      expiryDate: [this.formatDateForDisplay(this.inventoryDetail?.expiryDate)],
      readyForIssue: [this.inventoryDetail?.readyForIssue ?? true],
      supplierId: [this.inventoryDetail?.supplierId || null],
      manufacturerId: [this.inventoryDetail?.manufacturerId || null],
      countryId: [this.inventoryDetail?.countryId || null],
      // Invoice Information fields
      invoiceNumber: [this.inventoryDetail?.invoiceNumber || this.inventory?.invoiceNumber || ''],
      invoiceDate: [this.formatDateForDisplay(this.inventoryDetail?.invoiceDate || this.inventory?.invoiceDate)],
      recievedDate: [this.formatDateForDisplay(this.inventoryDetail?.recievedDate || this.inventory?.recievedDate)],
      contractNumber: [this.inventoryDetail?.contractNumber || this.inventory?.contractNumber || ''],
      notes: [this.inventoryDetail?.notes || this.inventory?.notes || '']
    });
  }

  private loadFormData(): void {
    if (this.inventoryDetail || this.inventory) {
      this.detailForm.patchValue({
        lot: this.inventoryDetail?.lot || 1,
        originalQuantity: this.inventoryDetail?.originalQuantity || 1000,
        batchNo: this.inventoryDetail?.batchNo || '',
        expiryDate: this.formatDateForDisplay(this.inventoryDetail?.expiryDate),
        readyForIssue: this.inventoryDetail?.readyForIssue ?? true,
        supplierId: this.inventoryDetail?.supplierId || null,
        manufacturerId: this.inventoryDetail?.manufacturerId || null,
        countryId: this.inventoryDetail?.countryId || null,
        // Invoice Information
        invoiceNumber: this.inventoryDetail?.invoiceNumber || this.inventory?.invoiceNumber || '',
        invoiceDate: this.formatDateForDisplay(this.inventoryDetail?.invoiceDate || this.inventory?.invoiceDate),
        recievedDate: this.formatDateForDisplay(this.inventoryDetail?.recievedDate || this.inventory?.recievedDate),
        contractNumber: this.inventoryDetail?.contractNumber || this.inventory?.contractNumber || '',
        notes: this.inventoryDetail?.notes || this.inventory?.notes || ''
      });
    }
  }


  private loadLookupData(): void {
    this.lookupService.getSuppliers().subscribe({
      next: (data: LookupItem[]) => this.suppliers = data,
      error: () => { /* Silently handle error - lookup data is optional */ }
    });

    this.lookupService.getManufacturers().subscribe({
      next: (data: LookupItem[]) => this.manufacturers = data,
      error: () => { /* Silently handle error - lookup data is optional */ }
    });

    this.lookupService.getCountries().subscribe({
      next: (data: LookupItem[]) => this.countries = data,
      error: () => { /* Silently handle error - lookup data is optional */ }
    });
  }

  onSubmit(): void {
    if (this.detailForm.invalid) {
      this.translateService.get('editInventoryDetail.requiredFieldsError').subscribe(msg => {
        this.errorMessage = msg;
      });
      Object.keys(this.detailForm.controls).forEach(key => {
        this.detailForm.get(key)?.markAsTouched();
      });
      return;
    }

    const updateDetailDto: UpdateInventoryDetailDto = {
      id: this.inventoryDetail?.id,
      itemId: this.inventoryDetail!.itemId,
      lot: this.detailForm.value.lot,
      supplierId: this.detailForm.value.supplierId || undefined,
      manufacturerId: this.detailForm.value.manufacturerId || undefined,
      countryId: this.detailForm.value.countryId || undefined,
      originalQuantity: this.detailForm.value.originalQuantity,
      batchNo: this.detailForm.value.batchNo?.trim() || undefined,
      expiryDate: this.parseDateFromDisplay(this.detailForm.value.expiryDate) || undefined,
      readyForIssue: this.detailForm.value.readyForIssue ?? true
    };

    // Prepare invoice information
    const updateInventoryDto: UpdateInventoryDto = {
      depoId: this.inventory?.depoId || 0,
      invoiceNumber: this.detailForm.value.invoiceNumber?.trim() || undefined,
      invoiceDate: this.parseDateFromDisplay(this.detailForm.value.invoiceDate) || undefined,
      recievedDate: this.parseDateFromDisplay(this.detailForm.value.recievedDate) || undefined,
      contractNumber: this.detailForm.value.contractNumber?.trim() || undefined,
      notes: this.detailForm.value.notes?.trim() || undefined,
      inventoryDetails: [] // Will be populated by the parent component
    };

    // Check if invoice information has changed
    if (this.hasInvoiceInfoChanged(updateInventoryDto)) {
      // Store the data for later submission after confirmation
      this.pendingSubmitData = { detail: updateDetailDto, inventory: updateInventoryDto };
      // Show confirmation dialog
      this.showInvoiceChangeConfirmation = true;
    } else {
      // No invoice info change, proceed directly
      this.saved.emit({ detail: updateDetailDto, inventory: updateInventoryDto });
    }
  }

  /**
   * Check if invoice information has changed from the original values
   */
  private hasInvoiceInfoChanged(updateInventoryDto: UpdateInventoryDto): boolean {
    const originalInvoiceNumber = (this.inventory?.invoiceNumber || this.inventoryDetail?.invoiceNumber || '').trim();
    const originalInvoiceDate = this.inventory?.invoiceDate || this.inventoryDetail?.invoiceDate;
    const originalReceivedDate = this.inventory?.recievedDate || this.inventoryDetail?.recievedDate;
    const originalContractNumber = (this.inventory?.contractNumber || this.inventoryDetail?.contractNumber || '').trim();
    const originalNotes = (this.inventory?.notes || this.inventoryDetail?.notes || '').trim();

    const newInvoiceNumber = (updateInventoryDto.invoiceNumber || '').trim();
    const newInvoiceDate = updateInventoryDto.invoiceDate;
    const newReceivedDate = updateInventoryDto.recievedDate;
    const newContractNumber = (updateInventoryDto.contractNumber || '').trim();
    const newNotes = (updateInventoryDto.notes || '').trim();

    // Compare invoice number
    if (newInvoiceNumber !== originalInvoiceNumber) {
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
      this.saved.emit(this.pendingSubmitData);
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

  /**
   * Get the number of items in the same invoice
   */
  get itemsInSameInvoice(): number {
    return this.inventory?.inventoryDetails?.length || 0;
  }

  close(): void {
    this.detailForm.reset();
    this.errorMessage = '';
    this.showInvoiceChangeConfirmation = false;
    this.pendingSubmitData = null;
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
}


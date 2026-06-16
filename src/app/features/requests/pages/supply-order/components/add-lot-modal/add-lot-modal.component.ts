import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Package, AlertTriangle } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@components/modal/modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderRequestItemDto } from '@models/order.model';
import { LotItem } from '@models/supply-order.model';
import { SupplyOrderDataService } from '@requests/services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getLocalizedOrderItemName } from '@requests/utils/supply-order-format.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLotConditionLabel as resolveLotConditionLabel } from '@utils/lot.utils';

/**
 * Add Lot Modal Component
 * Standalone component for adding lots to supply orders
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-add-lot-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ModalComponent,
    DropdownComponent
  ],
  templateUrl: './add-lot-modal.component.html',
  styleUrls: ['./add-lot-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddLotModalComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() isOpen: boolean = false;
  @Input() supplyId: number = 0;
  @Input() orderItems: OrderRequestItemDto[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() lotAdded = new EventEmitter<void>();

  readonly Package = Package;
  readonly AlertTriangle = AlertTriangle;
  formatDate = formatDateUtil;
  formatNumber = formatNumberUtil;

  getLotConditionLabel(condition: string): string {
    return resolveLotConditionLabel(condition, this.translateService, 'supplyOrder');
  }

  addLotForm!: FormGroup;
  selectedItemForLot: OrderRequestItemDto | null = null;
  availableLots: LotItem[] = [];
  selectedLotNumber: string | null = null;
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';
  loadingAllLots: boolean = false;
  loadingManualLot: boolean = false;
  loadingLotDetails: boolean = false;

  constructor(
    private fb: FormBuilder,
    private translateService: TranslateService,
    private toastService: ToastService,
    private supplyOrderDataService: SupplyOrderDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.addLotForm = this.fb.group({
      itemId: [null, Validators.required],
      lot: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  onItemSelected(selectedValue: OrderRequestItemDto | OrderRequestItemDto[] | number | null): void {
    const itemId = this.extractItemId(selectedValue);

    if (!itemId) {
      this.resetLotSelection();
      return;
    }

    const selectedItem = this.orderItems.find(item => item.id === itemId);
    if (selectedItem) {
      this.selectedItemForLot = selectedItem;
      this.addLotForm.patchValue({ itemId: selectedItem.id });
    } else {
      this.selectedItemForLot = null;
      this.addLotForm.patchValue({ itemId: null });
    }

    this.resetLotSelection();
  }

  private extractItemId(selectedValue: OrderRequestItemDto | OrderRequestItemDto[] | number | null): number | null {
    if (selectedValue === null || selectedValue === undefined) {
      return null;
    }

    if (typeof selectedValue === 'number') {
      return selectedValue;
    }

    if (Array.isArray(selectedValue)) {
      return selectedValue.length > 0 ? (selectedValue[0].id || selectedValue[0].itemId) : null;
    }

    const wrappedValue = selectedValue as { value?: OrderRequestItemDto } | OrderRequestItemDto;
    const item = 'value' in wrappedValue && wrappedValue.value ? wrappedValue.value : (wrappedValue as OrderRequestItemDto);
    return item.id || item.itemId || null;
  }

  private resetLotSelection(): void {
    this.availableLots = [];
    this.selectedLotNumber = null;
    this.addLotForm.patchValue({ lot: null });
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
  }

  onShowAvailableLots(): void {
    if (!this.selectedItemForLot) {
      this.showWarningToast('supplyOrder.toast.pleaseSelectItemFirst', 'toast.warning');
      return;
    }
    this.loadAvailableLotsForQuantity(this.selectedItemForLot);
  }

  onShowAllLots(): void {
    if (!this.selectedItemForLot) {
      this.showWarningToast('supplyOrder.toast.pleaseSelectItemFirst', 'toast.warning');
      return;
    }
    this.loadAllLotsForItem(this.selectedItemForLot);
  }

  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  onGetManualLotDetails(): void {
    if (!this.selectedItemForLot || !this.manualLotNumber.trim()) {
      this.showWarningToast('supplyOrder.toast.pleaseEnterLotNumber', 'toast.warning');
      return;
    }

    const lotKey = this.manualLotNumber.trim();
    if (lotKey.length > 64) {
      this.showErrorToastKeys('supplyOrder.toast.invalidLotNumber', 'toast.error');
      return;
    }

    this.loadingManualLot = true;
    this.supplyOrderDataService.getLotByNumber(lotKey)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot) => {
          if (lot.itemId !== this.selectedItemForLot!.itemId) {
            this.showErrorToastInterpolated(
              'supplyOrder.toast.lotBelongsToDifferentItemWithName',
              'toast.error',
              msg =>
                msg.replace('{{lotNumber}}', lotKey).replace('{{itemName}}', lot.itemName || 'Unknown')
            );
            this.loadingManualLot = false;
            return;
          }

          const existingLot = this.availableLots.find(l => String(l.lotNumber) === String(lot.lot));
          if (existingLot) {
            this.showWarningToastInterpolated(
              'supplyOrder.toast.lotAlreadyInListWithNumber',
              'toast.warning',
              msg => msg.replace('{{lotNumber}}', lotKey)
            );
            this.loadingManualLot = false;
            return;
          }

          const newLot: LotItem = this.supplyOrderDataService.transformLotDetailToLotItem(lot);
          this.availableLots.push(newLot);
          this.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.showSuccessToastInterpolated(
            'supplyOrder.toast.lotAddedSuccessfullyWithNumber',
            'toast.success',
            msg => msg.replace('{{lotNumber}}', lotKey)
          );
          this.manualLotNumber = '';
          this.loadingManualLot = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Lot not found or error loading details');
          this.loadingManualLot = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadAvailableLotsForQuantity(item: OrderRequestItemDto): void {
    this.loadingAllLots = true;
    this.supplyOrderDataService.loadAvailableLotsForQuantity(item.itemId, item.quantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotItem[]) => {
          this.availableLots = lots;
          this.loadingAllLots = false;

          if (this.availableLots.length > 0) {
            this.showSuccessToastInterpolated(
              'supplyOrder.toast.loadedAvailableLotsCount',
              'toast.success',
              msg =>
                msg
                  .replace('{{count}}', this.availableLots.length.toString())
                  .replace('{{quantity}}', formatNumberUtil(item.quantity))
            );
          } else {
            this.showWarningToast('supplyOrder.toast.noAvailableLotsFoundForQuantity', 'toast.warning');
          }
          this.loadingAllLots = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to load available lots');
          this.loadingAllLots = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadAllLotsForItem(item: OrderRequestItemDto): void {
    this.loadingAllLots = true;
    this.supplyOrderDataService.loadAllLotsForItem(item.itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotItem[]) => {
          this.availableLots = lots;
          this.loadingAllLots = false;

          if (this.availableLots.length > 0) {
            this.showSuccessToastInterpolated(
              'supplyOrder.toast.loadedAllLotsCount',
              'toast.success',
              msg => msg.replace('{{count}}', this.availableLots.length.toString())
            );
          } else {
            this.showWarningToast('supplyOrder.toast.noLotsFound', 'toast.warning');
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to load lots');
          this.loadingAllLots = false;
          this.cdr.markForCheck();
        }
      });
  }

  onSelectLot(lotNumber: string): void {
    const key = String(lotNumber);
    this.selectedLotNumber = key;
    this.addLotForm.patchValue({ lot: key });
  }

  getSelectedItemDisplayName(): string {
    if (!this.selectedItemForLot) return '';
    return getLocalizedOrderItemName(this.selectedItemForLot, this.translateService);
  }

  /** Selected lot has no available quantity (e.g. from "Show All Lots" including empty lots) */
  get isSelectedLotEmpty(): boolean {
    if (!this.selectedLotNumber) return false;
    const lot = this.availableLots.find(l => String(l.lotNumber) === String(this.selectedLotNumber));
    return lot ? lot.quantity <= 0 : false;
  }

  itemOptionLabel = (option: OrderRequestItemDto | { value?: OrderRequestItemDto } | null): string => {
    if (!option) return '';
    const item: OrderRequestItemDto | undefined = (option as { value?: OrderRequestItemDto }).value || (option as OrderRequestItemDto);
    if (!item || (item.itemId === undefined && item.id === undefined)) {
      return '';
    }
    return getLocalizedOrderItemName(item, this.translateService);
  };

  onAddLot(): void {
    if (!this.selectedItemForLot) {
      this.addLotForm.get('itemId')?.markAsTouched();
      this.showErrorToastKeys('supplyOrder.toast.pleaseSelectItem', 'toast.error');
      return;
    }

    if (!this.selectedLotNumber) {
      this.addLotForm.get('lot')?.markAsTouched();
      this.showErrorToastKeys('supplyOrder.toast.pleaseSelectLot', 'toast.error');
      return;
    }

    if (this.addLotForm.invalid) {
      this.addLotForm.markAllAsTouched();
      this.showErrorToastKeys('supplyOrder.toast.pleaseFillRequiredFields', 'toast.error');
      return;
    }

    const formValue = this.addLotForm.value;
    this.loadingLotDetails = true;

    this.supplyOrderDataService.addSupplyDetail(this.supplyId, {
      itemId: this.selectedItemForLot.itemId,
      lot: String(this.selectedLotNumber).trim(),
      quantity: formValue.quantity,
      notes: formValue.notes
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccessToast('supplyOrder.toast.lotAddedSuccessfullyToSupply', 'toast.success');
          this.loadingLotDetails = false;
          this.closeModal();
          this.lotAdded.emit();
        },
        error: (error: unknown) => {
          this.showErrorToast(error, 'Failed to add lot');
          this.loadingLotDetails = false;
        }
      });
  }

  closeModal(): void {
    this.addLotForm.reset();
    this.addLotForm.patchValue({ quantity: 1 });
    this.selectedItemForLot = null;
    this.availableLots = [];
    this.selectedLotNumber = null;
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
    this.closed.emit();
  }

  private showSuccessToast(messageKey: string, titleKey: string = 'toast.success'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.success(translations[messageKey], translations[titleKey]);
      });
  }

  private showSuccessToastInterpolated(
    messageKey: string,
    titleKey: string,
    format: (message: string) => string
  ): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.success(format(translations[messageKey]), translations[titleKey]);
      });
  }

  private showWarningToast(messageKey: string, titleKey: string = 'toast.warning'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.warning(translations[messageKey], translations[titleKey]);
      });
  }

  private showWarningToastInterpolated(
    messageKey: string,
    titleKey: string,
    format: (message: string) => string
  ): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.warning(format(translations[messageKey]), translations[titleKey]);
      });
  }

  private showErrorToastKeys(messageKey: string, titleKey: string = 'toast.error'): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(translations[messageKey], translations[titleKey]);
      });
  }

  private showErrorToastInterpolated(
    messageKey: string,
    titleKey: string,
    format: (message: string) => string
  ): void {
    this.translateService
      .get([messageKey, titleKey])
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(format(translations[messageKey]), translations[titleKey]);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translateService);
    this.translateService
      .get('toast.error')
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.toastService.error(msg, translations['toast.error']);
      });
  }
}


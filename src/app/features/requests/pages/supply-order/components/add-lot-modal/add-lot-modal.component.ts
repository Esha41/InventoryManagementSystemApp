import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Package, AlertTriangle } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderRequestItemDto } from '@models/order.model';
import { LotItem } from '@models/supply-order.model';
import { SupplyOrderDataService } from '@requests/services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getLocalizedOrderItemName } from '@utils/supply-order-format.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

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
export class AddLotModalComponent implements OnInit, OnDestroy {
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
  }

  ngOnInit(): void {
    // Form is initialized in constructor
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
      this.translateService.get(['supplyOrder.toast.pleaseSelectItemFirst', 'toast.warning']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseSelectItemFirst'], translations['toast.warning']);
      });
      return;
    }
    this.loadAvailableLotsForQuantity(this.selectedItemForLot);
  }

  onShowAllLots(): void {
    if (!this.selectedItemForLot) {
      this.translateService.get(['supplyOrder.toast.pleaseSelectItemFirst', 'toast.warning']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseSelectItemFirst'], translations['toast.warning']);
      });
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
      this.translateService.get(['supplyOrder.toast.pleaseEnterLotNumber', 'toast.warning']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseEnterLotNumber'], translations['toast.warning']);
      });
      return;
    }

    const lotKey = this.manualLotNumber.trim();
    if (lotKey.length > 64) {
      this.translateService.get(['supplyOrder.toast.invalidLotNumber', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.invalidLotNumber'], translations['toast.error']);
      });
      return;
    }

    this.loadingManualLot = true;
    this.supplyOrderDataService.getLotByNumber(lotKey)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot) => {
          if (lot.itemId !== this.selectedItemForLot!.itemId) {
            this.translateService.get(['supplyOrder.toast.lotBelongsToDifferentItemWithName', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              const errorMsg = translations['supplyOrder.toast.lotBelongsToDifferentItemWithName']
                .replace('{{lotNumber}}', lotKey)
                .replace('{{itemName}}', lot.itemName || 'Unknown');
              this.toastService.error(errorMsg, translations['toast.error']);
            });
            this.loadingManualLot = false;
            return;
          }

          const existingLot = this.availableLots.find(l => String(l.lotNumber) === String(lot.lot));
          if (existingLot) {
            this.translateService.get(['supplyOrder.toast.lotAlreadyInListWithNumber', 'toast.warning']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              const warningMsg = translations['supplyOrder.toast.lotAlreadyInListWithNumber'].replace('{{lotNumber}}', lotKey);
              this.toastService.warning(warningMsg, translations['toast.warning']);
            });
            this.loadingManualLot = false;
            return;
          }

          const newLot: LotItem = this.supplyOrderDataService.transformLotDetailToLotItem(lot);
          this.availableLots.push(newLot);
          this.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.translateService.get(['supplyOrder.toast.lotAddedSuccessfullyWithNumber', 'toast.success']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            const successMsg = translations['supplyOrder.toast.lotAddedSuccessfullyWithNumber'].replace('{{lotNumber}}', lotKey);
            this.toastService.success(successMsg, translations['toast.success']);
          });
          this.manualLotNumber = '';
          this.loadingManualLot = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Lot not found or error loading details');
          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
            this.translateService.get(['supplyOrder.toast.loadedAvailableLotsCount', 'toast.success']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              const successMsg = translations['supplyOrder.toast.loadedAvailableLotsCount']
                .replace('{{count}}', this.availableLots.length.toString())
                .replace('{{quantity}}', formatNumberUtil(item.quantity));
              this.toastService.success(successMsg, translations['toast.success']);
            });
          } else {
            this.translateService.get(['supplyOrder.toast.noAvailableLotsFoundForQuantity', 'toast.warning']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.warning(translations['supplyOrder.toast.noAvailableLotsFoundForQuantity'], translations['toast.warning']);
            });
          }
          this.loadingAllLots = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load available lots');
          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
            this.translateService.get(['supplyOrder.toast.loadedAllLotsCount', 'toast.success']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              const successMsg = translations['supplyOrder.toast.loadedAllLotsCount']
                .replace('{{count}}', this.availableLots.length.toString());
              this.toastService.success(successMsg, translations['toast.success']);
            });
          } else {
            this.translateService.get(['supplyOrder.toast.noLotsFound', 'toast.warning']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
              this.toastService.warning(translations['supplyOrder.toast.noLotsFound'], translations['toast.warning']);
            });
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load lots');
          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
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
      this.translateService.get(['supplyOrder.toast.pleaseSelectItem', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseSelectItem'], translations['toast.error']);
      });
      return;
    }

    if (!this.selectedLotNumber) {
      this.addLotForm.get('lot')?.markAsTouched();
      this.translateService.get(['supplyOrder.toast.pleaseSelectLot', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseSelectLot'], translations['toast.error']);
      });
      return;
    }

    if (this.addLotForm.invalid) {
      this.addLotForm.markAllAsTouched();
      this.translateService.get(['supplyOrder.toast.pleaseFillRequiredFields', 'toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseFillRequiredFields'], translations['toast.error']);
      });
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
          this.translateService.get(['supplyOrder.toast.lotAddedSuccessfullyToSupply', 'toast.success']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.success(translations['supplyOrder.toast.lotAddedSuccessfullyToSupply'], translations['toast.success']);
          });
          this.loadingLotDetails = false;
          this.closeModal();
          this.lotAdded.emit();
        },
        error: (error: unknown) => {
          const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to add lot');
          this.translateService.get(['toast.error']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingLotDetails = false;
        }
      });
  }

  closeModal(): void {
    this.isOpen = false;
    this.addLotForm.reset();
    this.addLotForm.patchValue({ quantity: 1 });
    this.selectedItemForLot = null;
    this.availableLots = [];
    this.selectedLotNumber = null;
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
    this.closed.emit();
  }
}


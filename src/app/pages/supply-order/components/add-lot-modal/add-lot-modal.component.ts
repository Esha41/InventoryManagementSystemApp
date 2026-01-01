import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Package, AlertTriangle } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderRequestItemDto } from '@services/order.service';
import { LotItem } from '@models/supply-order.model';
import { SupplyOrderDataService } from '@services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getLocalizedOrderItemName } from '@utils/supply-order-format.utils';

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
  selectedLotNumber: number | null = null;
  showManualLotEntry: boolean = false;
  manualLotNumber: string = '';
  loadingAllLots: boolean = false;
  loadingManualLot: boolean = false;
  loadingLotDetails: boolean = false;

  constructor(
    private fb: FormBuilder,
    private translateService: TranslateService,
    private toastService: ToastService,
    private supplyOrderDataService: SupplyOrderDataService
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
      this.translateService.get(['supplyOrder.toast.pleaseSelectItemFirst', 'toast.warning']).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseSelectItemFirst'], translations['toast.warning']);
      });
      return;
    }
    this.loadAvailableLotsForQuantity(this.selectedItemForLot);
  }

  onAddLotManually(): void {
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  onGetManualLotDetails(): void {
    if (!this.selectedItemForLot || !this.manualLotNumber.trim()) {
      this.translateService.get(['supplyOrder.toast.pleaseEnterLotNumber', 'toast.warning']).subscribe(translations => {
        this.toastService.warning(translations['supplyOrder.toast.pleaseEnterLotNumber'], translations['toast.warning']);
      });
      return;
    }

    const lotNum = parseInt(this.manualLotNumber.trim(), 10);
    if (isNaN(lotNum)) {
      this.translateService.get(['supplyOrder.toast.invalidLotNumber', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.invalidLotNumber'], translations['toast.error']);
      });
      return;
    }

    this.loadingManualLot = true;
    this.supplyOrderDataService.getLotByNumber(lotNum)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot) => {
          if (lot.itemId !== this.selectedItemForLot!.itemId) {
            this.translateService.get(['supplyOrder.toast.lotBelongsToDifferentItemWithName', 'toast.error']).subscribe(translations => {
              const errorMsg = translations['supplyOrder.toast.lotBelongsToDifferentItemWithName']
                .replace('{{lotNumber}}', lotNum.toString())
                .replace('{{itemName}}', lot.itemName || 'Unknown');
              this.toastService.error(errorMsg, translations['toast.error']);
            });
            this.loadingManualLot = false;
            return;
          }

          const existingLot = this.availableLots.find(l => l.lotNumber === lot.lot);
          if (existingLot) {
            this.translateService.get(['supplyOrder.toast.lotAlreadyInListWithNumber', 'toast.warning']).subscribe(translations => {
              const warningMsg = translations['supplyOrder.toast.lotAlreadyInListWithNumber'].replace('{{lotNumber}}', lotNum.toString());
              this.toastService.warning(warningMsg, translations['toast.warning']);
            });
            this.loadingManualLot = false;
            return;
          }

          const newLot: LotItem = this.supplyOrderDataService.transformLotDetailToLotItem(lot);
          this.availableLots.push(newLot);
          this.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.translateService.get(['supplyOrder.toast.lotAddedSuccessfullyWithNumber', 'toast.success']).subscribe(translations => {
            const successMsg = translations['supplyOrder.toast.lotAddedSuccessfullyWithNumber'].replace('{{lotNumber}}', lotNum.toString());
            this.toastService.success(successMsg, translations['toast.success']);
          });
          this.manualLotNumber = '';
          this.loadingManualLot = false;
        },
        error: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Lot not found or error loading details';
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingManualLot = false;
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
            this.translateService.get(['supplyOrder.toast.loadedAvailableLotsCount', 'toast.success']).subscribe(translations => {
              const successMsg = translations['supplyOrder.toast.loadedAvailableLotsCount']
                .replace('{{count}}', this.availableLots.length.toString())
                .replace('{{quantity}}', formatNumberUtil(item.quantity));
              this.toastService.success(successMsg, translations['toast.success']);
            });
          } else {
            this.translateService.get(['supplyOrder.toast.noAvailableLotsFoundForQuantity', 'toast.warning']).subscribe(translations => {
              this.toastService.warning(translations['supplyOrder.toast.noAvailableLotsFoundForQuantity'], translations['toast.warning']);
            });
          }
        },
        error: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load available lots';
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingAllLots = false;
        }
      });
  }

  onSelectLot(lotNumber: number): void {
    this.selectedLotNumber = lotNumber;
    this.addLotForm.patchValue({ lot: lotNumber });
  }

  getSelectedItemDisplayName(): string {
    if (!this.selectedItemForLot) return '';
    return getLocalizedOrderItemName(this.selectedItemForLot, this.translateService);
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
      this.translateService.get(['supplyOrder.toast.pleaseSelectItem', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseSelectItem'], translations['toast.error']);
      });
      return;
    }

    if (!this.selectedLotNumber) {
      this.addLotForm.get('lot')?.markAsTouched();
      this.translateService.get(['supplyOrder.toast.pleaseSelectLot', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseSelectLot'], translations['toast.error']);
      });
      return;
    }

    if (this.addLotForm.invalid) {
      this.addLotForm.markAllAsTouched();
      this.translateService.get(['supplyOrder.toast.pleaseFillRequiredFields', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.pleaseFillRequiredFields'], translations['toast.error']);
      });
      return;
    }

    const formValue = this.addLotForm.value;
    this.loadingLotDetails = true;

    this.supplyOrderDataService.addSupplyDetail(this.supplyId, {
      itemId: this.selectedItemForLot.itemId,
      lot: this.selectedLotNumber,
      quantity: formValue.quantity,
      notes: formValue.notes
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.translateService.get(['supplyOrder.toast.lotAddedSuccessfullyToSupply', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['supplyOrder.toast.lotAddedSuccessfullyToSupply'], translations['toast.success']);
          });
          this.loadingLotDetails = false;
          this.closeModal();
          this.lotAdded.emit();
        },
        error: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add lot';
          this.translateService.get(['toast.error']).subscribe(translations => {
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


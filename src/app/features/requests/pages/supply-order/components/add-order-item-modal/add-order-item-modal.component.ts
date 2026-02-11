import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderRequestItemDto, CreateRequestItemDto } from '@models/order.model';
import { SupplyOrderDataService } from '@requests/services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { APIOperationResponse } from '@models/api-response.model';
import { getItemManagementOptionLabel } from '@utils/supply-order-format.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

/**
 * Add Order Item Modal Component
 * Standalone component for adding items to order requests
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-add-order-item-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalComponent,
    DropdownComponent
  ],
  templateUrl: './add-order-item-modal.component.html',
  styleUrls: ['./add-order-item-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddOrderItemModalComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() isOpen: boolean = false;
  @Input() orderId: number = 0;
  @Input() orderItems: OrderRequestItemDto[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() itemAdded = new EventEmitter<void>();

  addItemForm!: FormGroup;
  availableItems: any[] = [];
  loadingItems: boolean = false;
  savingItem: boolean = false;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.onOpen();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.addItemForm = this.fb.group({
      itemId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  private loadAvailableItems(): void {
    this.loadingItems = true;
    const existingItemIds = this.orderItems.map(item => item.itemId);

    // Determine allowed item types based on existing order items
    const allowedItemTypes = this.getAllowedItemTypes();

    this.supplyOrderDataService.loadAvailableItems(existingItemIds, allowedItemTypes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.availableItems = items;
          this.loadingItems = false;
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load items';
          this.translateService.get(['supplyOrder.toast.failedToLoadItems', 'toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingItems = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Determine allowed item types based on existing order items
   * Rules:
   * - If order has weapons (type 2), only allow weapons
   * - If order has ammunition (type 1) or explosives (type 3), allow both but not weapons
   * - If order is empty, allow all types
   * Item types: 1=Ammunition, 2=Weapon, 3=Explosive
   */
  private getAllowedItemTypes(): number[] | undefined {
    // Weapons (type 2) are not handled in this modal anymore
    // We only allow Ammunition (1) and Explosives (3)
    return [1, 3];
  }

  itemManagementOptionLabel = (item: any): string => {
    return getItemManagementOptionLabel(item, this.translateService);
  };



  onSaveAddOrderItem(): void {
    if (this.addItemForm.invalid) {
      this.addItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.addItemForm.value;
    const existingItem = this.orderItems.find(item => item.itemId === formValue.itemId);
    if (existingItem) {
      this.translateService.get(['supplyOrder.toast.itemAlreadyExists', 'toast.error']).subscribe(translations => {
        this.toastService.error(translations['supplyOrder.toast.itemAlreadyExists'], translations['toast.error']);
      });
      return;
    }

    this.proceedToAddItem(formValue);
  }

  private proceedToAddItem(formValue: any): void {
    const itemDto: CreateRequestItemDto = {
      itemId: formValue.itemId,
      quantity: formValue.quantity,
      notes: formValue.notes || undefined
    };

    this.savingItem = true;
    this.supplyOrderDataService.addOrderItem(this.orderId, itemDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<number>) => {
          if (response.succeeded) {
            this.translateService.get(['supplyOrder.toast.itemAddedSuccessfully', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['supplyOrder.toast.itemAddedSuccessfully'], translations['toast.success']);
            });
            this.closeModal();
            this.itemAdded.emit();
          } else {
            const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(response, 'Failed to add item', this.translateService);
            this.translateService.get(['toast.error']).subscribe(translations => {
              this.toastService.error(errorMessage, translations['toast.error']);
            });
          }
          this.savingItem = false;
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to add item', this.translateService);
          this.translateService.get(['toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.savingItem = false;
          this.cdr.markForCheck();
        }
      });
  }

  closeModal(): void {
    this.isOpen = false;
    this.addItemForm.reset();
    this.closed.emit();
  }

  onOpen(): void {
    this.initializeForm();
    this.loadAvailableItems();
  }

  /**
   * Get a user-friendly message about item type restrictions
   */
  getItemTypeRestrictionMessage(): string {
    // Since we only allow 1 and 3 now, we show the combined message
    return this.translateService.instant('supplyOrder.ammunitionExplosivesAllowed');
  }
}


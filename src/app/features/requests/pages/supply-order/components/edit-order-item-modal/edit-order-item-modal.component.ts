import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@components/modal/modal.component';
import { OrderRequestItemDto } from '@models/order.model';
import { SupplyOrderDataService } from '@requests/services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { APIOperationResponse } from '@models/api-response.model';
import { getItemProductId } from '@requests/utils/supply-order-format.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

/**
 * Edit Order Item Modal Component
 * Standalone component for editing order item quantities
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-edit-order-item-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalComponent
  ],
  templateUrl: './edit-order-item-modal.component.html',
  styleUrls: ['./edit-order-item-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditOrderItemModalComponent implements OnInit, OnDestroy, OnChanges {
  private destroy$ = new Subject<void>();

  @Input() isOpen: boolean = false;
  @Input() orderId: number = 0;
  @Input() selectedItem: OrderRequestItemDto | null = null;
  @Input() totalSupplied: number = 0;
  @Input() canIncreaseQuantity: boolean = true;
  @Input() canDecreaseQuantity: boolean = true;

  @Output() closed = new EventEmitter<void>();
  @Output() itemUpdated = new EventEmitter<void>();

  editItemForm!: FormGroup;
  savingItem: boolean = false;

  getItemProductId = getItemProductId;

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
    if ((changes['selectedItem'] || changes['totalSupplied'] || changes['canIncreaseQuantity'] || changes['canDecreaseQuantity']) && this.selectedItem) {
      this.initializeForm();
    }
    if (changes['isOpen'] && this.isOpen && this.selectedItem) {
      this.initializeForm();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    const currentQty = this.selectedItem?.quantity || 1;
    const minAllowed = Math.max(1, this.totalSupplied || 0);
    const min = this.canDecreaseQuantity ? minAllowed : currentQty;
    const max = this.canIncreaseQuantity ? undefined : currentQty;
    const validators = [Validators.required, Validators.min(min)];
    if (max !== undefined) {
      validators.push(Validators.max(max));
    }
    this.editItemForm = this.fb.group({
      quantity: [currentQty, validators],
      notes: ['']
    });
  }

  get editQuantityMin(): number {
    if (!this.selectedItem) return 1;
    const minFromSupplied = Math.max(1, this.totalSupplied || 0);
    return this.canDecreaseQuantity ? minFromSupplied : (this.selectedItem.quantity || 1);
  }

  get editQuantityMax(): number | null {
    if (!this.selectedItem || this.canIncreaseQuantity) return null;
    return this.selectedItem.quantity || 1;
  }



  onSaveEditOrderItem(): void {
    if (!this.selectedItem || this.editItemForm.invalid) {
      this.editItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.editItemForm.value;
    const newQuantity = formValue.quantity;

    this.proceedToUpdateItem(newQuantity);
  }

  private proceedToUpdateItem(newQuantity: number): void {
    this.savingItem = true;
    this.supplyOrderDataService.updateOrderItemQuantity(this.orderId, this.selectedItem!.id, newQuantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: APIOperationResponse<boolean>) => {
          if (response.succeeded) {
            this.translateService.get(['supplyOrder.toast.itemQuantityUpdatedSuccessfully', 'toast.success']).subscribe(translations => {
              this.toastService.success(translations['supplyOrder.toast.itemQuantityUpdatedSuccessfully'], translations['toast.success']);
            });
            this.closeModal();
            this.itemUpdated.emit();
          } else {
            const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(response, 'Failed to update item quantity', this.translateService);
            this.translateService.get(['toast.error']).subscribe(translations => {
              this.toastService.error(errorMessage, translations['toast.error']);
            });
          }
          this.savingItem = false;
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          const errorMessage = ErrorHandler.extractAndTranslateErrorMessage(error, 'Failed to update item quantity', this.translateService);
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
    this.editItemForm.reset();
    this.closed.emit();
  }
}


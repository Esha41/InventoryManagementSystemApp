import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { OrderRequestItemDto } from '@models/order.model';
import { SupplyOrderDataService } from '@requests/services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { APIOperationResponse } from '@models/api-response.model';
import { getItemProductId } from '@utils/supply-order-format.utils';
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
    if (changes['selectedItem'] && this.selectedItem) {
      this.initializeForm();
    }
    if (changes['isOpen'] && this.isOpen && this.selectedItem) {
      this.initializeForm();
    }
    if (changes['totalSupplied'] && this.isOpen) {
      this.initializeForm();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    const minAllowed = Math.max(1, this.totalSupplied || 0);
    this.editItemForm = this.fb.group({
      quantity: [this.selectedItem?.quantity || 1, [Validators.required, Validators.min(minAllowed)]],
      notes: ['']
    });
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


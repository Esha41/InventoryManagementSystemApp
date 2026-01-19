import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderRequestItemDto, CreateUpdateRequestItemDto } from '@services/order.service';
import { SupplyOrderDataService } from '@services/supply-order-data.service';
import { ToastService } from '@services/toast.service';
import { APIOperationResponse } from '@models/api-response.model';
import { getItemManagementOptionLabel } from '@utils/supply-order-format.utils';

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
    private supplyOrderDataService: SupplyOrderDataService
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
    this.supplyOrderDataService.loadAvailableItems(existingItemIds)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.availableItems = items;
          this.loadingItems = false;
        },
        error: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load items';
          this.translateService.get(['supplyOrder.toast.failedToLoadItems', 'toast.error']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.loadingItems = false;
        }
      });
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

    const itemDto: CreateUpdateRequestItemDto = {
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
            this.translateService.get(['toast.error', 'toast.failedToAddItem']).subscribe(translations => {
              this.toastService.error(response.message || translations['toast.failedToAddItem'], translations['toast.error']);
            });
          }
          this.savingItem = false;
        },
        error: (error: any) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add item';
          this.translateService.get(['toast.error', 'toast.failedToAddItem']).subscribe(translations => {
            this.toastService.error(errorMessage, translations['toast.error']);
          });
          this.savingItem = false;
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
}


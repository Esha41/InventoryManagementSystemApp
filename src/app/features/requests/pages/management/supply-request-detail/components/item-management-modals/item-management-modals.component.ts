/**
 * Item Management Modals Component
 * Handles add, edit, and remove item modals
 */

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '@components/modal/modal.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { OrderItem } from '@models/supply-request.model';
import { CreateRequestItemDto } from '@models/request-item.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { unwrapDropdownOption } from '@utils/dropdown.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-item-management-modals',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalComponent,
    ConfirmDialogComponent,
    DropdownComponent
  ],
  templateUrl: './item-management-modals.component.html',
  styleUrls: ['./item-management-modals.component.css']
})
export class ItemManagementModalsComponent implements OnInit, OnChanges {
  @Input() isAddItemModalOpen: boolean = false;
  @Input() isEditItemModalOpen: boolean = false;
  @Input() isRemoveItemModalOpen: boolean = false;
  @Input() selectedItemForEdit: OrderItem | null = null;
  @Input() selectedItemForRemove: OrderItem | null = null;
  @Input() availableItems: AmmunitionReadDto[] = [];
  @Input() loadingItems: boolean = false;
  @Input() savingItem: boolean = false;
  @Input() getItemProductIdFn?: (item: OrderItem) => string;
  @Output() addItemClosed = new EventEmitter<void>();
  @Output() editItemClosed = new EventEmitter<void>();
  @Output() removeItemClosed = new EventEmitter<void>();
  @Output() saveAddItem = new EventEmitter<CreateRequestItemDto>();
  @Output() saveEditItem = new EventEmitter<{ requestItemId: number; quantity: number }>();
  @Output() confirmRemoveItem = new EventEmitter<number>();

  addItemForm!: FormGroup;
  editItemForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.initializeAddItemForm();
    this.initializeEditItemForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedItemForEdit'] && this.selectedItemForEdit) {
      this.initializeEditItemForm(this.selectedItemForEdit);
    }
  }

  private initializeAddItemForm(): void {
    this.addItemForm = this.fb.group({
      itemId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  private initializeEditItemForm(item?: OrderItem): void {
    const minAllowed = Math.max(1, item?.totalSelectedForDischarge || 0);
    this.editItemForm = this.fb.group({
      quantity: [item?.approvedQuantity || 1, [Validators.required, Validators.min(minAllowed)]],
      notes: ['']
    });
  }

  onCloseAddItemModal(): void {
    this.addItemForm.reset();
    this.initializeAddItemForm();
    this.addItemClosed.emit();
  }

  onCloseEditItemModal(): void {
    this.editItemForm.reset();
    this.initializeEditItemForm();
    this.editItemClosed.emit();
  }

  onCloseRemoveItemModal(): void {
    this.removeItemClosed.emit();
  }

  onSaveAddItem(): void {
    if (this.addItemForm.invalid) {
      this.addItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.addItemForm.value;
    const itemDto: CreateRequestItemDto = {
      itemId: formValue.itemId,
      quantity: formValue.quantity,
      notes: formValue.notes || undefined
    };

    this.saveAddItem.emit(itemDto);
  }

  onSaveEditItem(): void {
    if (!this.selectedItemForEdit || this.editItemForm.invalid) {
      this.editItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.editItemForm.value;
    this.saveEditItem.emit({
      requestItemId: this.selectedItemForEdit.requestItemId,
      quantity: formValue.quantity
    });
  }

  onConfirmRemoveItem(): void {
    if (this.selectedItemForRemove) {
      this.confirmRemoveItem.emit(this.selectedItemForRemove.requestItemId);
    }
  }

  readonly itemOptionLabel = (option: DropdownOption<AmmunitionReadDto> | AmmunitionReadDto | null): string => {
    const item = unwrapDropdownOption(option);
    if (!item) {
      return '';
    }
    const localizedName = getLocalizedName(item, getCurrentLang(this.translate));
    return localizedName || item.itemNo || `Item #${item.id}`;
  };

  getItemProductId(item: OrderItem): string {
    if (this.getItemProductIdFn) {
      return this.getItemProductIdFn(item);
    }
    return '-';
  }
}


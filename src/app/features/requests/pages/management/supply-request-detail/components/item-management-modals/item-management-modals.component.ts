/**
 * Item Management Modals Component
 * Handles add, edit, and remove item modals
 */

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Info } from 'lucide-angular';
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
    LucideAngularModule,
    ModalComponent,
    ConfirmDialogComponent,
    DropdownComponent
  ],
  templateUrl: './item-management-modals.component.html',
  styleUrls: ['./item-management-modals.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  @Input() allowedItemTypes: number[] = [1, 3]; // Default to both ammunition and explosives
  @Input() getItemProductIdFn?: (item: OrderItem) => string;
  @Input() canIncreaseQuantity: boolean = true;
  @Input() canDecreaseQuantity: boolean = true;
  @Output() addItemClosed = new EventEmitter<void>();
  @Output() editItemClosed = new EventEmitter<void>();
  @Output() removeItemClosed = new EventEmitter<void>();
  @Output() saveAddItem = new EventEmitter<CreateRequestItemDto>();
  @Output() saveEditItem = new EventEmitter<{ requestItemId: number; quantity: number }>();
  @Output() confirmRemoveItem = new EventEmitter<number>();

  addItemForm!: FormGroup;
  editItemForm!: FormGroup;

  readonly Info = Info;

  constructor(
    private fb: FormBuilder,
    private translate: TranslateService
  ) { }

  ngOnInit(): void {
    this.initializeAddItemForm();
    this.initializeEditItemForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['selectedItemForEdit'] || changes['canIncreaseQuantity'] || changes['canDecreaseQuantity']) && this.selectedItemForEdit) {
      this.initializeEditItemForm(this.selectedItemForEdit);
    }
    
    // Reset add item form when modal opens to prevent showing stale values
    if (changes['isAddItemModalOpen'] && 
        changes['isAddItemModalOpen'].currentValue === true && 
        changes['isAddItemModalOpen'].previousValue === false &&
        this.addItemForm) {
      // Use setTimeout to ensure the form reset happens after Angular's change detection
      setTimeout(() => {
        this.addItemForm.patchValue({
          itemId: null,
          quantity: 1,
          notes: ''
        });
        this.addItemForm.markAsUntouched();
        this.addItemForm.markAsPristine();
      }, 0);
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
    const currentQty = item?.approvedQuantity || 1;
    // Allow reducing below current discharge selections; selections are capped to the new approved qty after save.
    const min = this.canDecreaseQuantity ? 1 : currentQty;
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

  onCloseAddItemModal(): void {
    if (this.addItemForm) {
      this.addItemForm.reset({
        itemId: null,
        quantity: 1,
        notes: ''
      });
      this.addItemForm.markAsUntouched();
      this.addItemForm.markAsPristine();
    }
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
    return '-';
  }

  get editQuantityMin(): number {
    if (!this.selectedItemForEdit) return 1;
    return this.canDecreaseQuantity ? 1 : (this.selectedItemForEdit.approvedQuantity || 1);
  }

  get editQuantityMax(): number | null {
    if (!this.selectedItemForEdit || this.canIncreaseQuantity) return null;
    return this.selectedItemForEdit.approvedQuantity || 1;
  }

  getItemTypeRestrictionMessage(): string {
    // Determine message based on allowed item types
    if (this.allowedItemTypes.length === 1) {
      if (this.allowedItemTypes.includes(1)) {
        // Only ammunition allowed
        return this.translate.instant('supplyRequestDetail.ammunitionOnlyAllowed');
      } else if (this.allowedItemTypes.includes(3)) {
        // Only explosives allowed
        return this.translate.instant('supplyRequestDetail.explosivesOnlyAllowed');
      }
    } else if (this.allowedItemTypes.includes(1) && this.allowedItemTypes.includes(3)) {
      // Both ammunition and explosives allowed
      return this.translate.instant('supplyRequestDetail.ammunitionExplosivesAllowed');
    }
    
    // Default fallback
    return this.translate.instant('supplyRequestDetail.ammunitionExplosivesAllowed');
  }
}


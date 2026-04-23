import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Edit, Trash2 } from 'lucide-angular';
import { ModalComponent } from '@components/modal/modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { RequestDetail } from '@models/workflow-approval.model';
import { OrderItemManagementService } from '@requests/pages/management/supply-request-detail/services/order-item-management.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { WeaponService } from '@assets/services/weapon.service';
import { CreateRequestItemDto } from '@models/request-item.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-weapon-review-items-modal',
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
  templateUrl: './weapon-review-items-modal.component.html',
  styleUrls: ['./weapon-review-items-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponReviewItemsModalComponent implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;

  @Input() isOpen: boolean = false;
  @Input() requestDetail: RequestDetail | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() itemAdded = new EventEmitter<void>();
  @Output() itemUpdated = new EventEmitter<void>();
  @Output() itemDeleted = new EventEmitter<void>();

  // Modal states
  isAddItemModalOpen: boolean = false;
  isEditItemModalOpen: boolean = false;
  isRemoveItemModalOpen: boolean = false;
  selectedItemForEdit: any = null;
  selectedItemForRemove: any = null;
  savingItem: boolean = false;
  availableWeapons: any[] = [];
  loadingWeapons: boolean = false;

  addItemForm!: FormGroup;
  editItemForm!: FormGroup;

  private destroy$ = new Subject<void>();

  constructor(
    private orderItemManagementService: OrderItemManagementService,
    private stateService: WorkflowApprovalStateService,
    private weaponService: WeaponService,
    private fb: FormBuilder,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    if (this.isOpen) {
      this.resetStates();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForms(): void {
    this.addItemForm = this.fb.group({
      itemId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });

    this.editItemForm = this.fb.group({
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  get requestItems() {
    return this.requestDetail?.requestItems || [];
  }

  get orderId(): number | null {
    const state = this.stateService.getState();
    return state.requestId || null;
  }

  onClose(): void {
    this.isOpen = false;
    this.resetStates();
    this.closed.emit();
  }

  resetStates(): void {
    this.isAddItemModalOpen = false;
    this.isEditItemModalOpen = false;
    this.isRemoveItemModalOpen = false;
    this.selectedItemForEdit = null;
    this.selectedItemForRemove = null;
    this.addItemForm.reset();
    this.editItemForm.reset();
    this.initializeForms();
  }

  // Add Weapon
  openAddItemModal(): void {
    this.loadAvailableWeapons();
    this.isAddItemModalOpen = true;
  }

  closeAddItemModal(): void {
    this.isAddItemModalOpen = false;
    this.addItemForm.reset();
    this.initializeForms();
  }

  private loadAvailableWeapons(): void {
    this.loadingWeapons = true;
    const existingItemIds = (this.requestDetail?.requestItems || []).map((item: any) => item.itemId || item.id);

    this.weaponService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (weapons) => {
          // Filter out weapons already in the order
          this.availableWeapons = (weapons || []).filter((weapon: any) => !existingItemIds.includes(weapon.id));
          this.loadingWeapons = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.loadingWeapons = false;
          this.cdr.markForCheck();
        }
      });
  }

  getWeaponOptionLabel(weapon: any): string {
    const currentLang = getCurrentLang(this.translate);
    return getLocalizedName(weapon, currentLang) || weapon.itemNo || `Weapon #${weapon.id}`;
  }

  onSaveAddItem(): void {
    if (this.addItemForm.invalid || !this.orderId) {
      this.addItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.addItemForm.value;
    const itemDto: CreateRequestItemDto = {
      itemId: formValue.itemId,
      quantity: formValue.quantity,
      notes: formValue.notes || undefined
    };

    this.savingItem = true;
    this.orderItemManagementService.addItem(this.orderId, itemDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemAddedSuccessfully');
            this.closeAddItemModal();
            this.itemAdded.emit();
          } else {
            this.orderItemManagementService.showErrorMessage(
              'supplyRequestDetail.failedToAddItem',
              response.message
            );
          }
          this.savingItem = false;
        },
        error: (error) => {
          this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToAddItem');
          this.savingItem = false;
        }
      });
  }

  // Edit Weapon
  openEditItemModal(item: any): void {
    this.selectedItemForEdit = item;
    this.editItemForm.patchValue({
      quantity: item.quantity || 1,
      notes: item.notes || ''
    });
    this.isEditItemModalOpen = true;
  }

  closeEditItemModal(): void {
    this.isEditItemModalOpen = false;
    this.selectedItemForEdit = null;
    this.editItemForm.reset();
    this.initializeForms();
  }

  onSaveEditItem(): void {
    if (this.editItemForm.invalid || !this.orderId || !this.selectedItemForEdit) {
      this.editItemForm.markAllAsTouched();
      return;
    }

    const formValue = this.editItemForm.value;
    const requestItemId = this.selectedItemForEdit.requestItemId || this.selectedItemForEdit.id;

    this.savingItem = true;
    this.orderItemManagementService.updateItemQuantity(this.orderId, requestItemId, formValue.quantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemQuantityUpdatedSuccessfully');
            this.closeEditItemModal();
            this.itemUpdated.emit();
          } else {
            this.orderItemManagementService.showErrorMessage(
              'supplyRequestDetail.failedToUpdateItemQuantity',
              response.message
            );
          }
          this.savingItem = false;
        },
        error: (error) => {
          this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToUpdateItemQuantity');
          this.savingItem = false;
        }
      });
  }

  // Remove Weapon
  openRemoveItemModal(item: any): void {
    this.selectedItemForRemove = item;
    this.isRemoveItemModalOpen = true;
  }

  closeRemoveItemModal(): void {
    this.isRemoveItemModalOpen = false;
    this.selectedItemForRemove = null;
  }

  onConfirmRemoveItem(): void {
    if (!this.orderId || !this.selectedItemForRemove) return;

    const requestItemId = this.selectedItemForRemove.requestItemId || this.selectedItemForRemove.id;

    this.orderItemManagementService.removeItem(this.orderId, requestItemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.succeeded) {
            this.orderItemManagementService.showSuccessMessage('supplyRequestDetail.itemRemovedSuccessfully');
            this.closeRemoveItemModal();
            this.itemDeleted.emit();
          } else {
            this.orderItemManagementService.showErrorMessage(
              'supplyRequestDetail.failedToRemoveItem',
              response.message
            );
          }
        },
        error: (error) => {
          this.orderItemManagementService.showErrorMessage('supplyRequestDetail.failedToRemoveItem');
        }
      });
  }

  getItemProductId(item: any): string {
    return item.itemNo || item.productId || '-';
  }

  getItemNSN(item: any): string {
    return item.nsn || '-';
  }
}

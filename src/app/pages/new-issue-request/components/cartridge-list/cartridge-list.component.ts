import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { OrderService } from '@services/order.service';
import { ConfigService } from '@services/config.service';

export interface Cartridge {
  id: number;
  name: string;
  nameAr?: string; // Arabic name
  nameEn?: string; // English name
  selected: boolean;
  itemNo?: string;
  productId?: string;
  ncn?: string;
  primaryPurpose?: string;
  projectileColor?: string;
  totalWeight?: string;
  projectileMaterial?: string;
  caseType?: string;
  primer?: string;
  propellant?: string;
  hazardDivision?: string;
  capabilityGroup?: string;
  bulletDiameterLabel?: string;
  linkedLabel?: string;
  linkedLabelAr?: string; // Arabic linked label
  linkedLabelEn?: string; // English linked label
  natureLabel?: string;
  natureLabelAr?: string; // Arabic nature label
  natureLabelEn?: string; // English nature label
  quantity?: number | null;
  added?: boolean;
  ammunitionType?: string | number; // Backend returns as string: "Small", "Medium", "Large"
  armNumber?: string;

  // Weapon Specific
  weaponType?: string;
  caliber?: string;
  actionType?: string;
  barrelLength?: number;

  // Explosive Specific
  explosiveType?: string;
  unNumber?: string;
  netExplosiveQuantity?: number;
}

@Component({
  selector: 'app-cartridge-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, DropdownComponent],
  templateUrl: './cartridge-list.component.html',
  styleUrls: ['./cartridge-list.component.css']
})
export class CartridgeListComponent {
  @Input() cartridges: Cartridge[] = [];

  // Filter Options
  @Input() itemTypeOptions: string[] = [];

  // Ammunition Options
  @Input() ammunitionTypeOptions: string[] = [];
  @Input() bulletDiameters: string[] = [];
  @Input() linkedOptions: string[] = [];
  @Input() natureOptions: string[] = [];

  // Weapon Options
  @Input() weaponTypeOptions: string[] = [];
  @Input() caliberOptions: string[] = []; // If we have predefined calibers

  // Explosive Options
  @Input() explosiveTypeOptions: string[] = [];

  // Selected Values
  @Input() selectedItemType: string = '';

  // Ammunition Selections
  @Input() selectedAmmunitionType: string = '';
  @Input() selectedBulletDiameter: string = '';
  @Input() selectedLinked: string = '';
  @Input() selectedNature: string = '';

  // Weapon Selections
  @Input() selectedWeaponType: string = '';
  @Input() selectedCaliber: string = '';

  // Explosive Selections
  @Input() selectedExplosiveType: string = '';
  @Input() selectedUNNumber: string = ''; // Similar to NSN search

  @Input() selectedNSN: string = '';
  @Input() canProceed: boolean = false;
  @Input() fromReserve: string = 'No'; // 'Yes' or 'No'

  @Output() cartridgeClick = new EventEmitter<Cartridge>();
  @Output() allowanceError = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();

  // Filter Change Outputs
  @Output() itemTypeChange = new EventEmitter<string>();

  @Output() ammunitionTypeChange = new EventEmitter<string>();
  @Output() bulletDiameterChange = new EventEmitter<string>();
  @Output() linkedChange = new EventEmitter<string>();
  @Output() natureChange = new EventEmitter<string>();

  @Output() weaponTypeChange = new EventEmitter<string>();
  @Output() caliberChange = new EventEmitter<string>();

  @Output() explosiveTypeChange = new EventEmitter<string>();
  @Output() unNumberChange = new EventEmitter<string>();

  @Output() nsnChange = new EventEmitter<string>();
  @Output() addSelection = new EventEmitter<{ cartridge: Cartridge; quantity: number }>();
  @Output() removeSelection = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();

  pendingCartridgeId: number | null = null;
  pendingQuantity: number = 1;
  searchTerm: string = '';
  verifyingAllowance: boolean = false;
  allowanceErrorMessage: string | null = null;

  constructor(
    private orderService: OrderService,
    private config: ConfigService
  ) { }

  onCartridgeClick(cartridge: Cartridge): void {
    this.cartridgeClick.emit(cartridge);
  }

  beginSelection(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pendingCartridgeId = cartridge.id;
    this.pendingQuantity = cartridge.quantity && cartridge.quantity > 0 ? cartridge.quantity : 1;
  }

  updatePendingQuantity(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const parsed = value ? parseInt(value, 10) : 1;
    this.pendingQuantity = parsed > 0 ? parsed : 1;
    // Clear error when quantity changes
    this.allowanceErrorMessage = null;
  }

  confirmAdd(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    const quantity = this.pendingQuantity > 0 ? this.pendingQuantity : 1;
    this.allowanceErrorMessage = null;

    // If "From Allowance" is selected, verify allowance before confirming
    if (this.fromReserve === 'Yes') {
      this.verifyingAllowance = true;
      this.orderService.verifyAllowance(cartridge.id, quantity).subscribe({
        next: (result) => {
          this.verifyingAllowance = false;

          if (!result.isValid) {
            // Quantity exceeds available allowance
            const errorMsg = result.message ||
              `Requested quantity (${quantity}) exceeds available allowance. Available: ${result.availableQuantity}`;
            this.allowanceErrorMessage = errorMsg;
            this.allowanceError.emit(errorMsg);
            return; // Don't confirm, show error
          }

          // Quantity is valid, proceed with confirmation
          this.proceedWithConfirmation(cartridge, quantity);
        },
        error: (error) => {
          this.verifyingAllowance = false;
          const errorMsg = error?.message || 'Failed to verify allowance. Please try again.';
          this.allowanceErrorMessage = errorMsg;
          this.allowanceError.emit(errorMsg);
        }
      });
    } else {
      // Not from allowance, proceed directly
      this.proceedWithConfirmation(cartridge, quantity);
    }
  }

  private proceedWithConfirmation(cartridge: Cartridge, quantity: number): void {
    cartridge.quantity = quantity;
    cartridge.added = true;
    cartridge.selected = true;
    this.addSelection.emit({ cartridge, quantity });
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
    this.allowanceErrorMessage = null;
  }

  removePending(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    cartridge.quantity = null;
    cartridge.added = false;
    cartridge.selected = false;
    this.removeSelection.emit(cartridge.id);
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
  }

  cancelSelection(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
    this.allowanceErrorMessage = null;
    this.verifyingAllowance = false;
  }

  onFilterChange(): void {
    this.filterChange.emit();
  }

  onConfirmSelection(): void {
    this.confirmSelection.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onPrevious(): void {
    this.previous.emit();
  }

  onClear(): void {
    this.clearFilters.emit();
  }

  onItemTypeChange(value: string): void {
    this.itemTypeChange.emit(value);
    this.onFilterChange();
  }

  onAmmunitionTypeChange(value: string): void {
    this.ammunitionTypeChange.emit(value);
    this.onFilterChange();
  }

  onBulletDiameterChange(value: string): void {
    this.bulletDiameterChange.emit(value);
    this.onFilterChange();
  }

  onLinkedChange(value: string): void {
    this.linkedChange.emit(value);
    this.onFilterChange();
  }

  onNatureChange(value: string): void {
    this.natureChange.emit(value);
    this.onFilterChange();
  }

  onWeaponTypeChange(value: string): void {
    this.weaponTypeChange.emit(value);
    this.onFilterChange();
  }

  onCaliberChange(value: string): void {
    this.caliberChange.emit(value);
    this.onFilterChange();
  }

  onExplosiveTypeChange(value: string): void {
    this.explosiveTypeChange.emit(value);
    this.onFilterChange();
  }

  onUnNumberChange(value: string): void {
    this.unNumberChange.emit(value);
    this.onFilterChange();
  }

  onNSNChange(value: string): void {
    this.nsnChange.emit(value);
    this.onFilterChange();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChange.emit(value);
  }
}

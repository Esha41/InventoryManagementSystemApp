import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';

export interface Cartridge {
  id: number;
  name: string;
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
  caseLengthLabel?: string;
  linkedLabel?: string;
  natureLabel?: string;
  quantity?: number | null;
  added?: boolean;
  ammunitionType?: number; // 1 = Small, 2 = Medium, 3 = Large
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
  @Input() itemTypeOptions: string[] = [];
  @Input() ammunitionTypeOptions: string[] = [];
  @Input() bulletDiameters: string[] = [];
  @Input() caseLengths: string[] = [];
  @Input() linkedOptions: string[] = [];
  @Input() natureOptions: string[] = [];
  @Input() selectedItemType: string = '';
  @Input() selectedAmmunitionType: string = '';
  @Input() selectedBulletDiameter: string = '';
  @Input() selectedCaseLength: string = '';
  @Input() selectedLinked: string = '';
  @Input() selectedNature: string = '';
  @Input() canProceed: boolean = false;

  @Output() cartridgeClick = new EventEmitter<Cartridge>();
  @Output() filterChange = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() itemTypeChange = new EventEmitter<string>();
  @Output() ammunitionTypeChange = new EventEmitter<string>();
  @Output() bulletDiameterChange = new EventEmitter<string>();
  @Output() caseLengthChange = new EventEmitter<string>();
  @Output() linkedChange = new EventEmitter<string>();
  @Output() natureChange = new EventEmitter<string>();
  @Output() addSelection = new EventEmitter<{ cartridge: Cartridge; quantity: number }>();
  @Output() removeSelection = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();

  pendingCartridgeId: number | null = null;
  pendingQuantity: number = 1;
  searchTerm: string = '';

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
  }

  confirmAdd(cartridge: Cartridge, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const quantity = this.pendingQuantity > 0 ? this.pendingQuantity : 1;
    cartridge.quantity = quantity;
    cartridge.added = true;
    cartridge.selected = true;
    this.addSelection.emit({ cartridge, quantity });
    this.pendingCartridgeId = null;
    this.pendingQuantity = 1;
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

  onCaseLengthChange(value: string): void {
    this.caseLengthChange.emit(value);
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

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChange.emit(value);
  }
}


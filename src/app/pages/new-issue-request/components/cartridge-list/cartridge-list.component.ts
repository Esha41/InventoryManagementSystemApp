import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';

export interface Cartridge {
  name: string;
  selected: boolean;
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
}

@Component({
  selector: 'app-cartridge-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent],
  templateUrl: './cartridge-list.component.html',
  styleUrls: ['./cartridge-list.component.css']
})
export class CartridgeListComponent {
  @Input() cartridges: Cartridge[] = [];
  @Input() bulletDiameters: string[] = [];
  @Input() caseLengths: string[] = [];
  @Input() linkedOptions: string[] = [];
  @Input() natureOptions: string[] = [];
  @Input() orderPriorities: string[] = [];
  @Input() selectedBulletDiameter: string = '';
  @Input() selectedCaseLength: string = '';
  @Input() selectedLinked: string = '';
  @Input() selectedNature: string = '';
  @Input() selectedPriority: string = '';
  @Input() quantity: number | null = null;

  @Output() cartridgeClick = new EventEmitter<Cartridge>();
  @Output() filterChange = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() bulletDiameterChange = new EventEmitter<string>();
  @Output() caseLengthChange = new EventEmitter<string>();
  @Output() linkedChange = new EventEmitter<string>();
  @Output() natureChange = new EventEmitter<string>();
  @Output() priorityChange = new EventEmitter<string>();
  @Output() quantityChange = new EventEmitter<number | null>();

  onCartridgeClick(cartridge: Cartridge): void {
    this.cartridgeClick.emit(cartridge);
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

  onClear(): void {
    this.clearFilters.emit();
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

  onPriorityChange(value: string): void {
    this.priorityChange.emit(value);
  }

  onQuantityChange(value: number | null): void {
    this.quantityChange.emit(value);
  }
}


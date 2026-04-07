import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, X, FunnelX } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@models/lookup.model';
import { CardComponent } from '@components/card/card.component';

@Component({
  selector: 'app-inventory-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    CardComponent
  ],
  templateUrl: './inventory-filters.component.html',
  styleUrls: ['./inventory-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryFiltersComponent {
  @Input() searchControl: FormControl<string> = new FormControl<string>('', { nonNullable: true });
  /** When true, show supplier and manufacturer dropdowns (ammo / explosives inventory). */
  @Input() showSupplierManufacturerFilters = false;
  @Input() supplierFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() manufacturerFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  /** Shown with supplier/manufacturer on ammunition & explosives depot inventory. */
  @Input() primaryPurposeFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() suppliers: LookupItem[] = [];
  @Input() manufacturers: LookupItem[] = [];
  @Input() primaryPurposes: LookupItem[] = [];
  @Input() supplierOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() manufacturerOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() primaryPurposeOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  /** i18n key for the search input placeholder (e.g. `common.search` for weapons tab). */
  @Input() searchPlaceholderKey = 'warehouseInventory.searchPlaceholder';

  @Output() searchTriggered = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();

  readonly Search = Search;
  readonly X = X;
  readonly FunnelX = FunnelX;

  onSearchClick(): void {
    this.searchTriggered.emit();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.searchTriggered.emit();
  }

  onClearFilters(): void {
    this.clearFilters.emit();
  }
}


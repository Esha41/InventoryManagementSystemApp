import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { LookupItem } from '@models/lookup.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { InventoryFiltersComponent } from './components/inventory-filters/inventory-filters.component';

@Component({
  selector: 'app-warehouse-inventory-filters',
  standalone: true,
  imports: [InventoryFiltersComponent],
  template: `
    <app-inventory-filters
      [searchControl]="searchControl"
      [searchPlaceholderKey]="searchPlaceholderKey"
      [showSupplierManufacturerFilters]="showSupplierManufacturerFilters"
      [supplierFilterControl]="supplierFilterControl"
      [manufacturerFilterControl]="manufacturerFilterControl"
      [primaryPurposeFilterControl]="primaryPurposeFilterControl"
      [suppliers]="suppliers"
      [manufacturers]="manufacturers"
      [primaryPurposes]="primaryPurposes"
      [supplierOptionLabelFn]="supplierOptionLabelFn"
      [manufacturerOptionLabelFn]="manufacturerOptionLabelFn"
      [primaryPurposeOptionLabelFn]="primaryPurposeOptionLabelFn"
      [showBatchFilters]="showBatchFilters"
      [batchItems]="batchItems"
      [batchItemFilterControl]="batchItemFilterControl"
      [batchSupplierFilterControl]="batchSupplierFilterControl"
      [batchManufacturerFilterControl]="batchManufacturerFilterControl"
      [batchPrimaryPurposeFilterControl]="batchPrimaryPurposeFilterControl"
      [batchItemOptionLabelFn]="batchItemOptionLabelFn"
      [batchSupplierOptionLabelFn]="batchSupplierOptionLabelFn"
      [batchManufacturerOptionLabelFn]="batchManufacturerOptionLabelFn"
      [batchPrimaryPurposeOptionLabelFn]="batchPrimaryPurposeOptionLabelFn"
      (searchTriggered)="searchTriggered.emit()"
      (clearFilters)="clearFilters.emit()"
      (applyBatchFilters)="applyBatchFilters.emit()">
    </app-inventory-filters>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WarehouseInventoryFiltersComponent {
  @Input() searchControl: FormControl<string> = new FormControl<string>('', { nonNullable: true });
  @Input() searchPlaceholderKey = 'warehouseInventory.searchPlaceholder';
  @Input() showSupplierManufacturerFilters = false;
  @Input() supplierFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() manufacturerFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() primaryPurposeFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() suppliers: LookupItem[] = [];
  @Input() manufacturers: LookupItem[] = [];
  @Input() primaryPurposes: LookupItem[] = [];
  @Input() supplierOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() manufacturerOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() primaryPurposeOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';

  @Input() showBatchFilters = false;
  @Input() batchItems: LookupItem[] = [];
  @Input() batchItemFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchSupplierFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchManufacturerFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchPrimaryPurposeFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchItemOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() batchSupplierOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() batchManufacturerOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() batchPrimaryPurposeOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';

  @Output() searchTriggered = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() applyBatchFilters = new EventEmitter<void>();
}

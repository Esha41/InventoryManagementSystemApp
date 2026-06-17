import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Search, X, FunnelX, ChevronDown } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@models/lookup.model';
import { CardComponent } from '@components/card/card.component';
import { AssetColumnFilters } from '@models/asset-list.model';
import { WarehouseInventoryTab } from '@warehouse/services/warehouse-inventory.store';
import { getLookupDropdownLabel, filterRenderableLookupItems } from '@utils/asset-list.utils';
import { unwrapDropdownOption } from '@utils/dropdown.utils';
import { INVENTORY_FILTERS_MORE_FILTER_TEXT_INPUT_CLASS } from './inventory-filters.ui-classes';

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
  private readonly translateService = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() activeTab: WarehouseInventoryTab = 'ammunition';
  @Input() columnFilters!: AssetColumnFilters;
  @Input() searchControl: FormControl<string> = new FormControl<string>('', { nonNullable: true });
  /** When true, show supplier and manufacturer dropdowns (ammo / explosives inventory). */
  @Input() showSupplierManufacturerFilters = false;
  /** When true, show caliber dropdown on ammunition inventory tab. */
  @Input() showCaliberFilter = false;
  @Input() caliberFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() calibersAmmunition: LookupItem[] = [];
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

  /** When true, show batch-specific multi-select filters (item, supplier, manufacturer, primary purpose). */
  @Input() showBatchFilters = false;
  @Input() batchItems: LookupItem[] = [];
  @Input() batchItemFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchSupplierFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchManufacturerFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchPrimaryPurposeFilterControl: FormControl<number[]> = new FormControl<number[]>([], { nonNullable: true });
  @Input() batchCaliberFilterControl: FormControl<number | null> = new FormControl<number | null>(null);
  @Input() calibersWeapon: LookupItem[] = [];
  @Input() batchItemOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() batchSupplierOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() batchManufacturerOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';
  @Input() batchPrimaryPurposeOptionLabelFn: (option: DropdownOption<LookupItem> | LookupItem | null) => string = () => '';

  @Output() searchTriggered = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  /** Batch tab: explicit apply for item/supplier/manufacturer/primary-purpose filters (server request). */
  @Output() applyBatchFilters = new EventEmitter<void>();
  @Output() applyAdditionalColumnFilters = new EventEmitter<void>();

  readonly Search = Search;
  readonly X = X;
  readonly FunnelX = FunnelX;
  readonly ChevronDown = ChevronDown;
  readonly moreFilterInputClass = INVENTORY_FILTERS_MORE_FILTER_TEXT_INPUT_CLASS;

  showMoreFilters = false;

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) =>
    getLookupDropdownLabel(unwrapDropdownOption(option), this.translateService);

  get calibersAmmunitionForFilter(): LookupItem[] {
    return filterRenderableLookupItems(this.calibersAmmunition, this.translateService);
  }

  get calibersWeaponForFilter(): LookupItem[] {
    return filterRenderableLookupItems(this.calibersWeapon, this.translateService);
  }

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

  onApplyBatchFiltersClick(): void {
    this.applyBatchFilters.emit();
  }

  toggleMoreFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
    this.cdr.markForCheck();
  }

  applyColumnFilters(): void {
    this.applyAdditionalColumnFilters.emit();
    this.cdr.markForCheck();
  }

  onColumnFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyColumnFilters();
    }
  }
}


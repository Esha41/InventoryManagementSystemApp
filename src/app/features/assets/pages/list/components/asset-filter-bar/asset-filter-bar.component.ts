/**
 * Asset Filter Bar Component
 * Reusable filter bar for asset list filtering
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Search, FilterX, X, ChevronDown } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { AssetType, AssetFilterState } from '@models/asset-list.model';
import { LookupItem } from '@models/lookup.model';
import { AssetFilterOptions } from '../../models/asset-filter-options.model';
import { getLookupDropdownLabel, filterRenderableLookupItems } from '@utils/asset-list.utils';
import { unwrapDropdownOption } from '@utils/dropdown.utils';
import { ASSET_LIST_MORE_FILTER_TEXT_INPUT_CLASS } from './asset-filter-bar.ui-classes';

@Component({
  selector: 'app-asset-filter-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    CardComponent,
    DropdownComponent
  ],
  templateUrl: './asset-filter-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetFilterBarComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translateService = inject(TranslateService);

  @Input() activeTab: AssetType = 'ammunition';
  @Input() filterState!: AssetFilterState;
  @Input() isRTL = false;
  @Input() filterOptions!: AssetFilterOptions;

  @Output() filterChange = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() searchTriggered = new EventEmitter<string>();
  @Output() searchCleared = new EventEmitter<void>();

  readonly Search = Search;
  readonly FilterX = FilterX;
  readonly X = X;
  readonly ChevronDown = ChevronDown;

  readonly moreFilterInputClass = ASSET_LIST_MORE_FILTER_TEXT_INPUT_CLASS;

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) =>
    getLookupDropdownLabel(unwrapDropdownOption(option), this.translateService);

  get calibersAmmunitionForFilter(): LookupItem[] {
    return filterRenderableLookupItems(this.filterOptions?.calibersAmmunition, this.translateService);
  }

  get calibersWeaponForFilter(): LookupItem[] {
    return filterRenderableLookupItems(this.filterOptions?.calibersWeapon, this.translateService);
  }

  showMoreFilters = false;

  onFilterChange(): void {
    this.filterChange.emit();
    this.cdr.markForCheck();
  }

  onSearchClick(): void {
    this.searchTriggered.emit(this.filterState.searchTerm || '');
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchCleared.emit();
  }

  onClearFilters(): void {
    this.clearFilters.emit();
  }

  toggleMoreFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
    this.cdr.markForCheck();
  }

  applyColumnFilters(): void {
    this.filterChange.emit();
    this.cdr.markForCheck();
  }

  onColumnFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyColumnFilters();
    }
  }

}

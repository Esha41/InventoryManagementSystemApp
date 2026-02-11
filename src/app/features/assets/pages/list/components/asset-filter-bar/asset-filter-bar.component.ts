/**
 * Asset Filter Bar Component
 * Reusable filter bar for asset list filtering
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, FilterX, X } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { AssetType, AssetFilterState } from '@models/asset-list.model';

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
  styleUrls: ['./asset-filter-bar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetFilterBarComponent {
  constructor(private cdr: ChangeDetectorRef) { }
  @Input() activeTab: AssetType = 'ammunition';
  @Input() filterState!: AssetFilterState;
  @Input() isRTL = false;

  // Filter options
  @Input() caseTypeFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() hazardDivisionFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() compatibilityFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() weaponTypeFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() weaponClassificationFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() countryFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() explosiveTypeFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() explosiveClassificationFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() explosiveHazardDivisionFilterOptions: Array<{ label: string; value: number }> = [];
  @Input() explosiveCompatibilityFilterOptions: Array<{ label: string; value: number }> = [];

  @Output() filterChange = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() searchTriggered = new EventEmitter<string>();

  readonly Search = Search;
  readonly FilterX = FilterX;
  readonly X = X;

  onFilterChange(): void {
    this.filterChange.emit();
    this.cdr.markForCheck();
  }

  onSearchClick(): void {
    this.searchTriggered.emit(this.filterState.searchTerm || '');
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.filterState.searchTerm = '';
    this.onSearchClick();
  }

  onClearFilters(): void {
    this.clearFilters.emit();
  }
}

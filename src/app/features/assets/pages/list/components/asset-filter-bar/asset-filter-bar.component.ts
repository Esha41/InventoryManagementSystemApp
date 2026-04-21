/**
 * Asset Filter Bar Component
 * Reusable filter bar for asset list filtering
 */

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, FilterX, X, ChevronDown } from 'lucide-angular';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { AssetType, AssetFilterState } from '@models/asset-list.model';
import { AssetFilterOptions } from '../../models/asset-filter-options.model';

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
  private readonly cdr = inject(ChangeDetectorRef);

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

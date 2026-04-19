import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Search, ArrowUp, ArrowDown, ArrowUpDown, Pencil } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { FocusOnInitDirective } from '@core/directives/focus-on-init.directive';
import { AssetSelectionService, SelectedAsset, AssetFilterState, AssetPaginationState } from '../../services/asset-selection.service';
import { formatNumber as formatNumberUtil } from '@utils/format.utils';
import { defaultPageSize } from '@constants/app.constants';

/**
 * Item asset selection component
 * Handles the display and selection of assets for a single item
 */
@Component({
  selector: 'app-item-asset-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    PaginationComponent,
    RowsPerPageComponent,
    FocusOnInitDirective
  ],
  templateUrl: './item-asset-selection.component.html',
  styleUrls: ['./item-asset-selection.component.css']
})
export class ItemAssetSelectionComponent implements OnInit, OnChanges {
  @Input() assets: SelectedAsset[] = [];
  @Input() requestedQuantity: number = 0;
  @Input() selectedCount: number = 0;
  @Input() defaultCustodianId: number | undefined;
  @Input() employeeDropdownOptions: DropdownOption<number>[] = [];
  @Input() loadingEmployees: boolean = false;
  @Input() addEmployeeActionLabel?: string;

  @Output() assetSelectionChange = new EventEmitter<{ asset: SelectedAsset; selected: boolean }>();
  @Output() bulkSelectChange = new EventEmitter<number>();
  @Output() custodianChange = new EventEmitter<{ asset: SelectedAsset; custodianId: number }>();
  @Output() notesChange = new EventEmitter<{ asset: SelectedAsset; notes: string }>();
  @Output() serialNumberChange = new EventEmitter<{ asset: SelectedAsset; serialNumber: string }>();
  @Output() addEmployeeClick = new EventEmitter<void>();

  // Icons
  readonly Search = Search;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly ArrowUpDown = ArrowUpDown;
  readonly Pencil = Pencil;

  /** Asset ID currently in edit mode for serial number */
  editingSerialAssetId: number | null = null;
  /** Local value while editing (avoids OnPush/immutability issues) */
  editingSerialValue: string = '';

  // Filter and sort state
  filterState: AssetFilterState = {
    searchTerm: '',
    sortColumn: null,
    sortDirection: 'asc'
  };

  // Pagination state
  paginationState: AssetPaginationState = {
    currentPage: 1,
    rowsPerPage: defaultPageSize,
    totalPages: 1
  };

  // Computed properties
  filteredAssets: SelectedAsset[] = [];
  paginatedAssets: SelectedAsset[] = [];
  bulkSelectCount: number = 0;

  constructor(
    private assetSelectionService: AssetSelectionService,
    public translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.updateFilteredAndPaginatedAssets();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['assets'] || changes['selectedCount']) {
      this.updateFilteredAndPaginatedAssets();
    }
  }

  /**
   * Update filtered and paginated assets
   */
  private updateFilteredAndPaginatedAssets(): void {
    this.filteredAssets = this.assetSelectionService.getFilteredAndSortedAssets(
      this.assets,
      this.filterState
    );

    const totalItems = this.filteredAssets.length;
    this.paginationState = this.assetSelectionService.calculatePaginationState(
      totalItems,
      this.paginationState.currentPage,
      this.paginationState.rowsPerPage
    );

    this.paginatedAssets = this.assetSelectionService.paginateAssets(
      this.filteredAssets,
      this.paginationState
    );
  }

  /**
   * Handle search change
   */
  onSearchChange(searchTerm: string): void {
    this.filterState.searchTerm = searchTerm;
    this.paginationState.currentPage = 1; // Reset to first page
    this.updateFilteredAndPaginatedAssets();
  }

  /**
   * Handle sort toggle
   */
  toggleSort(column: 'serialNumber'): void {
    if (this.filterState.sortColumn === column) {
      this.filterState.sortDirection = this.filterState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.filterState.sortColumn = column;
      this.filterState.sortDirection = 'asc';
    }
    this.updateFilteredAndPaginatedAssets();
  }

  /**
   * Get sort icon
   */
  getSortIcon(column: 'serialNumber'): typeof ArrowUp | typeof ArrowDown | typeof ArrowUpDown {
    if (this.filterState.sortColumn !== column) {
      return ArrowUpDown;
    }
    return this.filterState.sortDirection === 'asc' ? ArrowUp : ArrowDown;
  }

  /**
   * Handle asset selection toggle
   */
  onAssetToggle(asset: SelectedAsset, selected: boolean): void {
    this.assetSelectionChange.emit({ asset, selected });
    // Update pagination after selection changes
    setTimeout(() => this.updateFilteredAndPaginatedAssets(), 0);
  }

  /**
   * Handle select all toggle - works with filtered assets
   */
  onSelectAllToggle(checked: boolean): void {
    if (checked) {
      // Select all filtered assets that can be selected
      const selectableAssets = this.filteredAssets.filter(a => 
        !a.selected && this.selectedCount < this.requestedQuantity
      );
      const toSelect = Math.min(
        selectableAssets.length,
        this.requestedQuantity - this.selectedCount
      );
      selectableAssets.slice(0, toSelect).forEach(asset => {
        asset.selected = true;
        asset.custodianId = this.defaultCustodianId;
        this.assetSelectionChange.emit({ asset, selected: true });
      });
    } else {
      // Deselect all selected filtered assets
      this.filteredAssets.filter(a => a.selected).forEach(asset => {
        asset.selected = false;
        this.assetSelectionChange.emit({ asset, selected: false });
      });
    }
    // Update pagination after selection changes
    this.updateFilteredAndPaginatedAssets();
  }

  /**
   * Handle bulk select apply
   */
  applyBulkSelect(): void {
    const count = Math.min(
      Math.max(0, this.bulkSelectCount || 0),
      this.requestedQuantity,
      this.assets.length
    );
    this.bulkSelectChange.emit(count);
    // Update pagination after bulk selection
    setTimeout(() => this.updateFilteredAndPaginatedAssets(), 0);
  }

  /**
   * Handle pagination page change
   */
  onPageChange(page: number): void {
    this.paginationState.currentPage = page;
    this.updateFilteredAndPaginatedAssets();
  }

  /**
   * Handle rows per page change
   */
  onRowsPerPageChange(rowsPerPage: number): void {
    this.paginationState.rowsPerPage = rowsPerPage;
    this.paginationState.currentPage = 1;
    this.updateFilteredAndPaginatedAssets();
  }

  /**
   * Handle custodian change
   */
  onCustodianChange(asset: SelectedAsset, custodianId: number): void {
    this.custodianChange.emit({ asset, custodianId });
  }

  /**
   * Handle notes change
   */
  onNotesChange(asset: SelectedAsset, notes: string): void {
    this.notesChange.emit({ asset, notes });
  }

  startEditingSerial(asset: SelectedAsset): void {
    this.editingSerialAssetId = asset.id;
    this.editingSerialValue = asset.serialNumber ?? '';
  }

  onSerialNumberSave(asset: SelectedAsset): void {
    const value = this.editingSerialValue.trim();
    this.serialNumberChange.emit({ asset, serialNumber: value });
    this.editingSerialAssetId = null;
    this.editingSerialValue = '';
  }

  cancelEditingSerial(): void {
    this.editingSerialAssetId = null;
    this.editingSerialValue = '';
  }

  trackByAssetId(_index: number, asset: SelectedAsset): number {
    return asset.id;
  }

  /**
   * Check if all filtered assets are selected
   */
  areAllSelected(): boolean {
    return this.assetSelectionService.areAllFilteredAssetsSelected(
      this.filteredAssets,
      this.selectedCount,
      this.requestedQuantity
    );
  }

  /**
   * Check if some filtered assets are selected
   */
  areSomeSelected(): boolean {
    return this.assetSelectionService.areSomeFilteredAssetsSelected(
      this.filteredAssets,
      this.selectedCount,
      this.requestedQuantity
    );
  }

  /**
   * Check if all filtered assets are disabled
   */
  areAllDisabled(): boolean {
    return this.assetSelectionService.areAllFilteredAssetsDisabled(
      this.filteredAssets,
      this.selectedCount,
      this.requestedQuantity
    );
  }

  /**
   * Get pagination start index
   */
  getPaginationStartIndex(): number {
    return this.assetSelectionService.getPaginationStartIndex(
      this.paginationState,
      this.filteredAssets.length
    );
  }

  /**
   * Get pagination end index
   */
  getPaginationEndIndex(): number {
    return this.assetSelectionService.getPaginationEndIndex(
      this.paginationState,
      this.filteredAssets.length
    );
  }

  /**
   * Get max selectable count
   */
  getMaxSelectableCount(): number {
    return Math.min(this.requestedQuantity, this.assets.length);
  }

  /**
   * Format number utility
   */
  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }
}

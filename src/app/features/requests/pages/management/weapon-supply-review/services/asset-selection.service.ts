import { Injectable } from '@angular/core';

/**
 * Selected asset with custodian assignment
 */
export interface SelectedAsset {
  id: number;
  assetId: number;
  serialNumber?: string;
  assetTag?: string;
  condition?: string;
  selected: boolean;
  custodianId?: number;
  conditionOnSupply?: string;
  notes?: string;
  depot?: {
    id: number;
    nameEn?: string;
    nameAr?: string;
  };
}

/**
 * Asset pagination state
 */
export interface AssetPaginationState {
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
}

/**
 * Asset filter and sort state
 */
export interface AssetFilterState {
  searchTerm: string;
  sortColumn: 'serialNumber' | null;
  sortDirection: 'asc' | 'desc';
}

/**
 * Service for handling asset selection, filtering, sorting, and pagination
 */
@Injectable({
  providedIn: 'root'
})
export class AssetSelectionService {

  /**
   * Filter assets based on search term
   */
  filterAssets(assets: SelectedAsset[], searchTerm: string): SelectedAsset[] {
    if (!searchTerm.trim()) {
      return assets;
    }

    const searchLower = searchTerm.toLowerCase();
    return assets.filter(asset =>
      asset.serialNumber?.toLowerCase().includes(searchLower)
    );
  }

  /**
   * Sort assets by column
   */
  sortAssets(assets: SelectedAsset[], column: 'serialNumber' | null, direction: 'asc' | 'desc'): SelectedAsset[] {
    if (!column) {
      return assets;
    }

    const sorted = [...assets].sort((a, b) => {
      const aValue = a.serialNumber || '';
      const bValue = b.serialNumber || '';
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  /**
   * Get filtered and sorted assets
   */
  getFilteredAndSortedAssets(
    assets: SelectedAsset[],
    filterState: AssetFilterState
  ): SelectedAsset[] {
    let result = this.filterAssets(assets, filterState.searchTerm);
    result = this.sortAssets(result, filterState.sortColumn, filterState.sortDirection);
    return result;
  }

  /**
   * Paginate assets
   */
  paginateAssets(assets: SelectedAsset[], paginationState: AssetPaginationState): SelectedAsset[] {
    const { currentPage, rowsPerPage } = paginationState;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return assets.slice(startIndex, endIndex);
  }

  /**
   * Calculate pagination state
   */
  calculatePaginationState(
    totalItems: number,
    currentPage: number,
    rowsPerPage: number
  ): AssetPaginationState {
    const totalPages = Math.ceil(totalItems / rowsPerPage);

    // Ensure current page is valid
    let validPage = currentPage;
    if (validPage > totalPages && totalPages > 0) {
      validPage = totalPages;
    }
    if (validPage < 1) {
      validPage = 1;
    }

    return {
      currentPage: validPage,
      rowsPerPage,
      totalPages
    };
  }

  /**
   * Get pagination start index (1-based)
   */
  getPaginationStartIndex(paginationState: AssetPaginationState, totalItems: number): number {
    if (totalItems === 0) return 0;
    return (paginationState.currentPage - 1) * paginationState.rowsPerPage + 1;
  }

  /**
   * Get pagination end index (1-based)
   */
  getPaginationEndIndex(paginationState: AssetPaginationState, totalItems: number): number {
    return Math.min(
      paginationState.currentPage * paginationState.rowsPerPage,
      totalItems
    );
  }

  /**
   * Check if all filtered assets are selected or disabled
   */
  areAllFilteredAssetsSelected(
    filteredAssets: SelectedAsset[],
    selectedCount: number,
    requestedQuantity: number
  ): boolean {
    if (filteredAssets.length === 0) return false;
    return filteredAssets.every(a =>
      a.selected || (!a.selected && selectedCount >= requestedQuantity)
    );
  }

  /**
   * Check if some (but not all) filtered assets are selected
   */
  areSomeFilteredAssetsSelected(
    filteredAssets: SelectedAsset[],
    selectedCount: number,
    requestedQuantity: number
  ): boolean {
    if (filteredAssets.length === 0) return false;
    const hasSelected = filteredAssets.some(a => a.selected);
    const allSelectedOrDisabled = filteredAssets.every(a =>
      a.selected || (!a.selected && selectedCount >= requestedQuantity)
    );
    return hasSelected && !allSelectedOrDisabled;
  }

  /**
   * Check if all filtered assets are disabled
   */
  areAllFilteredAssetsDisabled(
    filteredAssets: SelectedAsset[],
    selectedCount: number,
    requestedQuantity: number
  ): boolean {
    if (filteredAssets.length === 0) return true;
    return filteredAssets.every(a =>
      !a.selected && selectedCount >= requestedQuantity
    );
  }
}

import { Injectable } from '@angular/core';
import {
  AssetFilterState,
  SelectedAsset,
} from '../models/weapon-supply-review.model';

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
   * Check if all filtered assets are selected or disabled
   */
  areAllFilteredAssetsSelected(
    filteredAssets: SelectedAsset[],
    selectedCount: number,
    requestedQuantity: number
  ): boolean {
    if (filteredAssets.length === 0) return false;
    const isAtLimit = selectedCount >= requestedQuantity;
    return filteredAssets.every(a => a.selected || isAtLimit);
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
    const isAtLimit = selectedCount >= requestedQuantity;
    const hasSelected = filteredAssets.some(a => a.selected);
    const allSelectedOrDisabled = filteredAssets.every(a => a.selected || isAtLimit);
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

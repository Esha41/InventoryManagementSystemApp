import { Asset, AssetFilterState, AssetSortState } from '../models/asset-list.model';
import { LookupDto } from '../models/ammunition.model';
import { LookupItem } from '../models/lookup.model';
import { DropdownOption } from '../../shared/components/dropdown/dropdown.component';
import { getLocalizedName, getCurrentLang } from './localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { unwrapDropdownOption } from './dropdown.utils';

/**
 * Gets localized name for a lookup item or DTO
 */
export function getLookupDisplayName(
  lookup: LookupDto | LookupItem | string | null | undefined,
  translateService: TranslateService
): string {
  if (!lookup) return '-';
  if (typeof lookup === 'string') return lookup;
  if (typeof lookup === 'object') {
    const currentLang = getCurrentLang(translateService);
    return getLocalizedName(lookup, currentLang);
  }
  return '-';
}

/**
 * Gets unit name by ID from units array
 */
export function getUnitNameById(
  unitId: number | undefined,
  units: LookupItem[],
  translateService: TranslateService
): string {
  if (!unitId) return '';
  const unit = units.find(u => u.id === unitId);
  return unit ? getLookupDisplayName(unit, translateService) : '';
}

/**
 * Creates filter options from lookup items
 */
export function createFilterOptions(
  items: LookupItem[],
  translateService: TranslateService
): Array<{ label: string; value: number }> {
  return items
    .filter(item => item.id != null)
    .map(item => ({
      label: getLookupDisplayName(item, translateService),
      value: item.id!
    }));
}

/**
 * Filters assets based on filter state
 */
export function filterAssets(
  assets: Asset[],
  filterState: AssetFilterState,
  activeTab: 'ammunition' | 'weapon' | 'explosive'
): Asset[] {
  return assets.filter(asset => {
    // Search filter
    if (filterState.searchTerm) {
      const searchLower = filterState.searchTerm.toLowerCase();
      const matchesSearch =
        asset.name.toLowerCase().includes(searchLower) ||
        asset.itemNo.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Tab-specific filters
    if (activeTab === 'ammunition') {
      // Add ammunition-specific filters here if needed
      // Currently no filters implemented beyond search
    } else if (activeTab === 'weapon') {
      // Add weapon-specific filters here if needed
    } else if (activeTab === 'explosive') {
      // Add explosive-specific filters here if needed
    }

    return true;
  });
}

/**
 * Sorts assets based on sort state
 */
export function sortAssets(
  assets: Asset[],
  sortState: AssetSortState
): Asset[] {
  const sorted = [...assets];
  sorted.sort((a, b) => {
    let valA: any = a[sortState.column as keyof Asset];
    let valB: any = b[sortState.column as keyof Asset];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Paginates assets
 */
export function paginateAssets(
  assets: Asset[],
  currentPage: number,
  rowsPerPage: number
): Asset[] {
  const start = (currentPage - 1) * rowsPerPage;
  return assets.slice(start, start + rowsPerPage);
}

/**
 * Calculates total pages for pagination
 */
export function calculateTotalPages(
  totalItems: number,
  rowsPerPage: number
): number {
  return Math.ceil(totalItems / rowsPerPage);
}

/**
 * Validates current page is within bounds
 */
export function validateCurrentPage(
  currentPage: number,
  totalPages: number
): number {
  if (currentPage < 1) return 1;
  if (currentPage > totalPages && totalPages > 0) return totalPages;
  return currentPage;
}


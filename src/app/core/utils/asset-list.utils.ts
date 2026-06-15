import { Asset, AssetFilterState, AssetSortState } from '../models/asset-list.model';
import { AmmunitionReadDto, LookupDto } from '../models/ammunition.model';
import { LookupItem } from '../models/lookup.model';
import { getLocalizedName, getCurrentLang } from './localization.utils';
import { getPrimaryPurposeId, getPrimaryPurposeNav } from '../models/primary-purpose.model';
import { PaginationUtils } from './pagination.utils';
import { TranslateService } from '@ngx-translate/core';

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
 * Label for lookup rows in dropdowns (never uses "-" for missing values; use in tables via {@link getLookupDisplayName}).
 */
export function getLookupDropdownLabel(
  lookup: LookupDto | LookupItem | string | null | undefined,
  translateService: TranslateService
): string {
  if (lookup == null || lookup === '') return '';
  if (typeof lookup === 'string') return lookup.trim();
  if (typeof lookup === 'number') return String(lookup);
  if (typeof lookup === 'object') {
    const currentLang = getCurrentLang(translateService);
    const text = getLocalizedName(lookup, currentLang).trim();
    if (text.length > 0) return text;
    const code = (lookup as LookupItem).code?.trim();
    if (code) return code;
    return '';
  }
  return '';
}

/** Lookup rows suitable for dropdowns: has id, not deleted, has a displayable name. */
export function filterRenderableLookupItems(
  items: LookupItem[] | null | undefined,
  translateService: TranslateService
): LookupItem[] {
  if (!items?.length) return [];
  const lang = getCurrentLang(translateService);
  return items.filter(item => {
    if (item == null || item.id == null) return false;
    if (item.isDeleted) return false;
    const name = getLocalizedName(item, lang).trim();
    if (name.length > 0) return true;
    return !!(item.code?.trim());
  });
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
  return filterRenderableLookupItems(items, translateService).map(item => ({
    label: getLookupDropdownLabel(item, translateService),
    value: item.id!
  }));
}

/** Catalog item DTO shape for primary purpose (ammunition / weapon / explosive). */
type CatalogPrimaryPurposeDto = Pick<
  AmmunitionReadDto,
  'primaryPurposId' | 'primaryPurposes' | 'primaryPurpos'
>;

type AssetOriginalData = Partial<
  AmmunitionReadDto & {
    type: LookupDto;
    classification: LookupDto;
    countryOfManufacture: LookupDto;
    hazardDivision: LookupDto;
    compatibility: LookupDto;
    caseType: LookupDto;
  }
>;

/**
 * Whether a catalog asset matches a single primary-purpose id (junction list, legacy single nav, or scalar id).
 */
export function assetMatchesCatalogPrimaryPurpose(asset: Asset, purposeId: number): boolean {
  const od = asset.originalData as CatalogPrimaryPurposeDto | undefined;
  if (!od) return false;
  if (getPrimaryPurposeId(od) === purposeId) {
    return true;
  }
  if (od.primaryPurposes?.length) {
    return od.primaryPurposes.some(p => p.id != null && p.id === purposeId);
  }
  const single = getPrimaryPurposeNav(od)?.id;
  return single != null && single === purposeId;
}

/** @deprecated Use assetMatchesCatalogPrimaryPurpose (same behavior). */
export function assetMatchesAmmunitionPrimaryPurpose(asset: Asset, purposeId: number): boolean {
  return assetMatchesCatalogPrimaryPurpose(asset, purposeId);
}

/** Whether a catalog DTO (ammunition / weapon / explosive) matches a single primary-purpose id. */
export function catalogDtoMatchesPrimaryPurpose(dto: CatalogPrimaryPurposeDto, purposeId: number): boolean {
  if (getPrimaryPurposeId(dto) === purposeId) {
    return true;
  }
  if (dto.primaryPurposes?.length) {
    return dto.primaryPurposes.some(p => p.id != null && p.id === purposeId);
  }
  const single = getPrimaryPurposeNav(dto)?.id;
  return single != null && single === purposeId;
}

/** @deprecated Use catalogDtoMatchesPrimaryPurpose */
export function ammunitionMatchesPrimaryPurpose(dto: CatalogPrimaryPurposeDto, purposeId: number): boolean {
  return catalogDtoMatchesPrimaryPurpose(dto, purposeId);
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
      // Access original data for filtering by IDs
      const originalData = asset.originalData as AssetOriginalData | undefined;

      // Case Type filter
      if (filterState.selectedCaseType) {
        const assetCaseTypeId = originalData?.caseType?.id;
        if (assetCaseTypeId !== parseInt(filterState.selectedCaseType)) {
          return false;
        }
      }

      if (filterState.selectedPrimaryPurposeId != null) {
        if (!assetMatchesCatalogPrimaryPurpose(asset, filterState.selectedPrimaryPurposeId)) {
          return false;
        }
      }

      // Compatibility filter
      if (filterState.selectedCompatibility) {
        const assetCompatibilityId = originalData?.compatibility?.id;
        if (assetCompatibilityId !== parseInt(filterState.selectedCompatibility)) {
          return false;
        }
      }
    } else if (activeTab === 'weapon') {
      // Access original data for filtering by IDs
      const originalData = asset.originalData as AssetOriginalData | undefined;

      // Weapon Type filter
      if (filterState.selectedWeaponType) {
        const assetWeaponTypeId = originalData?.type?.id;
        if (assetWeaponTypeId !== parseInt(filterState.selectedWeaponType)) {
          return false;
        }
      }

      // Weapon Classification filter
      if (filterState.selectedWeaponClassification) {
        const assetClassificationId = originalData?.classification?.id;
        if (assetClassificationId !== parseInt(filterState.selectedWeaponClassification)) {
          return false;
        }
      }

      // Country of Manufacture filter
      if (filterState.selectedCountryOfManufacture) {
        const assetCountryId = originalData?.countryOfManufacture?.id;
        if (assetCountryId !== parseInt(filterState.selectedCountryOfManufacture)) {
          return false;
        }
      }

      if (filterState.selectedWeaponPrimaryPurposeId != null) {
        if (!assetMatchesCatalogPrimaryPurpose(asset, filterState.selectedWeaponPrimaryPurposeId)) {
          return false;
        }
      }
    } else if (activeTab === 'explosive') {
      // Access original data for filtering by IDs
      const originalData = asset.originalData as AssetOriginalData | undefined;

      // Explosive Type filter
      if (filterState.selectedExplosiveType) {
        const assetExplosiveTypeId = originalData?.type?.id;
        if (assetExplosiveTypeId !== parseInt(filterState.selectedExplosiveType)) {
          return false;
        }
      }

      // Explosive Classification filter
      if (filterState.selectedExplosiveClassification) {
        const assetClassificationId = originalData?.classification?.id;
        if (assetClassificationId !== parseInt(filterState.selectedExplosiveClassification)) {
          return false;
        }
      }

      // Explosive Hazard Division filter
      if (filterState.selectedExplosiveHazardDivision) {
        const assetHazardDivisionId = originalData?.hazardDivision?.id;
        if (assetHazardDivisionId !== parseInt(filterState.selectedExplosiveHazardDivision)) {
          return false;
        }
      }

      // Explosive Compatibility filter
      if (filterState.selectedExplosiveCompatibility) {
        const assetCompatibilityId = originalData?.compatibility?.id;
        if (assetCompatibilityId !== parseInt(filterState.selectedExplosiveCompatibility)) {
          return false;
        }
      }

      if (filterState.selectedExplosivePrimaryPurposeId != null) {
        if (!assetMatchesCatalogPrimaryPurpose(asset, filterState.selectedExplosivePrimaryPurposeId)) {
          return false;
        }
      }
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
  const normalizeSortValue = (value: unknown): string | number => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value.toLowerCase();
    if (value instanceof Date) return value.getTime();
    return String(value).toLowerCase();
  };

  const sorted = [...assets];
  sorted.sort((a, b) => {
    const valA = normalizeSortValue(a[sortState.column as keyof Asset]);
    const valB = normalizeSortValue(b[sortState.column as keyof Asset]);

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
  return PaginationUtils.paginateList(assets, currentPage, rowsPerPage);
}

/**
 * Calculates total pages for pagination
 */
export function calculateTotalPages(
  totalItems: number,
  rowsPerPage: number
): number {
  return PaginationUtils.calculateTotalPages(totalItems, rowsPerPage);
}

/**
 * Validates current page is within bounds
 */
export function validateCurrentPage(
  currentPage: number,
  totalPages: number
): number {
  return PaginationUtils.clampCurrentPage(currentPage, totalPages);
}


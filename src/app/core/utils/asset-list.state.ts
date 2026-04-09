import { AssetFilterState, AssetSortState, AssetPaginationState, AssetModalState, AssetImageState } from '../models/asset-list.model';

/**
 * Initial filter state
 */
export function createInitialFilterState(): AssetFilterState {
  return {
    searchTerm: '',
    // Ammunition filters
    selectedCaseType: null,
    selectedPrimaryPurposeId: null,
    selectedCompatibility: null,
    selectedPropellant: null,
    // Weapon filters
    selectedWeaponType: null,
    selectedWeaponClassification: null,
    selectedCountryOfManufacture: null,
    selectedWeaponPrimaryPurposeId: null,
    // Explosive filters
    selectedExplosiveType: null,
    selectedExplosiveClassification: null,
    selectedExplosiveHazardDivision: null,
    selectedExplosiveCompatibility: null,
    selectedExplosivePrimaryPurposeId: null
  };
}

/**
 * Initial sort state
 */
export function createInitialSortState(): AssetSortState {
  return {
    column: 'name',
    direction: 'asc'
  };
}

/**
 * Initial pagination state
 */
export function createInitialPaginationState(): AssetPaginationState {
  return {
    currentPage: 1,
    rowsPerPage: 5
  };
}

/**
 * Initial modal state
 */
export function createInitialModalState(): AssetModalState {
  return {
    showEditModal: false,
    showDeleteModal: false,
    showPermanentDeleteModal: false,
    showRestoreModal: false,
    showViewModal: false,
    selectedAsset: null
  };
}

/**
 * Initial image state
 */
export function createInitialImageState(): AssetImageState {
  return {
    editImageUrl: null,
    editImageFile: null,
    editImagePreview: null,
    editImageFileId: null
  };
}

/**
 * Resets filter state to initial values
 */
export function resetFilterState(state: AssetFilterState): AssetFilterState {
  return createInitialFilterState();
}


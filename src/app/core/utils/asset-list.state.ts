import { AssetFilterState, AssetSortState, AssetPaginationState, AssetModalState, AssetImageState } from '../models/asset-list.model';

/**
 * Initial filter state
 */
export function createInitialFilterState(): AssetFilterState {
  return {
    searchTerm: '',
    selectedCaseType: null,
    selectedHazardDivision: null,
    selectedCompatibility: null,
    selectedPropellant: null,
    selectedWeaponType: null,
    selectedExplosiveType: null
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


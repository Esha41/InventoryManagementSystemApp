/**
 * Selected asset with custodian assignment
 */
export interface SelectedAsset {
  id: number;
  assetId: number;
  serialNumber?: string;
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

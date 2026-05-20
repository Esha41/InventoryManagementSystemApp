import { AssetStatus } from '@models/asset.model';

export const WAM_LIST_STATE_KEY = 'ettad.weaponAssetMaster.listState';

export type WamCustodyFilter = 'all' | 'checkout' | 'checkin';
export type WamSortColumn = 'serial' | 'name' | 'status';

export interface WeaponAssetMasterListState {
  searchInput: string;
  appliedSearchTerm: string;
  currentPage: number;
  rowsPerPage: number;
  appliedFilterDateFrom: string;
  appliedFilterDateTo: string;
  appliedPrimaryPurposeIds: number[];
  appliedFilterStatuses: AssetStatus[];
  appliedSupplierIds: number[];
  appliedManufacturerIds: number[];
  appliedEmployeeIds: number[];
  appliedFilterCustody: WamCustodyFilter;
  appliedDepotIds: number[];
  filterDateFrom: string;
  filterDateTo: string;
  filterPrimaryPurposeIds: number[];
  filterStatuses: AssetStatus[];
  filterSupplierIds: number[];
  filterManufacturerIds: number[];
  filterEmployeeIds: number[];
  filterCustody: WamCustodyFilter;
  selectedDepotIds: number[];
  sortColumn: WamSortColumn;
  sortDirection: 'asc' | 'desc';
  showMoreFilters: boolean;
}

export function readWeaponAssetMasterListState(): WeaponAssetMasterListState | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(WAM_LIST_STATE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as WeaponAssetMasterListState;
  } catch {
    return null;
  }
}

export function writeWeaponAssetMasterListState(state: WeaponAssetMasterListState): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(WAM_LIST_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private browsing errors.
  }
}

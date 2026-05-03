import { LookupDto } from './ammunition.model';
import { Observable } from 'rxjs';
import { APIOperationResponse } from './api-response.model';
import type { AmmunitionReadDto } from './ammunition.model';
import type { WeaponDto } from './weapon.model';
import type { ExplosiveDto } from './explosive.model';

/**
 * Asset type for tab management
 */
export type AssetType = 'ammunition' | 'weapon' | 'explosive';

/**
 * Sort direction for table sorting
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Unified Asset Interface for table display
 * Represents a unified view of Ammunition, Weapon, or Explosive items
 */
export interface Asset {
  id: string;
  name: string;
  itemNo: string;
  partNo: string;
  batchNo: string;
  nsn?: string;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
  imageUrl?: string;
  expiryDate?: string;
  expiryDateRaw?: string;
  readyForIssue: boolean;

  // Ammunition specific
  caseType?: string;
  primaryPurpose?: string;
  propellant?: string;

  // Shared (Ammunition & Explosive)
  armNumber?: string;
  // For ammunition: string (localized name), for explosives: LookupDto
  hazardDivision?: string | LookupDto;
  compatibility?: string | LookupDto;

  // Weapon specific (caliber is shared with Ammunition)
  weaponType?: string;
  caliber?: string;
  actionType?: string;
  barrelLength?: number;
  barrelLengthUnit?: LookupDto;
  overallLength?: number;
  overallLengthUnit?: LookupDto;
  weight?: number;
  weightUnit?: LookupDto;
  capacity?: number;

  // Explosive specific
  explosiveType?: string;
  unNumber?: string;
  netExplosiveQuantity?: number;
  netExplosiveQuantityUnit?: LookupDto;
  totalWeight?: number;
  totalWeightUnit?: LookupDto;

  // Original DTO references for Edit/View (optional)
  originalData?: AmmunitionReadDto | WeaponDto | ExplosiveDto;
}

/**
 * Per-column text/numeric filters (AND with quick search and dropdowns). Sent to the API where supported.
 */
export interface AssetColumnFilters {
  name: string;
  itemNo: string;
  partNo: string;
  nsn: string;
  /** Caliber lookup id; null = no filter */
  caliberId: string | number | null;
  /** Weapon: weapon type label (partial match EN/AR) */
  weaponType: string;
  armNumber: string;
  unNumber: string;
}

export function createEmptyColumnFilters(): AssetColumnFilters {
  return {
    name: '',
    itemNo: '',
    partNo: '',
    nsn: '',
    caliberId: null,
    weaponType: '',
    armNumber: '',
    unNumber: ''
  };
}

export function hasAnyColumnFilter(filters: AssetColumnFilters): boolean {
  const { caliberId, ...rest } = filters;
  if (caliberId != null && String(caliberId).trim() !== '') return true;
  return Object.values(rest).some(v => (v ?? '').trim().length > 0);
}

/**
 * Filter state for asset list
 */
export interface AssetFilterState {
  searchTerm: string;
  /** Additional filters for individual table columns (asset master–style) */
  columnFilters: AssetColumnFilters;
  // Ammunition filters
  selectedCaseType: string | null;
  /** Ammunition: single primary purpose lookup id; filtered client-side (junction / legacy scalar). */
  selectedPrimaryPurposeId: number | null;
  selectedCompatibility: string | null;
  selectedPropellant: string | null;
  // Weapon filters
  selectedWeaponType: string | null;
  selectedWeaponClassification: string | null;
  selectedCountryOfManufacture: string | null;
  /** Weapon: primary purpose lookup id; filtered client-side (junction / legacy). */
  selectedWeaponPrimaryPurposeId: number | null;
  // Explosive filters
  selectedExplosiveType: string | null;
  selectedExplosiveClassification: string | null;
  selectedExplosiveHazardDivision: string | null;
  selectedExplosiveCompatibility: string | null;
  /** Explosive: primary purpose lookup id; filtered client-side (junction / legacy). */
  selectedExplosivePrimaryPurposeId: number | null;
}

/**
 * Sort state for asset list
 */
export interface AssetSortState {
  column: string;
  direction: SortDirection;
}

/**
 * Pagination state for asset list
 */
export interface AssetPaginationState {
  currentPage: number;
  rowsPerPage: number;
}

/**
 * Modal state for asset list
 */
export interface AssetModalState {
  showEditModal: boolean;
  showDeleteModal: boolean;
  showPermanentDeleteModal: boolean;
  showRestoreModal: boolean;
  showViewModal: boolean;
  selectedAsset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null;
}

/**
 * Image editing state
 */
export interface AssetImageState {
  editImageUrl: string | null;
  editImageFile: File | null;
  editImagePreview: string | null;
  editImageFileId: number | null;
}

/**
 * Common interface for asset services (Ammunition, Weapon, Explosive)
 */
export interface AssetService<TDto, TCreateDto> {
  getAll<T = TDto>(query?: { search?: string }): Observable<T[]>;
  getById<T = TDto>(id: number): Observable<T | null>;
  update<T = TDto>(id: number, data: TCreateDto): Observable<APIOperationResponse<T>>;
  delete(id: number): Observable<APIOperationResponse<boolean>>;
  loadAssetImages(ids: number[]): Observable<Map<number, string | null>>;
  getFileInfo(id: number): Observable<{ id: number; url: string } | null>;
  getFileBlob(fileId: number): Observable<Blob>;
  updateImage(id: number, file: File, existingFileId: number | null): Observable<number>;
}


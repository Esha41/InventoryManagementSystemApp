import { LookupDto } from './ammunition.model';
import { Observable } from 'rxjs';
import { APIOperationResponse } from './api-response.model';
import type { AmmunitionReadDto, AmmunitionCreateDto } from './ammunition.model';
import type { WeaponDto, CreateUpdateWeaponDto } from './weapon.model';
import type { ExplosiveDto, CreateUpdateExplosiveDto } from './explosive.model';

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
  imageUrl?: string;
  expiryDate?: string;
  expiryDateRaw?: string;
  readyForIssue: boolean;

  // Ammunition specific
  caseType?: string;
  propellant?: string;

  // Shared (Ammunition & Explosive)
  // For ammunition: string (localized name), for explosives: LookupDto
  hazardDivision?: string | LookupDto;
  compatibility?: string | LookupDto;

  // Weapon specific
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
 * Filter state for asset list
 */
export interface AssetFilterState {
  searchTerm: string;
  selectedCaseType: string | null;
  selectedHazardDivision: string | null;
  selectedCompatibility: string | null;
  selectedPropellant: string | null;
  selectedWeaponType: string | null;
  selectedExplosiveType: string | null;
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
  showViewModal: boolean;
  showImportModal: boolean;
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


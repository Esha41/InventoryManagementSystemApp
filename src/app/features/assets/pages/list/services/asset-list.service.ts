/**
 * Asset List Service
 * Handles business logic for asset list page with server-side pagination
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { AssetService } from '@services/asset.service';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { PaginatedList, PagedRequest, FilterData } from '@models/api-response.model';
import { Asset, AssetType, AssetFilterState, AssetSortState } from '@models/asset-list.model';
import { AssetDto } from '@models/asset.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import {
  mapAmmunitionArrayToAssets,
  mapWeaponArrayToAssets,
  mapExplosiveArrayToAssets
} from '@utils/asset-list.mapper';
import { assetMatchesCatalogPrimaryPurpose } from '@utils/asset-list.utils';
import { TranslateService } from '@ngx-translate/core';

/**
 * When the whole search box value is numeric, also OR-match Price exactly (all catalogs).
 */
function maybeAppendExactPriceToOrGroup(orFilters: FilterData[], trimmedTerm: string): void {
  if (!trimmedTerm) return;
  const normalized = trimmedTerm.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(normalized)) return;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return;
  orFilters.push({ field: 'Price', operator: 'eq', value: String(n) });
}

/** Build OR filter for search across Name, ItemNo, PartNo, NSN (ammunition, explosives) */
function buildSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  const filters: FilterData[] = [
    { field: 'Name', operator: 'contains', value: term },
    { field: 'ItemNo', operator: 'contains', value: term },
    { field: 'PartNo', operator: 'contains', value: term },
    { field: 'Nsn', operator: 'contains', value: term },
    { field: 'Caliber', operator: 'contains', value: term }
  ];
  maybeAppendExactPriceToOrGroup(filters, term);
  return { logic: 'or', filters };
}

/** Weapons: buildSearchFilters + Caliber (substring) */
function buildWeaponSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  const filters: FilterData[] = [
    { field: 'Name', operator: 'contains', value: term },
    { field: 'ItemNo', operator: 'contains', value: term },
    { field: 'PartNo', operator: 'contains', value: term },
    { field: 'Nsn', operator: 'contains', value: term },
    { field: 'Caliber', operator: 'contains', value: term }
  ];
  maybeAppendExactPriceToOrGroup(filters, term);
  return { logic: 'or', filters };
}

/** Build OR filter for explosive search: Name, ItemNo, PartNo, NSN, ArmNumber, UNNumber, ExplosiveType, Compatibility */
function buildExplosiveSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  const filters: FilterData[] = [
    { field: 'Name', operator: 'contains', value: term },
    { field: 'ItemNo', operator: 'contains', value: term },
    { field: 'PartNo', operator: 'contains', value: term },
    { field: 'Nsn', operator: 'contains', value: term },
    { field: 'ArmNumber', operator: 'contains', value: term },
    { field: 'UNNumber', operator: 'contains', value: term },
    // Lookups use NameAr / NameEn in the backend entities.
    { field: 'Type.NameEn', operator: 'contains', value: term },
    { field: 'Type.NameAr', operator: 'contains', value: term },
    { field: 'Compatibility.NameEn', operator: 'contains', value: term },
    { field: 'Compatibility.NameAr', operator: 'contains', value: term }
  ];
  maybeAppendExactPriceToOrGroup(filters, term);
  return { logic: 'or', filters };
}

@Injectable({
  providedIn: 'root'
})
export class AssetListService {
  constructor(
    private assetService: AssetService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private translateService: TranslateService
  ) { }

  /**
   * Get assets with server-side pagination, filtering, and sorting
   * @param ammunitionDeletedOnly When activeTab is 'ammunition' and true, returns items where IsDeleted = true
   * @param explosivesDeletedOnly When activeTab is 'explosive' and true, returns items where IsDeleted = true
   * @param weaponsDeletedOnly When activeTab is 'weapon' and true, returns items where IsDeleted = true
   */
  getAssets(
    activeTab: AssetType,
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    ammunitionDeletedOnly?: boolean,
    explosivesDeletedOnly?: boolean,
    weaponsDeletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    if (activeTab === 'weapon') {
      return this.getWeaponsPaginated(page, pageSize, filterState, sortState, weaponsDeletedOnly);
    } else if (activeTab === 'ammunition') {
      return this.getAmmunitionPaginated(page, pageSize, filterState, sortState, ammunitionDeletedOnly);
    } else if (activeTab === 'explosive') {
      return this.getExplosivePaginated(page, pageSize, filterState, sortState, explosivesDeletedOnly);
    }
    
    return this.getAmmunitionPaginated(page, pageSize, filterState, sortState, ammunitionDeletedOnly);
  }

  /**
   * Get all filtered assets for export (without pagination)
   * @param ammunitionDeletedOnly When activeTab is 'ammunition' and true, exports items where IsDeleted = true
   * @param explosivesDeletedOnly When activeTab is 'explosive' and true, exports items where IsDeleted = true
   * @param weaponsDeletedOnly When activeTab is 'weapon' and true, exports items where IsDeleted = true
   */
  getAllFilteredAssetsForExport(
    activeTab: AssetType,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    ammunitionDeletedOnly?: boolean,
    explosivesDeletedOnly?: boolean,
    weaponsDeletedOnly?: boolean
  ): Observable<Asset[]> {
    if (activeTab === 'weapon') {
      return this.getAllWeaponsForExport(filterState, sortState, weaponsDeletedOnly);
    } else if (activeTab === 'ammunition') {
      return this.getAllAmmunitionForExport(filterState, sortState, ammunitionDeletedOnly);
    } else if (activeTab === 'explosive') {
      return this.getAllExplosiveForExport(filterState, sortState, explosivesDeletedOnly);
    }
    
    return this.getAllAmmunitionForExport(filterState, sortState, ammunitionDeletedOnly);
  }

  /**
   * Paged request for weapon list (server filters + sort). Primary purpose is not sent to the API.
   */
  private buildWeaponPagedRequest(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): PagedRequest {
    const filters: FilterData[] = [];

    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildWeaponSearchFilters(filterState.searchTerm));
    }

    if (filterState.selectedWeaponType) {
      filters.push({
        field: 'TypeId',
        operator: 'eq',
        value: filterState.selectedWeaponType.toString()
      });
    }

    if (filterState.selectedWeaponClassification) {
      filters.push({
        field: 'ClassificationId',
        operator: 'eq',
        value: filterState.selectedWeaponClassification.toString()
      });
    }

    if (filterState.selectedCountryOfManufacture) {
      filters.push({
        field: 'CountryOfManufactureId',
        operator: 'eq',
        value: filterState.selectedCountryOfManufacture.toString()
      });
    }

    let sortField: string | undefined;
    let sortDirection: number | undefined;

    if (sortState.column) {
      const fieldMap: Record<string, string> = {
        name: 'Name',
        itemNo: 'ItemNo',
        partNo: 'PartNo',
        nsn: 'Nsn',
        weaponType: 'Type.NameEn',
        primaryPurpose: 'BaseItemPrimaryPurposes.Min(PrimaryPurpos.NameEn)',
        caliber: 'Caliber',
        price: 'Price',
        minimumQuantity: 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    return {
      page,
      pageSize,
      ...(deletedOnly === true && { deletedOnly: true }),
      filter: filters.length > 0 || sortField
        ? {
            ...(filters.length > 0 && { logic: 'and', filters }),
            ...(sortField && { sortField, sortDirection })
          }
        : undefined
    };
  }

  private fetchAllWeaponDtos(
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<WeaponDto[]> {
    const pageSize = 1000;
    const load = (page: number, acc: WeaponDto[]): Observable<WeaponDto[]> => {
      const request = this.buildWeaponPagedRequest(page, pageSize, filterState, sortState, deletedOnly);
      return this.weaponService.getAllPaginated(request).pipe(
        concatMap(res => {
          const merged = [...acc, ...res.items];
          if (res.items.length < pageSize || merged.length >= res.totalCount) {
            return of(merged);
          }
          return load(page + 1, merged);
        })
      );
    };
    return load(1, []);
  }

  /**
   * Get weapons (assets) with server-side pagination (primary purpose filtered on the client when selected)
   * @param deletedOnly When true, returns items where IsDeleted = true
   */
  private getWeaponsPaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    const purposeId = filterState.selectedWeaponPrimaryPurposeId;

    if (purposeId != null && !Number.isNaN(Number(purposeId))) {
      const pid = Number(purposeId);
      return this.fetchAllWeaponDtos(filterState, sortState, deletedOnly).pipe(
        map(dtos => {
          const assets = mapWeaponArrayToAssets(dtos, this.translateService);
          const filtered = assets.filter(a => assetMatchesCatalogPrimaryPurpose(a, pid));
          const totalCount = filtered.length;
          const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
          const start = (page - 1) * pageSize;
          const items = filtered.slice(start, start + pageSize);
          return {
            items,
            pageIndex: page,
            totalPages,
            totalCount,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages
          };
        })
      );
    }

    const request = this.buildWeaponPagedRequest(page, pageSize, filterState, sortState, deletedOnly);

    return this.weaponService.getAllPaginated(request).pipe(
      map(paginatedData => ({
        ...paginatedData,
        items: mapWeaponArrayToAssets(paginatedData.items, this.translateService)
      }))
    );
  }

  /**
   * Paged request for ammunition list (server filters + sort). Primary purpose is not sent to the API.
   */
  private buildAmmunitionPagedRequest(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): PagedRequest {
    const filters: FilterData[] = [];

    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildSearchFilters(filterState.searchTerm));
    }

    if (filterState.selectedCaseType) {
      filters.push({
        field: 'CaseTypeId',
        operator: 'eq',
        value: filterState.selectedCaseType.toString()
      });
    }

    if (filterState.selectedCompatibility) {
      filters.push({
        field: 'CompatibilityId',
        operator: 'eq',
        value: filterState.selectedCompatibility.toString()
      });
    }

    let sortField: string | undefined;
    let sortDirection: number | undefined;

    if (sortState.column) {
      const fieldMap: Record<string, string> = {
        name: 'Name',
        itemNo: 'ItemNo',
        partNo: 'PartNo',
        nsn: 'Nsn',
        caseType: 'CaseType.NameEn',
        primaryPurpose: 'BaseItemPrimaryPurposes.Min(PrimaryPurpos.NameEn)',
        caliber: 'Caliber',
        price: 'Price',
        minimumQuantity: 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    return {
      page,
      pageSize,
      ...(deletedOnly === true && { deletedOnly: true }),
      filter: filters.length > 0 || sortField
        ? {
            ...(filters.length > 0 && { logic: 'and', filters }),
            ...(sortField && { sortField, sortDirection })
          }
        : undefined
    };
  }

  /**
   * Loads all ammunition rows matching server filters (pages of 1000 until complete). Used for client-side primary-purpose filter.
   */
  private fetchAllAmmunitionDtos(
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<AmmunitionReadDto[]> {
    const pageSize = 1000;
    const load = (page: number, acc: AmmunitionReadDto[]): Observable<AmmunitionReadDto[]> => {
      const request = this.buildAmmunitionPagedRequest(page, pageSize, filterState, sortState, deletedOnly);
      return this.ammunitionService.getAllPaginated(request).pipe(
        concatMap(res => {
          const merged = [...acc, ...res.items];
          if (res.items.length < pageSize || merged.length >= res.totalCount) {
            return of(merged);
          }
          return load(page + 1, merged);
        })
      );
    };
    return load(1, []);
  }

  /**
   * Get ammunition with server-side pagination (primary purpose filtered on the client when selected)
   * @param deletedOnly When true, returns items where IsDeleted = true
   */
  private getAmmunitionPaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    const purposeId = filterState.selectedPrimaryPurposeId;

    if (purposeId != null && !Number.isNaN(Number(purposeId))) {
      const pid = Number(purposeId);
      return this.fetchAllAmmunitionDtos(filterState, sortState, deletedOnly).pipe(
        map(dtos => {
          const assets = mapAmmunitionArrayToAssets(dtos, this.translateService);
          const filtered = assets.filter(a => assetMatchesCatalogPrimaryPurpose(a, pid));
          const totalCount = filtered.length;
          const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
          const start = (page - 1) * pageSize;
          const items = filtered.slice(start, start + pageSize);
          return {
            items,
            pageIndex: page,
            totalPages,
            totalCount,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages
          };
        })
      );
    }

    const request = this.buildAmmunitionPagedRequest(page, pageSize, filterState, sortState, deletedOnly);

    return this.ammunitionService.getAllPaginated(request).pipe(
      map(paginatedData => ({
        ...paginatedData,
        items: mapAmmunitionArrayToAssets(paginatedData.items, this.translateService)
      }))
    );
  }

  /**
   * Paged request for explosive list (server filters + sort). Primary purpose is not sent to the API.
   */
  private buildExplosivePagedRequest(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): PagedRequest {
    const filters: FilterData[] = [];

    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildExplosiveSearchFilters(filterState.searchTerm));
    }

    if (filterState.selectedExplosiveType) {
      filters.push({
        field: 'TypeId',
        operator: 'eq',
        value: filterState.selectedExplosiveType.toString()
      });
    }

    if (filterState.selectedExplosiveClassification) {
      filters.push({
        field: 'ClassificationId',
        operator: 'eq',
        value: filterState.selectedExplosiveClassification.toString()
      });
    }

    if (filterState.selectedExplosiveHazardDivision) {
      filters.push({
        field: 'HazardDivisionId',
        operator: 'eq',
        value: filterState.selectedExplosiveHazardDivision.toString()
      });
    }

    if (filterState.selectedExplosiveCompatibility) {
      filters.push({
        field: 'CompatibilityId',
        operator: 'eq',
        value: filterState.selectedExplosiveCompatibility.toString()
      });
    }

    let sortField: string | undefined;
    let sortDirection: number | undefined;

    if (sortState.column) {
      const fieldMap: Record<string, string> = {
        name: 'Name',
        itemNo: 'ItemNo',
        partNo: 'PartNo',
        nsn: 'Nsn',
        armNumber: 'ArmNumber',
        primaryPurpose: 'BaseItemPrimaryPurposes.Min(PrimaryPurpos.NameEn)',
        explosiveType: 'Type.NameEn',
        unNumber: 'UNNumber',
        compatibility: 'Compatibility.NameEn',
        price: 'Price',
        minimumQuantity: 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    return {
      page,
      pageSize,
      ...(deletedOnly === true && { deletedOnly: true }),
      filter: filters.length > 0 || sortField
        ? {
            ...(filters.length > 0 && { logic: 'and', filters }),
            ...(sortField && { sortField, sortDirection })
          }
        : undefined
    };
  }

  private fetchAllExplosiveDtos(
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<ExplosiveDto[]> {
    const pageSize = 1000;
    const load = (page: number, acc: ExplosiveDto[]): Observable<ExplosiveDto[]> => {
      const request = this.buildExplosivePagedRequest(page, pageSize, filterState, sortState, deletedOnly);
      return this.explosiveService.getAllPaginated(request).pipe(
        concatMap(res => {
          const merged = [...acc, ...res.items];
          if (res.items.length < pageSize || merged.length >= res.totalCount) {
            return of(merged);
          }
          return load(page + 1, merged);
        })
      );
    };
    return load(1, []);
  }

  /**
   * Get explosives with server-side pagination (primary purpose filtered on the client when selected)
   * @param deletedOnly When true, returns items where IsDeleted = true
   */
  private getExplosivePaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    const purposeId = filterState.selectedExplosivePrimaryPurposeId;

    if (purposeId != null && !Number.isNaN(Number(purposeId))) {
      const pid = Number(purposeId);
      return this.fetchAllExplosiveDtos(filterState, sortState, deletedOnly).pipe(
        map(dtos => {
          const assets = mapExplosiveArrayToAssets(dtos, this.translateService);
          const filtered = assets.filter(a => assetMatchesCatalogPrimaryPurpose(a, pid));
          const totalCount = filtered.length;
          const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
          const start = (page - 1) * pageSize;
          const items = filtered.slice(start, start + pageSize);
          return {
            items,
            pageIndex: page,
            totalPages,
            totalCount,
            hasPreviousPage: page > 1,
            hasNextPage: page < totalPages
          };
        })
      );
    }

    const request = this.buildExplosivePagedRequest(page, pageSize, filterState, sortState, deletedOnly);

    return this.explosiveService.getAllPaginated(request).pipe(
      map(paginatedData => ({
        ...paginatedData,
        items: mapExplosiveArrayToAssets(paginatedData.items, this.translateService)
      }))
    );
  }

  /**
   * Get all filtered weapons for export (without pagination)
   * @param deletedOnly When true, exports items where IsDeleted = true
   */
  private getAllWeaponsForExport(
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<Asset[]> {
    const purposeId = filterState.selectedWeaponPrimaryPurposeId;

    if (purposeId != null && !Number.isNaN(Number(purposeId))) {
      const pid = Number(purposeId);
      return this.fetchAllWeaponDtos(filterState, sortState, deletedOnly).pipe(
        map(dtos => {
          const assets = mapWeaponArrayToAssets(dtos, this.translateService);
          return assets.filter(a => assetMatchesCatalogPrimaryPurpose(a, pid));
        })
      );
    }

    const request = this.buildWeaponPagedRequest(1, 10000, filterState, sortState, deletedOnly);

    return this.weaponService.getAllPaginated(request).pipe(
      map(paginatedData => mapWeaponArrayToAssets(paginatedData.items, this.translateService))
    );
  }

  /**
   * Get all filtered ammunition for export (without pagination)
   * @param deletedOnly When true, exports items where IsDeleted = true
   */
  private getAllAmmunitionForExport(
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<Asset[]> {
    const purposeId = filterState.selectedPrimaryPurposeId;

    if (purposeId != null && !Number.isNaN(Number(purposeId))) {
      const pid = Number(purposeId);
      return this.fetchAllAmmunitionDtos(filterState, sortState, deletedOnly).pipe(
        map(dtos => {
          const assets = mapAmmunitionArrayToAssets(dtos, this.translateService);
          return assets.filter(a => assetMatchesCatalogPrimaryPurpose(a, pid));
        })
      );
    }

    const request = this.buildAmmunitionPagedRequest(1, 10000, filterState, sortState, deletedOnly);

    return this.ammunitionService.getAllPaginated(request).pipe(
      map(paginatedData => mapAmmunitionArrayToAssets(paginatedData.items, this.translateService))
    );
  }

  /**
   * Get all filtered explosives for export (without pagination)
   * @param deletedOnly When true, exports items where IsDeleted = true
   */
  private getAllExplosiveForExport(
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<Asset[]> {
    const purposeId = filterState.selectedExplosivePrimaryPurposeId;

    if (purposeId != null && !Number.isNaN(Number(purposeId))) {
      const pid = Number(purposeId);
      return this.fetchAllExplosiveDtos(filterState, sortState, deletedOnly).pipe(
        map(dtos => {
          const assets = mapExplosiveArrayToAssets(dtos, this.translateService);
          return assets.filter(a => assetMatchesCatalogPrimaryPurpose(a, pid));
        })
      );
    }

    const request = this.buildExplosivePagedRequest(1, 10000, filterState, sortState, deletedOnly);

    return this.explosiveService.getAllPaginated(request).pipe(
      map(paginatedData => mapExplosiveArrayToAssets(paginatedData.items, this.translateService))
    );
  }

  /**
   * Helper to get localized name
   */
  private getLocalizedName(lookup: { nameAr?: string; nameEn?: string; name?: string } | string | null | undefined, lang: string): string {
    if (!lookup) return '-';
    if (typeof lookup === 'string') return lookup;
    return lang === 'ar' ? (lookup.nameAr || lookup.name || '-') : (lookup.nameEn || lookup.name || '-');
  }

  /**
   * Helper to format date
   */
  private formatDateShort(date: string | Date): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  }
}

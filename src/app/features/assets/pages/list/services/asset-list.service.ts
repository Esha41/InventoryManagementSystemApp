/**
 * Asset List Service
 * Handles business logic for asset list page with server-side pagination
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
import { TranslateService } from '@ngx-translate/core';

/** Build OR filter for search across Name, ItemNo, PartNo, NSN (ammunition, weapons) */
function buildSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  return {
    logic: 'or',
    filters: [
      { field: 'Name', operator: 'contains', value: term },
      { field: 'ItemNo', operator: 'contains', value: term },
      { field: 'PartNo', operator: 'contains', value: term },
      { field: 'Nsn', operator: 'contains', value: term }
    ]
  };
}

/** Build OR filter for explosive search: Name, ItemNo, PartNo, NSN, ArmNumber, UNNumber, ExplosiveType, Compatibility */
function buildExplosiveSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  return {
    logic: 'or',
    filters: [
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
    ]
  };
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
   * Get weapons (assets) with server-side pagination
   * @param deletedOnly When true, returns items where IsDeleted = true
   */
  private getWeaponsPaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    const filters: FilterData[] = [];

    // Search filter (Name, ItemNo, PartNo, NSN)
    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildSearchFilters(filterState.searchTerm));
    }

    // Weapon Type filter
    if (filterState.selectedWeaponType) {
      filters.push({
        field: 'TypeId',
        operator: 'eq',
        value: filterState.selectedWeaponType.toString()
      });
    }

    // Weapon Classification filter
    if (filterState.selectedWeaponClassification) {
      filters.push({
        field: 'ClassificationId',
        operator: 'eq',
        value: filterState.selectedWeaponClassification.toString()
      });
    }

    // Country of Manufacture filter
    if (filterState.selectedCountryOfManufacture) {
      filters.push({
        field: 'CountryOfManufactureId',
        operator: 'eq',
        value: filterState.selectedCountryOfManufacture.toString()
      });
    }

    // Sorting
    let sortField: string | undefined;
    let sortDirection: number | undefined;

    if (sortState.column) {
      // Map frontend column names to backend field names
      const fieldMap: Record<string, string> = {
        'name': 'Name',
        'itemNo': 'ItemNo',
        'partNo': 'PartNo',
        'nsn': 'Nsn',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2; // 1 = asc, 2 = desc
    }

    const request: PagedRequest = {
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

    return this.weaponService.getAllPaginated(request).pipe(
      map(paginatedData => ({
        ...paginatedData,
        items: mapWeaponArrayToAssets(paginatedData.items, this.translateService)
      }))
    );
  }

  /**
   * Get ammunition with server-side pagination
   * @param deletedOnly When true, returns items where IsDeleted = true
   */
  private getAmmunitionPaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    const filters: FilterData[] = [];

    // Search filter (Name, ItemNo, PartNo, NSN)
    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildSearchFilters(filterState.searchTerm));
    }

    // Case Type filter
    if (filterState.selectedCaseType) {
      filters.push({
        field: 'CaseTypeId',
        operator: 'eq',
        value: filterState.selectedCaseType.toString()
      });
    }

    // Hazard Division filter
    if (filterState.selectedHazardDivision) {
      filters.push({
        field: 'HazardDivisionId',
        operator: 'eq',
        value: filterState.selectedHazardDivision.toString()
      });
    }

    // Compatibility filter
    if (filterState.selectedCompatibility) {
      filters.push({
        field: 'CompatibilityId',
        operator: 'eq',
        value: filterState.selectedCompatibility.toString()
      });
    }

    // Sorting
    let sortField: string | undefined;
    let sortDirection: number | undefined;

    if (sortState.column) {
      const fieldMap: Record<string, string> = {
        'name': 'Name',
        'itemNo': 'ItemNo',
        'partNo': 'PartNo',
        'nsn': 'Nsn',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    const request: PagedRequest = {
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

    return this.ammunitionService.getAllPaginated(request).pipe(
      map(paginatedData => ({
        ...paginatedData,
        items: mapAmmunitionArrayToAssets(paginatedData.items, this.translateService)
      }))
    );
  }

  /**
   * Get explosives with server-side pagination
   * @param deletedOnly When true, returns items where IsDeleted = true
   */
  private getExplosivePaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState,
    deletedOnly?: boolean
  ): Observable<PaginatedList<Asset>> {
    const filters: FilterData[] = [];

    // Search filter (Name, ItemNo, PartNo, NSN, ArmNumber, UNNumber, Type, Compatibility)
    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildExplosiveSearchFilters(filterState.searchTerm));
    }

    // Explosive Type filter
    if (filterState.selectedExplosiveType) {
      filters.push({
        field: 'TypeId',
        operator: 'eq',
        value: filterState.selectedExplosiveType.toString()
      });
    }

    // Explosive Classification filter
    if (filterState.selectedExplosiveClassification) {
      filters.push({
        field: 'ClassificationId',
        operator: 'eq',
        value: filterState.selectedExplosiveClassification.toString()
      });
    }

    // Explosive Hazard Division filter
    if (filterState.selectedExplosiveHazardDivision) {
      filters.push({
        field: 'HazardDivisionId',
        operator: 'eq',
        value: filterState.selectedExplosiveHazardDivision.toString()
      });
    }

    // Explosive Compatibility filter
    if (filterState.selectedExplosiveCompatibility) {
      filters.push({
        field: 'CompatibilityId',
        operator: 'eq',
        value: filterState.selectedExplosiveCompatibility.toString()
      });
    }

    // Sorting
    let sortField: string | undefined;
    let sortDirection: number | undefined;

    if (sortState.column) {
      const fieldMap: Record<string, string> = {
        'name': 'Name',
        'itemNo': 'ItemNo',
        'partNo': 'PartNo',
        'nsn': 'Nsn',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    const request: PagedRequest = {
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
    const filters: FilterData[] = [];

    if (filterState.searchTerm && filterState.searchTerm.trim()) {
      filters.push(buildSearchFilters(filterState.searchTerm));
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
        'name': 'Name',
        'itemNo': 'ItemNo',
        'partNo': 'PartNo',
        'nsn': 'Nsn',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    // Use a large page size to get all items
    const request: PagedRequest = {
      page: 1,
      pageSize: 10000, // Large number to get all items
      ...(deletedOnly === true && { deletedOnly: true }),
      filter: filters.length > 0 || sortField
        ? {
            ...(filters.length > 0 && { logic: 'and', filters }),
            ...(sortField && { sortField, sortDirection })
          }
        : undefined
    };

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

    if (filterState.selectedHazardDivision) {
      filters.push({
        field: 'HazardDivisionId',
        operator: 'eq',
        value: filterState.selectedHazardDivision.toString()
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
        'name': 'Name',
        'itemNo': 'ItemNo',
        'partNo': 'PartNo',
        'nsn': 'Nsn',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    // Use a large page size to get all items
    const request: PagedRequest = {
      page: 1,
      pageSize: 10000,
      ...(deletedOnly === true && { deletedOnly: true }),
      filter: filters.length > 0 || sortField
        ? {
            ...(filters.length > 0 && { logic: 'and', filters }),
            ...(sortField && { sortField, sortDirection })
          }
        : undefined
    };

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
        'name': 'Name',
        'itemNo': 'ItemNo',
        'partNo': 'PartNo',
        'nsn': 'Nsn',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    // Use a large page size to get all items
    const request: PagedRequest = {
      page: 1,
      pageSize: 10000,
      ...(deletedOnly === true && { deletedOnly: true }),
      filter: filters.length > 0 || sortField
        ? {
            ...(filters.length > 0 && { logic: 'and', filters }),
            ...(sortField && { sortField, sortDirection })
          }
        : undefined
    };

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

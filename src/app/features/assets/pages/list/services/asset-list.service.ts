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
      { field: 'Type.Name', operator: 'contains', value: term },
      { field: 'Compatibility.Name', operator: 'contains', value: term }
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
   */
  getAssets(
    activeTab: AssetType,
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState
  ): Observable<PaginatedList<Asset>> {
    if (activeTab === 'weapon') {
      return this.getWeaponsPaginated(page, pageSize, filterState, sortState);
    } else if (activeTab === 'ammunition') {
      return this.getAmmunitionPaginated(page, pageSize, filterState, sortState);
    } else if (activeTab === 'explosive') {
      return this.getExplosivePaginated(page, pageSize, filterState, sortState);
    }
    
    // Fallback to ammunition
    return this.getAmmunitionPaginated(page, pageSize, filterState, sortState);
  }

  /**
   * Get all filtered assets for export (without pagination)
   */
  getAllFilteredAssetsForExport(
    activeTab: AssetType,
    filterState: AssetFilterState,
    sortState: AssetSortState
  ): Observable<Asset[]> {
    if (activeTab === 'weapon') {
      return this.getAllWeaponsForExport(filterState, sortState);
    } else if (activeTab === 'ammunition') {
      return this.getAllAmmunitionForExport(filterState, sortState);
    } else if (activeTab === 'explosive') {
      return this.getAllExplosiveForExport(filterState, sortState);
    }
    
    return this.getAllAmmunitionForExport(filterState, sortState);
  }

  /**
   * Get weapons (assets) with server-side pagination
   */
  private getWeaponsPaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState
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
        'nsn': 'NSN',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2; // 1 = asc, 2 = desc
    }

    const request: PagedRequest = {
      page,
      pageSize,
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
   */
  private getAmmunitionPaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState
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
        'nsn': 'NSN',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    const request: PagedRequest = {
      page,
      pageSize,
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
   */
  private getExplosivePaginated(
    page: number,
    pageSize: number,
    filterState: AssetFilterState,
    sortState: AssetSortState
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
        'nsn': 'NSN',
        'price': 'Price',
        'minimumQuantity': 'MinimumQuantity'
      };

      sortField = fieldMap[sortState.column] || sortState.column;
      sortDirection = sortState.direction === 'asc' ? 1 : 2;
    }

    const request: PagedRequest = {
      page,
      pageSize,
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
   */
  private getAllWeaponsForExport(
    filterState: AssetFilterState,
    sortState: AssetSortState
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
   */
  private getAllAmmunitionForExport(
    filterState: AssetFilterState,
    sortState: AssetSortState
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
        'nsn': 'NSN',
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
   */
  private getAllExplosiveForExport(
    filterState: AssetFilterState,
    sortState: AssetSortState
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
        'nsn': 'NSN',
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
   * Apply client-side filters (temporary until backend supports it)
   */
  private applyClientSideFilters(
    assets: Asset[],
    filterState: AssetFilterState,
    activeTab: AssetType
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
      const originalData = asset.originalData as any;

      if (activeTab === 'ammunition') {
        if (filterState.selectedCaseType) {
          const assetCaseTypeId = originalData?.caseType?.id;
          if (assetCaseTypeId !== parseInt(filterState.selectedCaseType)) {
            return false;
          }
        }

        if (filterState.selectedHazardDivision) {
          const assetHazardDivisionId = originalData?.hazardDivision?.id;
          if (assetHazardDivisionId !== parseInt(filterState.selectedHazardDivision)) {
            return false;
          }
        }

        if (filterState.selectedCompatibility) {
          const assetCompatibilityId = originalData?.compatibility?.id;
          if (assetCompatibilityId !== parseInt(filterState.selectedCompatibility)) {
            return false;
          }
        }
      } else if (activeTab === 'explosive') {
        if (filterState.selectedExplosiveType) {
          const assetExplosiveTypeId = originalData?.type?.id;
          if (assetExplosiveTypeId !== parseInt(filterState.selectedExplosiveType)) {
            return false;
          }
        }

        if (filterState.selectedExplosiveClassification) {
          const assetClassificationId = originalData?.classification?.id;
          if (assetClassificationId !== parseInt(filterState.selectedExplosiveClassification)) {
            return false;
          }
        }

        if (filterState.selectedExplosiveHazardDivision) {
          const assetHazardDivisionId = originalData?.hazardDivision?.id;
          if (assetHazardDivisionId !== parseInt(filterState.selectedExplosiveHazardDivision)) {
            return false;
          }
        }

        if (filterState.selectedExplosiveCompatibility) {
          const assetCompatibilityId = originalData?.compatibility?.id;
          if (assetCompatibilityId !== parseInt(filterState.selectedExplosiveCompatibility)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Apply client-side sorting (temporary until backend supports it)
   */
  private applyClientSideSorting(
    assets: Asset[],
    sortState: AssetSortState
  ): Asset[] {
    if (!sortState.column) return assets;

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
   * Helper to get localized name
   */
  private getLocalizedName(lookup: any, lang: string): string {
    if (!lookup) return '-';
    if (typeof lookup === 'string') return lookup;
    return lang === 'ar' ? (lookup.nameAr || lookup.name) : (lookup.nameEn || lookup.name);
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

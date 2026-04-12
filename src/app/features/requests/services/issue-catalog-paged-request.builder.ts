import { Injectable } from '@angular/core';
import { FilterData, PagedRequest } from '@models/api-response.model';
import { FilterState } from '@requests/pages/new-issue/new-issue-request.state';

/** OR-group search for ammunition / explosives (aligned with asset-list.service). */
function buildCatalogSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  const filters: FilterData[] = [
    { field: 'Name', operator: 'contains', value: term },
    { field: 'ItemNo', operator: 'contains', value: term },
    { field: 'PartNo', operator: 'contains', value: term },
    { field: 'Nsn', operator: 'contains', value: term },
    { field: 'Caliber', operator: 'contains', value: term }
  ];
  return { logic: 'or', filters };
}

function buildWeaponCatalogSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  const filters: FilterData[] = [
    { field: 'Name', operator: 'contains', value: term },
    { field: 'ItemNo', operator: 'contains', value: term },
    { field: 'PartNo', operator: 'contains', value: term },
    { field: 'Nsn', operator: 'contains', value: term },
    { field: 'Caliber', operator: 'contains', value: term }
  ];
  return { logic: 'or', filters };
}

function buildExplosiveCatalogSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  const filters: FilterData[] = [
    { field: 'Name', operator: 'contains', value: term },
    { field: 'ItemNo', operator: 'contains', value: term },
    { field: 'PartNo', operator: 'contains', value: term },
    { field: 'Nsn', operator: 'contains', value: term },
    { field: 'ArmNumber', operator: 'contains', value: term },
    { field: 'UNNumber', operator: 'contains', value: term },
    { field: 'Type.NameEn', operator: 'contains', value: term },
    { field: 'Type.NameAr', operator: 'contains', value: term }
  ];
  return { logic: 'or', filters };
}

/** "SniperRifle" -> "Sniper Rifle" for Type.NameEn contains */
function spacedFromEnumKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').trim();
}

@Injectable({ providedIn: 'root' })
export class IssueCatalogPagedRequestBuilder {
  private readonly defaultSortField = 'Name';
  private readonly defaultSortDirection = 1;

  buildForAmmunition(page: number, pageSize: number, filterState: FilterState): PagedRequest {
    const filters: FilterData[] = [];

    const search = filterState.searchTerm?.trim() ?? '';
    if (search) {
      filters.push(buildCatalogSearchFilters(search));
    }

    if (filterState.selectedAmmunitionType) {
      filters.push({
        field: 'AmmunitionType',
        operator: 'eq',
        value: filterState.selectedAmmunitionType
      });
    }

    if (filterState.selectedLinked === 'Linked') {
      filters.push({ field: 'IsLinked', operator: 'eq', value: 'true' });
    } else if (filterState.selectedLinked === 'Not Linked') {
      filters.push({ field: 'IsLinked', operator: 'eq', value: 'false' });
    }

    if (filterState.selectedBulletDiameter?.trim()) {
      filters.push({
        field: 'BulletDiameterUnit.NameEn',
        operator: 'contains',
        value: filterState.selectedBulletDiameter.trim()
      });
    }

    if (filterState.selectedNature?.trim()) {
      const v = filterState.selectedNature.trim();
      filters.push({
        logic: 'or',
        filters: [
          { field: 'NatureOption.NameEn', operator: 'contains', value: v },
          { field: 'NatureOption.NameAr', operator: 'contains', value: v }
        ]
      });
    }

    const nsn = filterState.selectedNSN?.trim() ?? '';
    if (nsn) {
      filters.push({ field: 'Nsn', operator: 'contains', value: nsn });
    }

    return this.wrap(page, pageSize, filters);
  }

  buildForWeapon(page: number, pageSize: number, filterState: FilterState): PagedRequest {
    const filters: FilterData[] = [];

    const search = filterState.searchTerm?.trim() ?? '';
    if (search) {
      filters.push(buildWeaponCatalogSearchFilters(search));
    }

    if (filterState.selectedWeaponType?.trim()) {
      const spaced = spacedFromEnumKey(filterState.selectedWeaponType.trim());
      filters.push({
        field: 'Type.NameEn',
        operator: 'contains',
        value: spaced
      });
    }

    const caliber = filterState.selectedCaliber?.trim() ?? '';
    if (caliber) {
      filters.push({ field: 'Caliber', operator: 'contains', value: caliber });
    }

    const nsn = filterState.selectedNSN?.trim() ?? '';
    if (nsn) {
      filters.push({ field: 'Nsn', operator: 'contains', value: nsn });
    }

    return this.wrap(page, pageSize, filters);
  }

  buildForExplosive(page: number, pageSize: number, filterState: FilterState): PagedRequest {
    const filters: FilterData[] = [];

    const search = filterState.searchTerm?.trim() ?? '';
    if (search) {
      filters.push(buildExplosiveCatalogSearchFilters(search));
    }

    if (filterState.selectedExplosiveType?.trim()) {
      const spaced = spacedFromEnumKey(filterState.selectedExplosiveType.trim());
      filters.push({
        field: 'Type.NameEn',
        operator: 'contains',
        value: spaced
      });
    }

    const un = filterState.selectedUNNumber?.trim() ?? '';
    if (un) {
      filters.push({ field: 'UNNumber', operator: 'contains', value: un });
    }

    return this.wrap(page, pageSize, filters);
  }

  /** Large page, no filters — sample rows to derive facet dropdowns (ammunition only). */
  buildFacetSampleRequest(): PagedRequest {
    return {
      page: 1,
      pageSize: 500,
      filter: {
        sortField: this.defaultSortField,
        sortDirection: this.defaultSortDirection
      }
    };
  }

  private wrap(page: number, pageSize: number, filters: FilterData[]): PagedRequest {
    const sortField = this.defaultSortField;
    const sortDirection = this.defaultSortDirection;
    return {
      page,
      pageSize,
      filter:
        filters.length > 0
          ? {
              logic: 'and',
              filters,
              sortField,
              sortDirection
            }
          : {
              sortField,
              sortDirection
            }
    };
  }
}

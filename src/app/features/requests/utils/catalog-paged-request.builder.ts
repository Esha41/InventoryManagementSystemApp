/**
 * Builds `PagedRequest.filter` payloads for inventory paginated APIs.
 * Shared by new-issue catalog orchestration and return-request catalog — must stay aligned with backend expectations.
 */
import { FilterData, PagedRequest } from '@models/api-response.model';
import type { FilterState } from '@requests/pages/new-issue/new-issue-request.state';

export function buildCatalogSearchFilters(searchTerm: string): FilterData {
  const term = searchTerm.trim();
  return {
    logic: 'or',
    filters: [
      { field: 'Name', operator: 'contains', value: term },
      { field: 'ItemNo', operator: 'contains', value: term },
      { field: 'PartNo', operator: 'contains', value: term },
      { field: 'Nsn', operator: 'contains', value: term },
      {
        logic: 'or',
        filters: [
          { field: 'LookupCaliber.NameEn', operator: 'contains', value: term },
          { field: 'LookupCaliber.NameAr', operator: 'contains', value: term }
        ]
      }
    ]
  };
}

export function buildExplosiveCatalogSearchFilters(searchTerm: string): FilterData {
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
      { field: 'Type.NameEn', operator: 'contains', value: term },
      { field: 'Type.NameAr', operator: 'contains', value: term }
    ]
  };
}

export function spacedFromEnumKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').trim();
}

function wrapPagedRequest(page: number, pageSize: number, filters: FilterData[]): PagedRequest {
  const sortField = 'Name';
  const sortDirection = 1;
  return {
    page,
    pageSize,
    filter:
      filters.length > 0 ? { logic: 'and', filters, sortField, sortDirection } : { sortField, sortDirection }
  };
}

export function buildAmmunitionPagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildCatalogSearchFilters(search));
  if (fs.selectedAmmunitionType) filters.push({ field: 'AmmunitionType', operator: 'eq', value: fs.selectedAmmunitionType });
  if (fs.selectedLinked === 'Linked') filters.push({ field: 'IsLinked', operator: 'eq', value: 'true' });
  else if (fs.selectedLinked === 'Not Linked') filters.push({ field: 'IsLinked', operator: 'eq', value: 'false' });
  if (fs.selectedBulletDiameter?.trim()) {
    filters.push({
      field: 'BulletDiameterUnit.NameEn',
      operator: 'contains',
      value: fs.selectedBulletDiameter.trim()
    });
  }
  if (fs.selectedNature?.trim()) {
    const v = fs.selectedNature.trim();
    filters.push({
      logic: 'or',
      filters: [
        { field: 'NatureOption.NameEn', operator: 'contains', value: v },
        { field: 'NatureOption.NameAr', operator: 'contains', value: v }
      ]
    });
  }
  const nsn = fs.selectedNSN?.trim() ?? '';
  if (nsn) filters.push({ field: 'Nsn', operator: 'contains', value: nsn });
  return wrapPagedRequest(page, pageSize, filters);
}

export function buildWeaponPagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildCatalogSearchFilters(search));
  if (fs.selectedWeaponType?.trim()) {
    filters.push({
      field: 'Type.NameEn',
      operator: 'contains',
      value: spacedFromEnumKey(fs.selectedWeaponType.trim())
    });
  }
  const caliber = fs.selectedCaliber?.trim() ?? '';
  if (caliber) {
    filters.push({
      logic: 'or',
      filters: [
        { field: 'LookupCaliber.NameEn', operator: 'contains', value: caliber },
        { field: 'LookupCaliber.NameAr', operator: 'contains', value: caliber }
      ]
    });
  }
  const nsn = fs.selectedNSN?.trim() ?? '';
  if (nsn) filters.push({ field: 'Nsn', operator: 'contains', value: nsn });
  return wrapPagedRequest(page, pageSize, filters);
}

export function buildExplosivePagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildExplosiveCatalogSearchFilters(search));
  if (fs.selectedExplosiveType?.trim()) {
    filters.push({
      field: 'Type.NameEn',
      operator: 'contains',
      value: spacedFromEnumKey(fs.selectedExplosiveType.trim())
    });
  }
  const un = fs.selectedUNNumber?.trim() ?? '';
  if (un) filters.push({ field: 'UNNumber', operator: 'contains', value: un });
  return wrapPagedRequest(page, pageSize, filters);
}

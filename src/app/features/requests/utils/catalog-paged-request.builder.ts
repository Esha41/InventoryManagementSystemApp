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

function appendCaliberIdFilter(filters: FilterData[], caliberId: string | null | undefined): void {
  const raw = caliberId?.trim() ?? '';
  if (!raw) return;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return;
  filters.push({ field: 'CaliberId', operator: 'eq', value: String(n) });
}

function appendClassificationIdFilter(filters: FilterData[], classificationId: string | null | undefined): void {
  const raw = classificationId?.trim() ?? '';
  if (!raw) return;
  filters.push({ field: 'ClassificationId', operator: 'eq', value: raw });
}

function appendLookupIdFilter(filters: FilterData[], field: string, id: string | null | undefined): void {
  const raw = id?.trim() ?? '';
  if (!raw) return;
  filters.push({ field, operator: 'eq', value: raw });
}

function appendContainsFilter(filters: FilterData[], field: string, value: string | null | undefined): void {
  const raw = value?.trim() ?? '';
  if (!raw) return;
  filters.push({ field, operator: 'contains', value: raw });
}

export function buildAmmunitionPagedRequest(page: number, pageSize: number, fs: FilterState): PagedRequest {
  const filters: FilterData[] = [];
  const search = fs.searchTerm?.trim() ?? '';
  if (search) filters.push(buildCatalogSearchFilters(search));
  if (fs.selectedAmmunitionType) filters.push({ field: 'AmmunitionType', operator: 'eq', value: fs.selectedAmmunitionType });
  if (fs.selectedLinked === 'Linked') filters.push({ field: 'IsLinked', operator: 'eq', value: 'true' });
  else if (fs.selectedLinked === 'Not Linked') filters.push({ field: 'IsLinked', operator: 'eq', value: 'false' });
  appendCaliberIdFilter(filters, fs.selectedCaliber);
  appendClassificationIdFilter(filters, fs.selectedClassificationId);
  appendLookupIdFilter(filters, 'CaseTypeId', fs.selectedCaseType);
  appendLookupIdFilter(filters, 'CompatibilityId', fs.selectedCompatibility);
  appendLookupIdFilter(filters, 'HazardDivisionId', fs.selectedHazardDivision);
  appendLookupIdFilter(filters, 'PropellantId', fs.selectedPropellant);
  appendContainsFilter(filters, 'ArmNumber', fs.selectedAmmunitionArmNumber);
  appendContainsFilter(filters, 'PartNo', fs.selectedAmmunitionPartNo);
  appendContainsFilter(filters, 'Nsn', fs.selectedNSN);
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
  appendCaliberIdFilter(filters, fs.selectedCaliber);
  appendClassificationIdFilter(filters, fs.selectedClassificationId);
  appendLookupIdFilter(filters, 'CountryOfManufactureId', fs.selectedCountryOfManufacture);
  appendContainsFilter(filters, 'UNNumber', fs.selectedWeaponUNNumber);
  appendContainsFilter(filters, 'PartNo', fs.selectedPartNo);
  appendContainsFilter(filters, 'Model', fs.selectedWeaponModel);
  appendContainsFilter(filters, 'ReferenceNo', fs.selectedWeaponReferenceNo);
  appendContainsFilter(filters, 'Nsn', fs.selectedNSN);
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
  appendClassificationIdFilter(filters, fs.selectedClassificationId);
  appendLookupIdFilter(filters, 'HazardDivisionId', fs.selectedExplosiveHazardDivision);
  appendLookupIdFilter(filters, 'CompatibilityId', fs.selectedExplosiveCompatibility);
  appendContainsFilter(filters, 'ArmNumber', fs.selectedArmNumber);
  appendContainsFilter(filters, 'UNNumber', fs.selectedUNNumber);
  appendContainsFilter(filters, 'PartNo', fs.selectedExplosivePartNo);
  appendContainsFilter(filters, 'ReferenceNo', fs.selectedExplosiveReferenceNo);
  appendContainsFilter(filters, 'Nsn', fs.selectedNSN);
  return wrapPagedRequest(page, pageSize, filters);
}

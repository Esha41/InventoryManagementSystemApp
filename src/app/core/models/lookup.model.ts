/**
 * Lookup model interfaces
 */

export interface LookupItem {
  id?: number;
  nameAr: string;
  nameEn: string;
  code?: string;
  depotCode?: string;
  itemType?: number; // For ItemTypeLookup: 1=Ammunition, 2=Weapon, 3=Explosive
  isDeleted?: boolean;
}

// Backward compatibility aliases
export type DepartmentDto = LookupItem;
export type SupplierDto = LookupItem;
export type ManufacturerDto = LookupItem;
export type CountryDto = LookupItem;
export type HccDto = LookupItem;
export type NatureOptionDto = LookupItem;
export type DepotDto = LookupItem;

export interface CreateUpdateLookupDto {
  nameAr: string;
  nameEn: string;
  code?: string;
  itemType?: number; // For ItemTypeLookup: 1=Ammunition, 2=Weapon, 3=Explosive
}

export interface LookupTableConfig {
  name: string;
  displayName: string;
  apiEndpoint: string;
  hasCode: boolean;
}

export const LOOKUP_TABLES: LookupTableConfig[] = [
  { name: 'Department', displayName: 'Departments', apiEndpoint: 'Department', hasCode: true },
  { name: 'CaseType', displayName: 'Case Types', apiEndpoint: 'CaseType', hasCode: false },
  { name: 'Classification', displayName: 'Classifications', apiEndpoint: 'Classification', hasCode: false },
  { name: 'Color', displayName: 'Colors', apiEndpoint: 'Color', hasCode: false },
  { name: 'Compatibility', displayName: 'Compatibilities', apiEndpoint: 'Compatibility', hasCode: false },
  { name: 'Country', displayName: 'Countries', apiEndpoint: 'Country', hasCode: true },
  { name: 'HazardDivision', displayName: 'Hazard Divisions', apiEndpoint: 'HazardDivision', hasCode: false },
  { name: 'ItemType', displayName: 'Item Types', apiEndpoint: 'ItemType', hasCode: false },
  { name: 'Manufacturer', displayName: 'Manufacturers', apiEndpoint: 'Manufacturer', hasCode: false },
  { name: 'NatureOption', displayName: 'Nature Options', apiEndpoint: 'NatureOption', hasCode: false },
  { name: 'PrimaryPurpos', displayName: 'Primary Purposes', apiEndpoint: 'PrimaryPurpos', hasCode: false },
  { name: 'ProjectailMaterial', displayName: 'Projectile Materials', apiEndpoint: 'ProjectailMaterial', hasCode: false },
  { name: 'Propellant', displayName: 'Propellants', apiEndpoint: 'Propellant', hasCode: false },
  { name: 'Supplier', displayName: 'Suppliers', apiEndpoint: 'Supplier', hasCode: false },
  { name: 'Unit', displayName: 'Units', apiEndpoint: 'Unit', hasCode: false },
  { name: 'Rank', displayName: 'Ranks', apiEndpoint: 'Rank', hasCode: false },
];


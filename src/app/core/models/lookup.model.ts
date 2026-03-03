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


export interface CreateUpdateLookupDto {
  nameAr: string;
  nameEn: string;
  code?: string;
  itemType?: number; // For ItemTypeLookup: 1=Ammunition, 2=Weapon, 3=Explosive
}

export type RequestPurposeType = 'discard' | 'return' | 'order';

export interface LookupTableConfig {
  name: string;
  displayName: string;
  /** Translation key for display name (e.g. lookupManagement.departments) */
  displayNameKey: string;
  /** Translation key for singular form, used in modal titles (e.g. lookupManagement.department) */
  displayNameKeySingular: string;
  apiEndpoint: string;
  hasCode: boolean;
  /** When set, uses RequestPurpose API instead of Lookup API */
  requestPurposeType?: RequestPurposeType;
}

export const LOOKUP_TABLES: LookupTableConfig[] = [
  { name: 'Department', displayName: 'Departments', displayNameKey: 'lookupManagement.departments', displayNameKeySingular: 'lookupManagement.department', apiEndpoint: 'Department', hasCode: true },
  { name: 'CaseType', displayName: 'Case Types', displayNameKey: 'lookupManagement.caseTypes', displayNameKeySingular: 'lookupManagement.caseType', apiEndpoint: 'CaseType', hasCode: false },
  { name: 'Classification', displayName: 'Classifications', displayNameKey: 'lookupManagement.classifications', displayNameKeySingular: 'lookupManagement.classification', apiEndpoint: 'Classification', hasCode: false },
  { name: 'Color', displayName: 'Colors', displayNameKey: 'lookupManagement.colors', displayNameKeySingular: 'lookupManagement.color', apiEndpoint: 'Color', hasCode: false },
  { name: 'Compatibility', displayName: 'Compatibilities', displayNameKey: 'lookupManagement.compatibilities', displayNameKeySingular: 'lookupManagement.compatibility', apiEndpoint: 'Compatibility', hasCode: false },
  { name: 'Country', displayName: 'Countries', displayNameKey: 'lookupManagement.countries', displayNameKeySingular: 'lookupManagement.country', apiEndpoint: 'Country', hasCode: true },
  { name: 'HazardDivision', displayName: 'Hazard Divisions', displayNameKey: 'lookupManagement.hazardDivisions', displayNameKeySingular: 'lookupManagement.hazardDivision', apiEndpoint: 'HazardDivision', hasCode: false },
  { name: 'ItemType', displayName: 'Item Types', displayNameKey: 'lookupManagement.itemTypes', displayNameKeySingular: 'lookupManagement.itemType', apiEndpoint: 'ItemType', hasCode: false },
  { name: 'Manufacturer', displayName: 'Manufacturers', displayNameKey: 'lookupManagement.manufacturers', displayNameKeySingular: 'lookupManagement.manufacturer', apiEndpoint: 'Manufacturer', hasCode: false },
  { name: 'NatureOption', displayName: 'Nature Options', displayNameKey: 'lookupManagement.natureOptions', displayNameKeySingular: 'lookupManagement.natureOption', apiEndpoint: 'NatureOption', hasCode: false },
  { name: 'PrimaryPurpos', displayName: 'Primary Purposes', displayNameKey: 'lookupManagement.primaryPurposes', displayNameKeySingular: 'lookupManagement.primaryPurpose', apiEndpoint: 'PrimaryPurpos', hasCode: false },
  { name: 'ProjectailMaterial', displayName: 'Projectile Materials', displayNameKey: 'lookupManagement.projectileMaterials', displayNameKeySingular: 'lookupManagement.projectileMaterial', apiEndpoint: 'ProjectailMaterial', hasCode: false },
  { name: 'Propellant', displayName: 'Propellants', displayNameKey: 'lookupManagement.propellants', displayNameKeySingular: 'lookupManagement.propellant', apiEndpoint: 'Propellant', hasCode: false },
  { name: 'Supplier', displayName: 'Suppliers', displayNameKey: 'lookupManagement.suppliers', displayNameKeySingular: 'lookupManagement.supplier', apiEndpoint: 'Supplier', hasCode: false },
  { name: 'Unit', displayName: 'Units', displayNameKey: 'lookupManagement.units', displayNameKeySingular: 'lookupManagement.unit', apiEndpoint: 'Unit', hasCode: false },
  { name: 'Rank', displayName: 'Ranks', displayNameKey: 'lookupManagement.ranks', displayNameKeySingular: 'lookupManagement.rank', apiEndpoint: 'Rank', hasCode: false },
  // Request Purposes (managed via RequestPurpose API)
  { name: 'RequestPurposeDiscard', displayName: 'Request Purposes (Discard)', displayNameKey: 'lookupManagement.requestPurposesDiscard', displayNameKeySingular: 'lookupManagement.requestPurposeDiscard', apiEndpoint: 'RequestPurpose/discard', hasCode: false, requestPurposeType: 'discard' },
  { name: 'RequestPurposeReturn', displayName: 'Request Purposes (Return)', displayNameKey: 'lookupManagement.requestPurposesReturn', displayNameKeySingular: 'lookupManagement.requestPurposeReturn', apiEndpoint: 'RequestPurpose/return', hasCode: false, requestPurposeType: 'return' },
  { name: 'RequestPurposeOrder', displayName: 'Request Purposes (Order)', displayNameKey: 'lookupManagement.requestPurposesOrder', displayNameKeySingular: 'lookupManagement.requestPurposeOrder', apiEndpoint: 'RequestPurpose/order', hasCode: false, requestPurposeType: 'order' },
];


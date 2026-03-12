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
  /** Employee-specific: department display name */
  departmentName?: string;
  /** Employee-specific: rank display name */
  rankName?: string;
  /** Employee-specific: phone */
  phone?: string;
  /** Employee-specific: email */
  email?: string;
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
  /** Permission to view this lookup in the dropdown (e.g. Permissions.Departments.Page) */
  pagePermission: string;
  /** Permission to add items (e.g. Permissions.Departments.Create) */
  createPermission: string;
  /** Permission to edit items (e.g. Permissions.Departments.Edit) */
  editPermission: string;
  /** Permission to delete items (e.g. Permissions.Departments.Delete) */
  deletePermission: string;
}

export const LOOKUP_TABLES: LookupTableConfig[] = [
  { name: 'Department', displayName: 'Departments', displayNameKey: 'lookupManagement.departments', displayNameKeySingular: 'lookupManagement.department', apiEndpoint: 'Department', hasCode: true, pagePermission: 'Permissions.Departments.Page', createPermission: 'Permissions.Departments.Create', editPermission: 'Permissions.Departments.Edit', deletePermission: 'Permissions.Departments.Delete' },
  { name: 'CaseType', displayName: 'Case Types', displayNameKey: 'lookupManagement.caseTypes', displayNameKeySingular: 'lookupManagement.caseType', apiEndpoint: 'CaseType', hasCode: false, pagePermission: 'Permissions.CaseTypes.Page', createPermission: 'Permissions.CaseTypes.Create', editPermission: 'Permissions.CaseTypes.Edit', deletePermission: 'Permissions.CaseTypes.Delete' },
  { name: 'Classification', displayName: 'Classifications', displayNameKey: 'lookupManagement.classifications', displayNameKeySingular: 'lookupManagement.classification', apiEndpoint: 'Classification', hasCode: false, pagePermission: 'Permissions.Classifications.Page', createPermission: 'Permissions.Classifications.Create', editPermission: 'Permissions.Classifications.Edit', deletePermission: 'Permissions.Classifications.Delete' },
  { name: 'Color', displayName: 'Colors', displayNameKey: 'lookupManagement.colors', displayNameKeySingular: 'lookupManagement.color', apiEndpoint: 'Color', hasCode: false, pagePermission: 'Permissions.Colors.Page', createPermission: 'Permissions.Colors.Create', editPermission: 'Permissions.Colors.Edit', deletePermission: 'Permissions.Colors.Delete' },
  { name: 'Compatibility', displayName: 'Compatibilities', displayNameKey: 'lookupManagement.compatibilities', displayNameKeySingular: 'lookupManagement.compatibility', apiEndpoint: 'Compatibility', hasCode: false, pagePermission: 'Permissions.Compatibilities.Page', createPermission: 'Permissions.Compatibilities.Create', editPermission: 'Permissions.Compatibilities.Edit', deletePermission: 'Permissions.Compatibilities.Delete' },
  { name: 'Country', displayName: 'Countries', displayNameKey: 'lookupManagement.countries', displayNameKeySingular: 'lookupManagement.country', apiEndpoint: 'Country', hasCode: true, pagePermission: 'Permissions.Countries.Page', createPermission: 'Permissions.Countries.Create', editPermission: 'Permissions.Countries.Edit', deletePermission: 'Permissions.Countries.Delete' },
  { name: 'HazardDivision', displayName: 'Hazard Divisions', displayNameKey: 'lookupManagement.hazardDivisions', displayNameKeySingular: 'lookupManagement.hazardDivision', apiEndpoint: 'HazardDivision', hasCode: false, pagePermission: 'Permissions.HazardDivisions.Page', createPermission: 'Permissions.HazardDivisions.Create', editPermission: 'Permissions.HazardDivisions.Edit', deletePermission: 'Permissions.HazardDivisions.Delete' },
  { name: 'ItemType', displayName: 'Item Types', displayNameKey: 'lookupManagement.itemTypes', displayNameKeySingular: 'lookupManagement.itemType', apiEndpoint: 'ItemType', hasCode: false, pagePermission: 'Permissions.ItemTypes.Page', createPermission: 'Permissions.ItemTypes.Create', editPermission: 'Permissions.ItemTypes.Edit', deletePermission: 'Permissions.ItemTypes.Delete' },
  { name: 'Manufacturer', displayName: 'Manufacturers', displayNameKey: 'lookupManagement.manufacturers', displayNameKeySingular: 'lookupManagement.manufacturer', apiEndpoint: 'Manufacturer', hasCode: false, pagePermission: 'Permissions.Manufacturers.Page', createPermission: 'Permissions.Manufacturers.Create', editPermission: 'Permissions.Manufacturers.Edit', deletePermission: 'Permissions.Manufacturers.Delete' },
  { name: 'NatureOption', displayName: 'Nature Options', displayNameKey: 'lookupManagement.natureOptions', displayNameKeySingular: 'lookupManagement.natureOption', apiEndpoint: 'NatureOption', hasCode: false, pagePermission: 'Permissions.NatureOptions.Page', createPermission: 'Permissions.NatureOptions.Create', editPermission: 'Permissions.NatureOptions.Edit', deletePermission: 'Permissions.NatureOptions.Delete' },
  { name: 'PrimaryPurpos', displayName: 'Primary Purposes', displayNameKey: 'lookupManagement.primaryPurposes', displayNameKeySingular: 'lookupManagement.primaryPurpose', apiEndpoint: 'PrimaryPurpos', hasCode: false, pagePermission: 'Permissions.PrimaryPurposes.Page', createPermission: 'Permissions.PrimaryPurposes.Create', editPermission: 'Permissions.PrimaryPurposes.Edit', deletePermission: 'Permissions.PrimaryPurposes.Delete' },
  { name: 'ProjectailMaterial', displayName: 'Projectile Materials', displayNameKey: 'lookupManagement.projectileMaterials', displayNameKeySingular: 'lookupManagement.projectileMaterial', apiEndpoint: 'ProjectailMaterial', hasCode: false, pagePermission: 'Permissions.ProjectailMaterials.Page', createPermission: 'Permissions.ProjectailMaterials.Create', editPermission: 'Permissions.ProjectailMaterials.Edit', deletePermission: 'Permissions.ProjectailMaterials.Delete' },
  { name: 'Propellant', displayName: 'Propellants', displayNameKey: 'lookupManagement.propellants', displayNameKeySingular: 'lookupManagement.propellant', apiEndpoint: 'Propellant', hasCode: false, pagePermission: 'Permissions.Propellants.Page', createPermission: 'Permissions.Propellants.Create', editPermission: 'Permissions.Propellants.Edit', deletePermission: 'Permissions.Propellants.Delete' },
  { name: 'Supplier', displayName: 'Suppliers', displayNameKey: 'lookupManagement.suppliers', displayNameKeySingular: 'lookupManagement.supplier', apiEndpoint: 'Supplier', hasCode: false, pagePermission: 'Permissions.Supplier.Page', createPermission: 'Permissions.Supplier.Create', editPermission: 'Permissions.Supplier.Edit', deletePermission: 'Permissions.Supplier.Delete' },
  { name: 'Unit', displayName: 'Units', displayNameKey: 'lookupManagement.units', displayNameKeySingular: 'lookupManagement.unit', apiEndpoint: 'Unit', hasCode: false, pagePermission: 'Permissions.Units.Page', createPermission: 'Permissions.Units.Create', editPermission: 'Permissions.Units.Edit', deletePermission: 'Permissions.Units.Delete' },
  { name: 'Rank', displayName: 'Ranks', displayNameKey: 'lookupManagement.ranks', displayNameKeySingular: 'lookupManagement.rank', apiEndpoint: 'Rank', hasCode: false, pagePermission: 'Permissions.Rank.Page', createPermission: 'Permissions.Rank.Create', editPermission: 'Permissions.Rank.Edit', deletePermission: 'Permissions.Rank.Delete' },
  { name: 'Employee', displayName: 'Employees', displayNameKey: 'lookupManagement.employees', displayNameKeySingular: 'lookupManagement.employee', apiEndpoint: 'Employee', hasCode: true, pagePermission: 'Permissions.Employee.Page', createPermission: 'Permissions.Employee.Create', editPermission: 'Permissions.Employee.Edit', deletePermission: 'Permissions.Employee.Delete' },
  // Request Purposes (managed via RequestPurpose API)
  { name: 'RequestPurposeDiscard', displayName: 'Request Purposes (Discard)', displayNameKey: 'lookupManagement.requestPurposesDiscard', displayNameKeySingular: 'lookupManagement.requestPurposeDiscard', apiEndpoint: 'RequestPurpose/discard', hasCode: false, requestPurposeType: 'discard', pagePermission: 'Permissions.RequestPurpose.Page', createPermission: 'Permissions.RequestPurpose.Create', editPermission: 'Permissions.RequestPurpose.Edit', deletePermission: 'Permissions.RequestPurpose.Delete' },
  { name: 'RequestPurposeReturn', displayName: 'Request Purposes (Return)', displayNameKey: 'lookupManagement.requestPurposesReturn', displayNameKeySingular: 'lookupManagement.requestPurposeReturn', apiEndpoint: 'RequestPurpose/return', hasCode: false, requestPurposeType: 'return', pagePermission: 'Permissions.RequestPurpose.Page', createPermission: 'Permissions.RequestPurpose.Create', editPermission: 'Permissions.RequestPurpose.Edit', deletePermission: 'Permissions.RequestPurpose.Delete' },
  { name: 'RequestPurposeOrder', displayName: 'Request Purposes (Order)', displayNameKey: 'lookupManagement.requestPurposesOrder', displayNameKeySingular: 'lookupManagement.requestPurposeOrder', apiEndpoint: 'RequestPurpose/order', hasCode: false, requestPurposeType: 'order', pagePermission: 'Permissions.RequestPurpose.Page', createPermission: 'Permissions.RequestPurpose.Create', editPermission: 'Permissions.RequestPurpose.Edit', deletePermission: 'Permissions.RequestPurpose.Delete' },
];


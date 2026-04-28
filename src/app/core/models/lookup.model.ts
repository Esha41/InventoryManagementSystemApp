/**
 * Lookup model interfaces
 */

import { PERMISSIONS } from '@constants/permissions.constants';

export interface LookupItem {
  id?: number;
  nameAr: string;
  nameEn: string;
  code?: string;
  depotCode?: string;
  itemType?: number; // ItemTypeLookup / Unit: 1=Ammunition, 2=Weapon, 3=Explosive; Caliber: 1=Ammunition, 2=Weapon only
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
  itemType?: number;
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
  { name: 'Department', displayName: 'Departments', displayNameKey: 'lookupManagement.departments', displayNameKeySingular: 'lookupManagement.department', apiEndpoint: 'Department', hasCode: true, pagePermission: PERMISSIONS.ADMIN.LOOKUP.DEPARTMENTS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.DEPARTMENTS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.DEPARTMENTS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.DEPARTMENTS.DELETE },
  { name: 'CaseType', displayName: 'Case Types', displayNameKey: 'lookupManagement.caseTypes', displayNameKeySingular: 'lookupManagement.caseType', apiEndpoint: 'CaseType', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.CASE_TYPES.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.CASE_TYPES.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.CASE_TYPES.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.CASE_TYPES.DELETE },
  { name: 'Classification', displayName: 'Classifications', displayNameKey: 'lookupManagement.classifications', displayNameKeySingular: 'lookupManagement.classification', apiEndpoint: 'Classification', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.CLASSIFICATIONS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.CLASSIFICATIONS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.CLASSIFICATIONS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.CLASSIFICATIONS.DELETE },
  { name: 'Color', displayName: 'Colors', displayNameKey: 'lookupManagement.colors', displayNameKeySingular: 'lookupManagement.color', apiEndpoint: 'Color', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.COLORS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.COLORS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.COLORS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.COLORS.DELETE },
  { name: 'Compatibility', displayName: 'Compatibilities', displayNameKey: 'lookupManagement.compatibilities', displayNameKeySingular: 'lookupManagement.compatibility', apiEndpoint: 'Compatibility', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.COMPATIBILITIES.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.COMPATIBILITIES.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.COMPATIBILITIES.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.COMPATIBILITIES.DELETE },
  { name: 'Country', displayName: 'Countries', displayNameKey: 'lookupManagement.countries', displayNameKeySingular: 'lookupManagement.country', apiEndpoint: 'Country', hasCode: true, pagePermission: PERMISSIONS.ADMIN.LOOKUP.COUNTRIES.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.COUNTRIES.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.COUNTRIES.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.COUNTRIES.DELETE },
  { name: 'HazardDivision', displayName: 'Hazard Divisions', displayNameKey: 'lookupManagement.hazardDivisions', displayNameKeySingular: 'lookupManagement.hazardDivision', apiEndpoint: 'HazardDivision', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.HAZARD_DIVISIONS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.HAZARD_DIVISIONS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.HAZARD_DIVISIONS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.HAZARD_DIVISIONS.DELETE },
  { name: 'ItemType', displayName: 'Item Types', displayNameKey: 'lookupManagement.itemTypes', displayNameKeySingular: 'lookupManagement.itemType', apiEndpoint: 'ItemType', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.ITEM_TYPES.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.ITEM_TYPES.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.ITEM_TYPES.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.ITEM_TYPES.DELETE },
  { name: 'Caliber', displayName: 'Calibers', displayNameKey: 'lookupManagement.calibers', displayNameKeySingular: 'lookupManagement.caliber', apiEndpoint: 'Caliber', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.CALIBERS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.CALIBERS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.CALIBERS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.CALIBERS.DELETE },
  { name: 'Manufacturer', displayName: 'Manufacturers', displayNameKey: 'lookupManagement.manufacturers', displayNameKeySingular: 'lookupManagement.manufacturer', apiEndpoint: 'Manufacturer', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.MANUFACTURERS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.MANUFACTURERS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.MANUFACTURERS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.MANUFACTURERS.DELETE },
  { name: 'NatureOption', displayName: 'Nature Options', displayNameKey: 'lookupManagement.natureOptions', displayNameKeySingular: 'lookupManagement.natureOption', apiEndpoint: 'NatureOption', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.NATURE_OPTIONS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.NATURE_OPTIONS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.NATURE_OPTIONS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.NATURE_OPTIONS.DELETE },
  { name: 'PrimaryPurpos', displayName: 'Primary Purposes', displayNameKey: 'lookupManagement.primaryPurposes', displayNameKeySingular: 'lookupManagement.primaryPurpose', apiEndpoint: 'PrimaryPurpos', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.PRIMARY_PURPOSES.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.PRIMARY_PURPOSES.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.PRIMARY_PURPOSES.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.PRIMARY_PURPOSES.DELETE },
  { name: 'ProjectailMaterial', displayName: 'Projectile Materials', displayNameKey: 'lookupManagement.projectileMaterials', displayNameKeySingular: 'lookupManagement.projectileMaterial', apiEndpoint: 'ProjectailMaterial', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.PROJECTILE_MATERIALS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.PROJECTILE_MATERIALS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.PROJECTILE_MATERIALS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.PROJECTILE_MATERIALS.DELETE },
  { name: 'Propellant', displayName: 'Propellants', displayNameKey: 'lookupManagement.propellants', displayNameKeySingular: 'lookupManagement.propellant', apiEndpoint: 'Propellant', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.PROPELLANTS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.PROPELLANTS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.PROPELLANTS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.PROPELLANTS.DELETE },
  { name: 'Supplier', displayName: 'Suppliers', displayNameKey: 'lookupManagement.suppliers', displayNameKeySingular: 'lookupManagement.supplier', apiEndpoint: 'Supplier', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.SUPPLIER.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.SUPPLIER.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.SUPPLIER.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.SUPPLIER.DELETE },
  { name: 'Unit', displayName: 'Units', displayNameKey: 'lookupManagement.units', displayNameKeySingular: 'lookupManagement.unit', apiEndpoint: 'Unit', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.UNITS.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.UNITS.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.UNITS.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.UNITS.DELETE },
  { name: 'Rank', displayName: 'Ranks', displayNameKey: 'lookupManagement.ranks', displayNameKeySingular: 'lookupManagement.rank', apiEndpoint: 'Rank', hasCode: false, pagePermission: PERMISSIONS.ADMIN.LOOKUP.RANK.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.RANK.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.RANK.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.RANK.DELETE },
  { name: 'Employee', displayName: 'Employees', displayNameKey: 'lookupManagement.employees', displayNameKeySingular: 'lookupManagement.employee', apiEndpoint: 'Employee', hasCode: true, pagePermission: PERMISSIONS.ADMIN.LOOKUP.EMPLOYEE.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.EMPLOYEE.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.EMPLOYEE.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.EMPLOYEE.DELETE },
  // Request Purposes (managed via RequestPurpose API)
  { name: 'RequestPurposeDiscard', displayName: 'Request Purposes (Discard)', displayNameKey: 'lookupManagement.requestPurposesDiscard', displayNameKeySingular: 'lookupManagement.requestPurposeDiscard', apiEndpoint: 'RequestPurpose/discard', hasCode: false, requestPurposeType: 'discard', pagePermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.DELETE },
  { name: 'RequestPurposeReturn', displayName: 'Request Purposes (Return)', displayNameKey: 'lookupManagement.requestPurposesReturn', displayNameKeySingular: 'lookupManagement.requestPurposeReturn', apiEndpoint: 'RequestPurpose/return', hasCode: false, requestPurposeType: 'return', pagePermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.DELETE },
  { name: 'RequestPurposeOrder', displayName: 'Request Purposes (Order)', displayNameKey: 'lookupManagement.requestPurposesOrder', displayNameKeySingular: 'lookupManagement.requestPurposeOrder', apiEndpoint: 'RequestPurpose/order', hasCode: false, requestPurposeType: 'order', pagePermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.PAGE, createPermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.CREATE, editPermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.EDIT, deletePermission: PERMISSIONS.ADMIN.LOOKUP.REQUEST_PURPOSE.DELETE },
];


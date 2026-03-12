import { LookupItem } from '@models/lookup.model';

/**
 * Filter option for dropdowns
 */
export interface FilterOption {
  label: string;
  value: number;
}

/**
 * Ammunition-specific filter options
 */
export interface AmmunitionFilterOptions {
  caseType: FilterOption[];
  hazardDivision: FilterOption[];
  compatibility: FilterOption[];
  propellant: FilterOption[];
}

/**
 * Weapon-specific filter options
 */
export interface WeaponFilterOptions {
  weaponType: FilterOption[];
  weaponClassification: FilterOption[];
  countryOfManufacture: FilterOption[];
}

/**
 * Explosive-specific filter options
 */
export interface ExplosiveFilterOptions {
  explosiveType: FilterOption[];
  explosiveClassification: FilterOption[];
  explosiveHazardDivision: FilterOption[];
  explosiveCompatibility: FilterOption[];
}

/**
 * Unified filter options for the asset filter bar.
 * Contains all tab-specific options; the filter bar shows only the relevant subset based on activeTab.
 */
export interface AssetFilterOptions {
  caseType: FilterOption[];
  hazardDivision: FilterOption[];
  compatibility: FilterOption[];
  propellant: FilterOption[];
  weaponType: FilterOption[];
  weaponClassification: FilterOption[];
  countryOfManufacture: FilterOption[];
  explosiveType: FilterOption[];
  explosiveClassification: FilterOption[];
  explosiveHazardDivision: FilterOption[];
  explosiveCompatibility: FilterOption[];
}

/**
 * All lookup arrays returned by loadAllLookups
 */
export interface AssetLookups {
  caseTypes: LookupItem[];
  propellants: LookupItem[];
  compatibilities: LookupItem[];
  hazardDivisions: LookupItem[];
  natureOptions: LookupItem[];
  primaryPurposes: LookupItem[];
  colors: LookupItem[];
  materials: LookupItem[];
  classifications: LookupItem[];
  itemTypes: LookupItem[];
  countries: LookupItem[];
}

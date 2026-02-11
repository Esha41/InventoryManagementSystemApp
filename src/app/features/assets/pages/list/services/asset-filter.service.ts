/**
 * Asset Filter Service
 * Handles filter options and state management
 */

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AssetFilterState, AssetType } from '@models/asset-list.model';
import { LookupItem } from '@models/lookup.model';
import { createFilterOptions } from '@utils/asset-list.utils';

@Injectable({
  providedIn: 'root'
})
export class AssetFilterService {
  constructor(private translateService: TranslateService) { }

  /**
   * Get filter options for ammunition
   */
  getAmmunitionFilterOptions(
    caseTypeList: LookupItem[],
    hazardDivisionList: LookupItem[],
    compatibilityList: LookupItem[],
    propellantList: LookupItem[]
  ) {
    return {
      caseType: createFilterOptions(caseTypeList, this.translateService),
      hazardDivision: createFilterOptions(hazardDivisionList, this.translateService),
      compatibility: createFilterOptions(compatibilityList, this.translateService),
      propellant: createFilterOptions(propellantList, this.translateService)
    };
  }

  /**
   * Get filter options for weapons
   */
  getWeaponFilterOptions(
    itemTypes: LookupItem[],
    classifications: LookupItem[],
    countries: LookupItem[]
  ) {
    return {
      weaponType: createFilterOptions(itemTypes, this.translateService),
      weaponClassification: createFilterOptions(classifications, this.translateService),
      countryOfManufacture: createFilterOptions(countries, this.translateService)
    };
  }

  /**
   * Get filter options for explosives
   */
  getExplosiveFilterOptions(
    itemTypes: LookupItem[],
    classifications: LookupItem[],
    hazardDivisionList: LookupItem[],
    compatibilityList: LookupItem[]
  ) {
    return {
      explosiveType: createFilterOptions(itemTypes, this.translateService),
      explosiveClassification: createFilterOptions(classifications, this.translateService),
      explosiveHazardDivision: createFilterOptions(hazardDivisionList, this.translateService),
      explosiveCompatibility: createFilterOptions(compatibilityList, this.translateService)
    };
  }
}

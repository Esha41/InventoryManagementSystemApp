/**
 * Asset Filter Service
 * Handles filter options and state management
 */

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AssetFilterState, AssetType } from '@models/asset-list.model';
import { LookupItem } from '@models/lookup.model';
import { ItemType } from '@models/inventory.model';
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
    primaryPurposeList: LookupItem[],
    compatibilityList: LookupItem[],
    propellantList: LookupItem[]
  ) {
    return {
      caseType: createFilterOptions(caseTypeList, this.translateService),
      primaryPurpose: createFilterOptions(primaryPurposeList, this.translateService),
      compatibility: createFilterOptions(compatibilityList, this.translateService),
      propellant: createFilterOptions(propellantList, this.translateService)
    };
  }

  /**
   * Helper method to filter item types by category
   */
  private getFilteredItemTypes(itemTypes: LookupItem[], itemType: ItemType): LookupItem[] {
    if (!itemTypes?.length) return [];
    const typeName = ItemType[itemType];
    const filtered = itemTypes.filter(item => {
      const value = item.itemType as string | number | undefined;
      return value != null && (typeof value === 'string' ? value : ItemType[Number(value)]) === typeName;
    });
    return filtered.length > 0 ? filtered : itemTypes;
  }

  /**
   * Get filter options for weapons
   */
  getWeaponFilterOptions(
    itemTypes: LookupItem[],
    classifications: LookupItem[],
    countries: LookupItem[]
  ) {
    const weaponItemTypes = this.getFilteredItemTypes(itemTypes, ItemType.Weapon);
    return {
      weaponType: createFilterOptions(weaponItemTypes, this.translateService),
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
    const explosiveItemTypes = this.getFilteredItemTypes(itemTypes, ItemType.Explosive);
    return {
      explosiveType: createFilterOptions(explosiveItemTypes, this.translateService),
      explosiveClassification: createFilterOptions(classifications, this.translateService),
      explosiveHazardDivision: createFilterOptions(hazardDivisionList, this.translateService),
      explosiveCompatibility: createFilterOptions(compatibilityList, this.translateService)
    };
  }
}

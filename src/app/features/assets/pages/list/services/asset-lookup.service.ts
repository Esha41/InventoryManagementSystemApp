/**
 * Asset Lookup Service
 * Centralizes lookup loading and filter options for the asset list
 */

import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { LookupService } from '@services/lookup.service';
import { AssetFilterService } from './asset-filter.service';
import { AssetType } from '@models/asset-list.model';
import { ItemType } from '@models/inventory.model';
import { LookupItem } from '@models/lookup.model';
import {
  AssetFilterOptions,
  AssetLookups
} from '../models/asset-filter-options.model';

@Injectable({
  providedIn: 'root'
})
export class AssetLookupService {
  private readonly lookupService = inject(LookupService);
  private readonly assetFilterService = inject(AssetFilterService);

  /**
   * Load all lookups required for asset list (filters, edit modal, etc.)
   */
  loadAllLookups(): Observable<AssetLookups> {
    return forkJoin({
      caseTypes: this.lookupService.getCaseTypes(),
      propellants: this.lookupService.getPropellants(),
      compatibilities: this.lookupService.getCompatibilities(),
      hazardDivisions: this.lookupService.getHazardDivisions(),
      natureOptions: this.lookupService.getNatureOptions(),
      primaryPurposes: this.lookupService.getPrimaryPurposes(),
      colors: this.lookupService.getColors(),
      materials: this.lookupService.getProjectailMaterials(),
      classifications: this.lookupService.getLookupItems('Classification'),
      itemTypes: this.lookupService.getLookupItems('ItemType'),
      countries: this.lookupService.getCountries(),
      calibersAmmunition: this.lookupService.getCalibersByItemType(ItemType.Ammunition),
      calibersWeapon: this.lookupService.getCalibersByItemType(ItemType.Weapon)
    });
  }

  /**
   * Load units for the active tab
   */
  loadUnitsForTab(tab: AssetType): Observable<LookupItem[]> {
    let itemType: number | undefined;
    if (tab === 'ammunition') {
      itemType = ItemType.Ammunition;
    } else if (tab === 'weapon') {
      itemType = ItemType.Weapon;
    } else if (tab === 'explosive') {
      itemType = ItemType.Explosive;
    } else if (tab === 'accessory') {
      itemType = ItemType.Accessory;
    }
    return this.lookupService.getUnitsByItemType(itemType);
  }

  /**
   * Get filter options for the active tab.
   * Returns a single AssetFilterOptions object with all options populated.
   */
  getFilterOptions(activeTab: AssetType, lookups: AssetLookups): AssetFilterOptions {
    const ammoOptions = this.assetFilterService.getAmmunitionFilterOptions(
      lookups.caseTypes,
      lookups.primaryPurposes,
      lookups.compatibilities,
      lookups.propellants
    );
    const weaponOptions = this.assetFilterService.getWeaponFilterOptions(
      lookups.itemTypes,
      lookups.classifications,
      lookups.countries
    );
    const explosiveOptions = this.assetFilterService.getExplosiveFilterOptions(
      lookups.itemTypes,
      lookups.classifications,
      lookups.hazardDivisions,
      lookups.compatibilities
    );
    return {
      caseType: ammoOptions.caseType,
      primaryPurpose: ammoOptions.primaryPurpose,
      compatibility: ammoOptions.compatibility,
      propellant: ammoOptions.propellant,
      weaponType: weaponOptions.weaponType,
      weaponClassification: weaponOptions.weaponClassification,
      countryOfManufacture: weaponOptions.countryOfManufacture,
      explosiveType: explosiveOptions.explosiveType,
      explosiveClassification: explosiveOptions.explosiveClassification,
      explosiveHazardDivision: explosiveOptions.explosiveHazardDivision,
      explosiveCompatibility: explosiveOptions.explosiveCompatibility,
      calibersAmmunition: lookups.calibersAmmunition ?? [],
      calibersWeapon: lookups.calibersWeapon ?? []
    };
  }
}

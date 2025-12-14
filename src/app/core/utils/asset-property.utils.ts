/**
 * Utility functions for safely accessing properties from union types
 * Follows Angular best practices by keeping business logic out of components
 */

import { Injectable } from '@angular/core';
import { AmmunitionReadDto, LookupDto } from '../models/ammunition.model';
import { WeaponDto } from '../models/weapon.model';
import { ExplosiveDto } from '../models/explosive.model';
import { Asset } from '../models/asset-list.model';
import { LookupItem } from '../models/lookup.model';
import { TranslateService } from '@ngx-translate/core';
import { getLookupDisplayName } from './asset-list.utils';
import { getWeaponTypeName, getActionTypeName } from './weapon.utils';
import { getExplosiveTypeName } from './explosive.utils';

export type AssetUnion = Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null;

/**
 * Type guards for narrowing union types
 */
export function isAmmunition(asset: AssetUnion): asset is AmmunitionReadDto {
  return asset !== null && 'armNumber' in asset;
}

export function isWeapon(asset: AssetUnion): asset is WeaponDto {
  return asset !== null && 'weaponType' in asset;
}

export function isExplosive(asset: AssetUnion): asset is ExplosiveDto {
  return asset !== null && 'explosiveType' in asset;
}

/**
 * Injectable service for accessing asset properties safely
 * Follows Angular best practices with dependency injection
 */
@Injectable({ providedIn: 'root' })
export class AssetPropertyAccessor {
  private _units: LookupItem[] = [];
  private _activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';

  constructor(private translateService: TranslateService) {}

  /**
   * Initialize the accessor with current context
   */
  initialize(units: LookupItem[], activeTab: 'ammunition' | 'weapon' | 'explosive'): void {
    this._units = units;
    this._activeTab = activeTab;
  }

  private getLookupName(lookup: LookupDto | LookupItem | string | null | undefined): string {
    return getLookupDisplayName(lookup, this.translateService);
  }

  private getUnitName(unit: LookupDto | LookupItem | number | undefined): string {
    if (!unit) return '';
    if (typeof unit === 'number') {
      const unitItem = this._units.find(u => u.id === unit);
      return unitItem ? this.getLookupName(unitItem) : '';
    }
    return this.getLookupName(unit);
  }

  // Ammunition properties
  getArmNumber(asset: AssetUnion): string {
    return isAmmunition(asset) ? (asset.armNumber || '-') : '-';
  }

  getCaseType(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.caseType) : '-';
  }

  getPropellant(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.propellant) : '-';
  }

  getPrimer(asset: AssetUnion): string {
    return isAmmunition(asset) ? (asset.primer || '-') : '-';
  }

  getBulletDiameter(asset: AssetUnion): string {
    if (!isAmmunition(asset)) return '-';
    if (asset.bulletDiameter == null) return '-';
    return `${asset.bulletDiameter} ${this.getUnitName(asset.bulletDiameterUnit)}`;
  }

  getTotalWeight(asset: AssetUnion): string {
    if (isAmmunition(asset) && asset.totalWeight != null) {
      return `${asset.totalWeight} g`;
    }
    if (isExplosive(asset) && asset.totalWeight != null) {
      return `${asset.totalWeight} ${this.getUnitName(asset.totalWeightUnit)}`;
    }
    return '-';
  }

  /**
   * Get active tab for context-aware operations
   */
  get activeTab(): 'ammunition' | 'weapon' | 'explosive' {
    return this._activeTab;
  }

  // Weapon properties
  getWeaponTypeName(asset: AssetUnion): string {
    return isWeapon(asset) ? getWeaponTypeName(asset.weaponType) : '-';
  }

  getCaliber(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.caliber || '-') : '-';
  }

  getActionTypeName(asset: AssetUnion): string {
    return isWeapon(asset) ? getActionTypeName(asset.actionType) : '-';
  }

  getBarrelLength(asset: AssetUnion): string {
    if (!isWeapon(asset) || asset.barrelLength == null) return '-';
    return `${asset.barrelLength} ${this.getUnitName(asset.barrelLengthUnit)}`;
  }

  getCapacity(asset: AssetUnion): string {
    return isWeapon(asset) && asset.capacity != null ? asset.capacity.toString() : '-';
  }

  getOverallLength(asset: AssetUnion): string {
    if (!isWeapon(asset) || asset.overallLength == null) return '-';
    return `${asset.overallLength} ${this.getUnitName(asset.overallLengthUnit)}`;
  }

  getWeight(asset: AssetUnion): string {
    if (!isWeapon(asset) || asset.weight == null) return '-';
    return `${asset.weight} ${this.getUnitName(asset.weightUnit)}`;
  }

  // Explosive properties
  getExplosiveTypeName(asset: AssetUnion): string {
    return isExplosive(asset) ? getExplosiveTypeName(asset.explosiveType) : '-';
  }

  getUnNumber(asset: AssetUnion): string {
    return isExplosive(asset) ? (asset.unNumber || '-') : '-';
  }

  getNetExplosiveQuantity(asset: AssetUnion): string {
    if (!isExplosive(asset) || asset.netExplosiveQuantity == null) return '-';
    return `${asset.netExplosiveQuantity} ${this.getUnitName(asset.netExplosiveQuantityUnit)}`;
  }

  // Shared properties (Ammunition & Explosive)
  getCompatibility(asset: AssetUnion): string {
    if (isAmmunition(asset) || isExplosive(asset)) {
      return this.getLookupName(asset.compatibility);
    }
    return '-';
  }

  getHazardDivision(asset: AssetUnion): string {
    if (isAmmunition(asset) || isExplosive(asset)) {
      return this.getLookupName(asset.hazardDivision);
    }
    return '-';
  }

  // Common property
  getAssetName(asset: AssetUnion): string {
    return asset && 'name' in asset ? asset.name : '-';
  }

  // Common properties (shared across all asset types)
  getPrice(asset: AssetUnion): string {
    if (!asset || !('price' in asset)) return '-';
    return asset.price != null ? asset.price.toString() : '-';
  }

  getMinimumQuantity(asset: AssetUnion): string {
    if (!asset || !('minimumQuantity' in asset)) return '-';
    return asset.minimumQuantity != null ? asset.minimumQuantity.toString() : '-';
  }

  getBatchNo(asset: AssetUnion): string {
    if (!asset || !('batchNo' in asset)) return '-';
    return asset.batchNo || '-';
  }

  getExpiryDate(asset: AssetUnion): string {
    if (!asset || !('expiryDate' in asset)) return '-';
    if (!asset.expiryDate) return '-';
    try {
      const date = typeof asset.expiryDate === 'string' ? new Date(asset.expiryDate) : asset.expiryDate;
      return date.toLocaleDateString();
    } catch {
      return '-';
    }
  }

  getReadyForIssue(asset: AssetUnion): string {
    if (!asset || !('readyForIssue' in asset)) return '-';
    return asset.readyForIssue ? 'Yes' : 'No';
  }
}

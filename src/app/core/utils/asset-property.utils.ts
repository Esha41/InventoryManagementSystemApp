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
import { getExplosiveTypeName } from './explosive.utils';
import { ItemType } from '../models/inventory.model';

export type AssetUnion = Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null;

/**
 * Type guards for narrowing union types
 */
export function isAmmunition(asset: AssetUnion): asset is AmmunitionReadDto {
  return asset !== null && 'armNumber' in asset;
}

export function isWeapon(asset: AssetUnion): asset is WeaponDto {
  return asset !== null && 'caliber' in asset && !('armNumber' in asset) && !('explosiveType' in asset);
}

export function isExplosive(asset: AssetUnion): asset is ExplosiveDto {
  if (!asset) return false;
  // Check itemType first if available (most reliable)
  if ('itemType' in asset) {
    const itemType = (asset as any).itemType;
    if (typeof itemType === 'number') {
      return itemType === ItemType.Explosive;
    }
    if (typeof itemType === 'string') {
      return itemType === 'Explosive' || itemType === '3' || itemType.toLowerCase() === 'explosive';
    }
  }
  // Fallback: check for explosive-specific properties
  // If it has unNumber and is NOT ammunition or weapon, it's likely an explosive
  if ('unNumber' in asset && !isAmmunition(asset) && !isWeapon(asset)) {
    return true;
  }
  // Check for other explosive-specific properties
  return ('explosiveType' in asset) || 
         ('netExplosiveQuantity' in asset) ||
         ('distribution' in asset && 'referenceNo' in asset && !isAmmunition(asset));
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
  getCaliber(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.caliber || '-') : '-';
  }

  getModel(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.model || '-') : '-';
  }

  getYearOfManufacture(asset: AssetUnion): string {
    return isWeapon(asset) && asset.yearOfManufacture != null ? asset.yearOfManufacture.toString() : '-';
  }

  getCountryOfManufacture(asset: AssetUnion): string {
    return isWeapon(asset) ? this.getLookupName(asset.countryOfManufacture) : '-';
  }

  getCaliberUnit(asset: AssetUnion): string {
    return isWeapon(asset) ? this.getUnitName(asset.caliberUnit) : '-';
  }

  getDistributionForWeapon(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.distribution || '-') : '-';
  }

  getUnNumberForWeapon(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.unNumber || '-') : '-';
  }

  getReferenceNoForWeapon(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.referenceNo || '-') : '-';
  }

  getClassificationForWeapon(asset: AssetUnion): string {
    return isWeapon(asset) ? this.getLookupName(asset.classification) : '-';
  }

  getTypeForWeapon(asset: AssetUnion): string {
    return isWeapon(asset) ? this.getLookupName(asset.type) : '-';
  }

  getNotesForWeapon(asset: AssetUnion): string {
    return isWeapon(asset) ? (asset.notes || '-') : '-';
  }

  // Explosive properties
  getExplosiveTypeName(asset: AssetUnion): string {
    if (!isExplosive(asset) || asset.explosiveType == null) return '-';
    return getExplosiveTypeName(asset.explosiveType);
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
      if (isNaN(date.getTime())) return '-';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day} ${month} ${year} ${hours} ${minutes}`;
    } catch {
      return '-';
    }
  }

  getReadyForIssue(asset: AssetUnion): string {
    if (!asset || !('readyForIssue' in asset)) return '-';
    return asset.readyForIssue ? 'Yes' : 'No';
  }

  // New fields for ammunition and explosives
  getDistribution(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return asset.distribution || '-';
    }
    if (isExplosive(asset)) {
      return asset.distribution || '-';
    }
    // Additional check: if itemType is "Explosive", treat as explosive
    if (asset && 'itemType' in asset) {
      const itemType = (asset as any).itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return (asset as any).distribution || '-';
      }
    }
    return '-';
  }

  getUnNumberForAmmunition(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return asset.unNumber || '-';
    }
    if (isExplosive(asset)) {
      return asset.unNumber || '-';
    }
    // Additional check: if itemType is "Explosive" (case-insensitive), treat as explosive
    if (asset && 'itemType' in asset) {
      const itemType = (asset as any).itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return (asset as any).unNumber || '-';
      }
    }
    return '-';
  }

  getReferenceNo(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return asset.referenceNo || '-';
    }
    if (isExplosive(asset)) {
      return asset.referenceNo || '-';
    }
    // Additional check: if itemType is "Explosive", treat as explosive
    if (asset && 'itemType' in asset) {
      const itemType = (asset as any).itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return (asset as any).referenceNo || '-';
      }
    }
    return '-';
  }

  getClassification(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return this.getLookupName(asset.classification);
    }
    if (isExplosive(asset)) {
      return this.getLookupName(asset.classification);
    }
    // Additional check: if itemType is "Explosive", treat as explosive
    if (asset && 'itemType' in asset) {
      const itemType = (asset as any).itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return this.getLookupName((asset as any).classification);
      }
    }
    return '-';
  }

  getType(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return this.getLookupName(asset.type);
    }
    if (isExplosive(asset)) {
      return this.getLookupName(asset.type);
    }
    // Additional check: if itemType is "Explosive", treat as explosive
    if (asset && 'itemType' in asset) {
      const itemType = (asset as any).itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return this.getLookupName((asset as any).type);
      }
    }
    return '-';
  }

  getNotes(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return asset.notes || '-';
    }
    if (isExplosive(asset)) {
      return asset.notes || '-';
    }
    // Additional check: if itemType is "Explosive", treat as explosive
    if (asset && 'itemType' in asset) {
      const itemType = (asset as any).itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return (asset as any).notes || '-';
      }
    }
    return '-';
  }

  getUnit(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getUnitName(asset.bulletDiameterUnit) : '-';
  }

  getLinked(asset: AssetUnion): string {
    return isAmmunition(asset) ? (asset.isLinked ? 'Yes' : 'No') : '-';
  }

  getNature(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.natureOption) : '-';
  }

  getPrimaryPurpose(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.primaryPurpos) : '-';
  }

  getProjectileColor(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.projectileColor) : '-';
  }
}

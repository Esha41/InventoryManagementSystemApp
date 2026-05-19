import { Injectable } from '@angular/core';
import { AmmunitionReadDto, LookupDto } from '../models/ammunition.model';
import { WeaponDto } from '../models/weapon.model';
import { ExplosiveDto } from '../models/explosive.model';
import { Asset } from '../models/asset-list.model';
import { LookupItem } from '../models/lookup.model';
import { TranslateService } from '@ngx-translate/core';
import { getLookupDisplayName } from './asset-list.utils';
import { getExplosiveTypeName } from './explosive.utils';
import { ItemType, BaseItemDto } from '../models/inventory.model';
import { formatDateShort } from './format.utils';
import { getCurrentLang, getLocalizedName, Localizable } from './localization.utils';

export type AssetUnion = Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null;
type LegacyExplosiveLike = {
  itemType?: unknown;
  distribution?: string;
  unNumber?: string;
  referenceNo?: string;
  classification?: LookupDto;
  type?: LookupDto;
  notes?: string;
};

/** Map API itemType (number or JsonStringEnumConverter name) to ItemType */
export function normalizeCatalogItemType(raw: unknown): ItemType | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && raw >= 1 && raw <= 3 && Number.isInteger(raw)) {
    return raw as ItemType;
  }
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (t === '1' || t === 'ammunition') return ItemType.Ammunition;
    if (t === '2' || t === 'weapon') return ItemType.Weapon;
    if (t === '3' || t === 'explosive') return ItemType.Explosive;
  }
  return null;
}

function asLegacyExplosiveLike(asset: AssetUnion): LegacyExplosiveLike | null {
  if (!asset || typeof asset !== 'object') return null;
  return asset as LegacyExplosiveLike;
}

function assetCore(
  asset: AssetUnion
): AmmunitionReadDto | WeaponDto | ExplosiveDto | undefined {
  if (asset === null) return undefined;
  return (asset as Asset).originalData ?? (asset as AmmunitionReadDto | WeaponDto | ExplosiveDto);
}

function resolvedCatalogItemType(asset: AssetUnion): ItemType | null {
  const core = assetCore(asset);
  let raw: unknown;
  if (core && typeof core === 'object' && 'itemType' in core) {
    raw = (core as BaseItemDto).itemType;
  } else if (asset && typeof asset === 'object' && 'itemType' in asset) {
    raw = (asset as BaseItemDto).itemType;
  } else {
    return null;
  }
  return normalizeCatalogItemType(raw);
}

/**
 * Type guards for narrowing union types
 */
export function isAmmunition(asset: AssetUnion): asset is AmmunitionReadDto {
  if (asset === null) return false;
  const kind = resolvedCatalogItemType(asset);
  if (kind !== null) return kind === ItemType.Ammunition;
  const core = assetCore(asset);
  return 'armNumber' in asset && !('explosiveType' in (core ?? {}));
}

export function isWeapon(asset: AssetUnion): asset is WeaponDto {
  if (asset === null) return false;
  const kind = resolvedCatalogItemType(asset);
  if (kind !== null) return kind === ItemType.Weapon;
  const core = assetCore(asset);
  return 'caliberCategory' in (core ?? {}) && !('explosiveType' in (core ?? {}));
}

export function isExplosive(asset: AssetUnion): asset is ExplosiveDto {
  if (!asset) return false;
  const kind = resolvedCatalogItemType(asset);
  if (kind !== null) return kind === ItemType.Explosive;
  if ('unNumber' in asset && !isAmmunition(asset) && !isWeapon(asset)) {
    return true;
  }
  return (
    'explosiveType' in asset ||
    'netExplosiveQuantity' in asset ||
    ('distribution' in asset &&
      'referenceNo' in asset &&
      !isAmmunition(asset) &&
      !isWeapon(asset))
  );
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

  private getUnitName(unit: LookupDto | LookupItem | number | null | undefined): string {
    if (!unit) return '';
    if (typeof unit === 'number') {
      const unitItem = this._units.find(u => u.id === unit);
      return unitItem ? this.getLookupName(unitItem) : '';
    }
    return this.getLookupName(unit);
  }

  // Ammunition and Explosive properties
  getArmNumber(asset: AssetUnion): string {
    if (!(isAmmunition(asset) || isExplosive(asset))) return '-';
    const v = (asset as AmmunitionReadDto | ExplosiveDto).armNumber;
    if (v != null && String(v).trim() !== '' && v !== '-') return String(v).trim();
    const assetWithOd = asset as AssetUnion & { originalData?: AmmunitionReadDto | ExplosiveDto };
    if (assetWithOd.originalData) {
      const av = assetWithOd.originalData.armNumber;
      if (av != null && String(av).trim() !== '') return String(av).trim();
    }
    return '-';
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

  /** Maps AmmunitionType / WeaponCaliberCategory (1–3 or enum name) to translated label */
  private caliberCategoryEnumLabel(value: number | string | null | undefined): string {
    if (value == null || value === '') return '-';
    let n: number;
    if (typeof value === 'string') {
      const v = value.trim();
      const lower = v.toLowerCase();
      if (lower === 'small' || v === '1') n = 1;
      else if (lower === 'medium' || v === '2') n = 2;
      else if (lower === 'large' || v === '3') n = 3;
      else {
        n = parseInt(v, 10);
        if (Number.isNaN(n)) return '-';
      }
    } else {
      n = value;
    }
    const key =
      n === 1
        ? 'newIssueRequest.ammunitionTypeSmall'
        : n === 2
          ? 'newIssueRequest.ammunitionTypeMedium'
          : n === 3
            ? 'newIssueRequest.ammunitionTypeLarge'
            : '';
    if (!key) return '-';
    const label = this.translateService.instant(key);
    return label?.trim() ? label : '-';
  }

  private resolveAmmunitionReadDto(asset: AssetUnion): AmmunitionReadDto | null {
    if (!asset) return null;
    if (isAmmunition(asset)) return asset as AmmunitionReadDto;
    const od = (asset as Asset)?.originalData;
    if (od && isAmmunition(od)) return od as AmmunitionReadDto;
    return null;
  }

  private resolveWeaponDto(asset: AssetUnion): WeaponDto | null {
    if (!asset) return null;
    if (isWeapon(asset)) return asset as WeaponDto;
    const od = (asset as Asset)?.originalData;
    if (od && isWeapon(od)) return od as WeaponDto;
    return null;
  }

  getAmmunitionCaliberCategory(asset: AssetUnion): string {
    const dto = this.resolveAmmunitionReadDto(asset);
    if (!dto || dto.ammunitionType == null) return '-';
    return this.caliberCategoryEnumLabel(dto.ammunitionType);
  }

  getWeaponCaliberCategory(asset: AssetUnion): string {
    const dto = this.resolveWeaponDto(asset);
    if (!dto || dto.caliberCategory == null) return '-';
    return this.caliberCategoryEnumLabel(dto.caliberCategory);
  }

  getAmmunitionCaliber(asset: AssetUnion): string {
    if (isExplosive(asset)) return '-';
    const dto = this.resolveAmmunitionReadDto(asset);
    if (dto) {
      const label = this.normalizeDetailLabel(
        this.getLookupName(dto.caliber as LookupDto | null | undefined)
      );
      if (label) return label;
    }
    const shell = (asset as Asset)?.caliber;
    if (typeof shell === 'string') {
      const t = shell.trim();
      if (t && t !== '-') return t;
    }
    return '-';
  }

  // Weapon properties
  getCaliber(asset: AssetUnion): string {
    const dto = this.resolveWeaponDto(asset);
    if (dto) {
      const label = this.normalizeDetailLabel(
        this.getLookupName(dto.caliber as LookupDto | null | undefined)
      );
      if (label) return label;
    }
    const shell = (asset as Asset)?.caliber;
    if (typeof shell === 'string') {
      const t = shell.trim();
      if (t && t !== '-') return t;
    }
    return '-';
  }

  /** Treat empty / placeholder display names as missing so fallbacks can apply */
  private normalizeDetailLabel(raw: string): string {
    const t = (raw ?? '').trim();
    if (!t || t === '-') return '';
    return t;
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
    const source = assetCore(asset) ?? asset;
    const name = getLocalizedName(source as Localizable, getCurrentLang(this.translateService));
    return name || '-';
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

  getCriticalQuantity(asset: AssetUnion): string {
    if (!asset) return '-';
    if ('criticalQuantity' in asset && (asset as { criticalQuantity?: number }).criticalQuantity != null) {
      return String((asset as { criticalQuantity?: number }).criticalQuantity);
    }
    if ('originalData' in asset && (asset as Asset).originalData) {
      const od = (asset as Asset).originalData as AmmunitionReadDto;
      if (od?.criticalQuantity != null) return od.criticalQuantity.toString();
    }
    return '-';
  }

  getBatchNo(asset: AssetUnion): string {
    if (!asset || !('batchNo' in asset)) return '-';
    return asset.batchNo || '-';
  }

  getExpiryDate(asset: AssetUnion): string {
    if (!asset || !('expiryDate' in asset)) return '-';
    if (!asset.expiryDate) return '-';
    try {
      const formatted = formatDateShort(asset.expiryDate as string | Date);
      return formatted === 'N/A' ? '-' : formatted;
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
    const legacy = asLegacyExplosiveLike(asset);
    if (legacy && 'itemType' in legacy) {
      const itemType = legacy.itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return legacy.distribution || '-';
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
    const legacy = asLegacyExplosiveLike(asset);
    if (legacy && 'itemType' in legacy) {
      const itemType = legacy.itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return legacy.unNumber || '-';
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
    const legacy = asLegacyExplosiveLike(asset);
    if (legacy && 'itemType' in legacy) {
      const itemType = legacy.itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return legacy.referenceNo || '-';
      }
    }
    return '-';
  }

  getClassification(asset: AssetUnion): string {
    if (!asset) return '-';

    const pick = (a: { classification?: LookupDto | null } | null | undefined): string | null => {
      if (!a?.classification) return null;
      const s = this.getLookupName(a.classification);
      return s && s !== '' ? s : null;
    };

    if (isWeapon(asset)) {
      const r = pick(asset as WeaponDto);
      if (r) return r;
    } else if (isExplosive(asset)) {
      const r = pick(asset as ExplosiveDto);
      if (r) return r;
    } else if (isAmmunition(asset)) {
      const r = pick(asset as AmmunitionReadDto);
      if (r) return r;
    }

    if ('originalData' in asset && (asset as Asset).originalData) {
      const od = (asset as Asset).originalData as AmmunitionReadDto | ExplosiveDto | WeaponDto;
      const r2 = pick(od);
      if (r2) return r2;
    }

    const legacy = asLegacyExplosiveLike(asset);
    if (legacy && 'itemType' in legacy) {
      const itemType = legacy.itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        const legacyClassification = this.getLookupName(legacy.classification);
        if (legacyClassification && legacyClassification !== '') return legacyClassification;
      }
    }
    return '-';
  }

  getType(asset: AssetUnion): string {
    if (!asset) return '-';

    const pick = (a: { type?: LookupDto | null } | null | undefined): string | null => {
      if (!a?.type) return null;
      const s = this.getLookupName(a.type);
      return s && s !== '' ? s : null;
    };

    if (isWeapon(asset)) {
      const r = pick(asset as WeaponDto);
      if (r) return r;
    } else if (isExplosive(asset)) {
      const r = pick(asset as ExplosiveDto);
      if (r) return r;
    } else if (isAmmunition(asset)) {
      const r = pick(asset as AmmunitionReadDto);
      if (r) return r;
    }

    if ('originalData' in asset && (asset as Asset).originalData) {
      const od = (asset as Asset).originalData as AmmunitionReadDto | ExplosiveDto | WeaponDto;
      const r2 = pick(od);
      if (r2) return r2;
    }

    const legacy = asLegacyExplosiveLike(asset);
    if (legacy && 'itemType' in legacy) {
      const itemType = legacy.itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        const legacyType = this.getLookupName(legacy.type);
        if (legacyType && legacyType !== '') return legacyType;
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
    const legacy = asLegacyExplosiveLike(asset);
    if (legacy && 'itemType' in legacy) {
      const itemType = legacy.itemType;
      if (typeof itemType === 'string' && itemType.toLowerCase() === 'explosive') {
        return legacy.notes || '-';
      }
    }
    return '-';
  }

  getUnit(asset: AssetUnion): string {
    if (isAmmunition(asset)) {
      return this.getUnitName(asset.bulletDiameterUnit);
    }
    if (isExplosive(asset)) {
      return this.getUnitName(asset.unit);
    }
    return '-';
  }

  getLinked(asset: AssetUnion): string {
    return isAmmunition(asset) ? (asset.isLinked ? 'Yes' : 'No') : '-';
  }

  getNature(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.natureOption) : '-';
  }

  getPrimaryPurpose(asset: AssetUnion): string {
    if (!asset) return '-';
    const fromList = (purposes: LookupDto[] | null | undefined): string | null => {
      if (!purposes?.length) return null;
      const parts = purposes.map(p => this.getLookupName(p)).filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : null;
    };
    const fromPurposesOrLegacy = (
      purposes: LookupDto[] | null | undefined,
      legacy: LookupDto | undefined
    ): string | null => {
      const multi = fromList(purposes);
      if (multi) return multi;
      const one = this.getLookupName(legacy);
      return one && one !== '' ? one : null;
    };

    const tryResolve = (a: AmmunitionReadDto | ExplosiveDto | WeaponDto | null | undefined): string | null => {
      if (!a) return null;
      return fromPurposesOrLegacy(a.primaryPurposes, a.primaryPurpos);
    };

    if (isExplosive(asset)) {
      const r = tryResolve(asset as ExplosiveDto);
      if (r) return r;
    } else if (isAmmunition(asset)) {
      const r = tryResolve(asset as AmmunitionReadDto);
      if (r) return r;
    } else if (isWeapon(asset)) {
      const r = tryResolve(asset as WeaponDto);
      if (r) return r;
    }

    if ('originalData' in asset && (asset as Asset).originalData) {
      const r2 = tryResolve((asset as Asset).originalData as AmmunitionReadDto | ExplosiveDto | WeaponDto);
      if (r2) return r2;
    }
    if ('primaryPurpose' in asset && typeof (asset as Asset).primaryPurpose === 'string') {
      const s = (asset as Asset).primaryPurpose;
      if (s && s !== '-') return s;
    }
    return '-';
  }

  getProjectileColor(asset: AssetUnion): string {
    return isAmmunition(asset) ? this.getLookupName(asset.projectileColor) : '-';
  }
}

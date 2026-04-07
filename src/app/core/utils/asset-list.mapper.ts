import { Asset } from '../models/asset-list.model';
import { AmmunitionReadDto, LookupDto } from '../models/ammunition.model';
import { WeaponDto } from '../models/weapon.model';
import { ExplosiveDto } from '../models/explosive.model';
import { getLocalizedName, getCurrentLang } from './localization.utils';
import { formatDateShort } from './format.utils';
import { getExplosiveTypeName } from './explosive.utils';
import { TranslateService } from '@ngx-translate/core';

/** Primary purpose(s) for catalog items (ammunition / weapon / explosive) from API. */
function formatCatalogPrimaryPurposes(
  dto: { primaryPurposes?: LookupDto[]; primaryPurpos?: LookupDto },
  currentLang: string
): string {
  const list = dto.primaryPurposes;
  if (list && list.length > 0) {
    const parts = list.map(p => getLocalizedName(p, currentLang)).filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  }
  if (dto.primaryPurpos) {
    return getLocalizedName(dto.primaryPurpos, currentLang) || '-';
  }
  return '-';
}

/**
 * Maps AmmunitionReadDto to Asset
 */
export function mapAmmunitionToAsset(
  dto: AmmunitionReadDto,
  currentLang: string
): Asset {
  // Note: imageUrl is not set here because fileUrl from response is a network path
  // Images will be loaded as blobs in loadAmmunitionImages() using the image ID

  return {
    id: dto.id?.toString() || '-',
    name: dto.name || 'Unknown',
    itemNo: dto.itemNo || '-',
    partNo: dto.partNo || '-',
    batchNo: dto.batchNo || '-',
    nsn: dto.nsn || '-',
    armNumber: dto.armNumber || '-',
    caliber: dto.caliber || '-',
    caseType: getLocalizedName(dto.caseType, currentLang) || '-',
    primaryPurpose: formatCatalogPrimaryPurposes(dto, currentLang),
    hazardDivision: getLocalizedName(dto.hazardDivision, currentLang) || '-',
    compatibility: getLocalizedName(dto.compatibility, currentLang) || '-',
    propellant: getLocalizedName(dto.propellant, currentLang) || '-',
    expiryDate: dto.expiryDate ? (formatDateShort(dto.expiryDate) || '-') : '-',
    expiryDateRaw: dto.expiryDate
      ? typeof dto.expiryDate === 'string'
        ? dto.expiryDate
        : new Date(dto.expiryDate).toISOString()
      : undefined,
    readyForIssue: dto.readyForIssue ?? true,
    price: dto.price,
    minimumQuantity: dto.minimumQuantity,
    imageUrl: undefined, // Will be set in loadAmmunitionImages() using image ID from response
    originalData: dto
  };
}

/**
 * Maps WeaponDto to Asset
 */
export function mapWeaponToAsset(dto: WeaponDto, currentLang: string): Asset {
  // Note: imageUrl is not set here because fileUrl from response is a network path
  // Images will be loaded as blobs in loadImagesFromResponse() using the image ID

  return {
    id: dto.id?.toString() || '-',
    name: dto.name || 'Unknown',
    itemNo: dto.itemNo || '-',
    partNo: dto.partNo || '-',
    batchNo: dto.batchNo || '-',
    nsn: dto.nsn || '-',
    weaponType: dto.type ? getLocalizedName(dto.type, currentLang) : '-',
    primaryPurpose: formatCatalogPrimaryPurposes(dto, currentLang),
    caliber: dto.caliber,
    expiryDate: dto.expiryDate ? (formatDateShort(dto.expiryDate) || '-') : '-',
    readyForIssue: dto.readyForIssue ?? true,
    price: dto.price,
    minimumQuantity: dto.minimumQuantity,
    imageUrl: undefined, // Will be set in loadImagesFromResponse() using image ID from response
    originalData: dto
  };
}

/**
 * Maps ExplosiveDto to Asset
 */
export function mapExplosiveToAsset(dto: ExplosiveDto, currentLang: string): Asset {
  // Note: imageUrl is not set here because fileUrl from response is a network path
  // Images will be loaded as blobs in loadImagesFromResponse() using the image ID

  // Determine explosive type - check type lookup first, then fall back to explosiveType enum
  let explosiveTypeDisplay = '-';
  if (dto.type) {
    // Use type lookup (similar to weapons)
    explosiveTypeDisplay = getLocalizedName(dto.type, currentLang);
  } else if (dto.explosiveType) {
    // Fall back to explosiveType enum
    explosiveTypeDisplay = getExplosiveTypeName(dto.explosiveType);
  }

  return {
    id: dto.id?.toString() || '-',
    name: dto.name || 'Unknown',
    itemNo: dto.itemNo || '-',
    partNo: dto.partNo || '-',
    batchNo: dto.batchNo || '-',
    nsn: dto.nsn || '-',
    armNumber: dto.armNumber || '-',
    primaryPurpose: formatCatalogPrimaryPurposes(dto, currentLang),
    explosiveType: explosiveTypeDisplay,
    unNumber: dto.unNumber,
    netExplosiveQuantity: dto.netExplosiveQuantity,
    netExplosiveQuantityUnit: dto.netExplosiveQuantityUnit,
    totalWeight: dto.totalWeight,
    totalWeightUnit: dto.totalWeightUnit,
    hazardDivision: dto.hazardDivision,
    compatibility: getLocalizedName(dto.compatibility, currentLang) || '-',
    expiryDate: dto.expiryDate ? (formatDateShort(dto.expiryDate) || '-') : '-',
    readyForIssue: dto.readyForIssue ?? true,
    price: dto.price,
    minimumQuantity: dto.minimumQuantity,
    imageUrl: undefined, // Will be set in loadImagesFromResponse() using image ID from response
    originalData: dto
  };
}

/**
 * Maps array of AmmunitionReadDto to Asset[]
 */
export function mapAmmunitionArrayToAssets(
  dtos: AmmunitionReadDto[],
  translateService: TranslateService
): Asset[] {
  const currentLang = getCurrentLang(translateService);
  return (dtos || []).map(dto => mapAmmunitionToAsset(dto, currentLang));
}

/**
 * Maps array of WeaponDto to Asset[]
 */
export function mapWeaponArrayToAssets(dtos: WeaponDto[], translateService: TranslateService): Asset[] {
  const currentLang = getCurrentLang(translateService);
  return (dtos || []).map(dto => mapWeaponToAsset(dto, currentLang));
}

/**
 * Maps array of ExplosiveDto to Asset[]
 */
export function mapExplosiveArrayToAssets(dtos: ExplosiveDto[], translateService: TranslateService): Asset[] {
  const currentLang = getCurrentLang(translateService);
  return (dtos || []).map(dto => mapExplosiveToAsset(dto, currentLang));
}


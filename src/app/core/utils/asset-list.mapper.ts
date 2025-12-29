import { Asset } from '../models/asset-list.model';
import { AmmunitionReadDto } from '../models/ammunition.model';
import { WeaponDto } from '../models/weapon.model';
import { ExplosiveDto } from '../models/explosive.model';
import { getLocalizedName, getCurrentLang } from './localization.utils';
import { getExplosiveTypeName } from './explosive.utils';
import { TranslateService } from '@ngx-translate/core';
import { formatDateTimeMilitary } from './format.utils';

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
    caseType: getLocalizedName(dto.caseType, currentLang) || '-',
    hazardDivision: getLocalizedName(dto.hazardDivision, currentLang) || '-',
    compatibility: getLocalizedName(dto.compatibility, currentLang) || '-',
    propellant: getLocalizedName(dto.propellant, currentLang) || '-',
    expiryDate: dto.expiryDate ? formatDateTimeMilitary(dto.expiryDate, true) : '-',
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
export function mapWeaponToAsset(dto: WeaponDto): Asset {
  // Note: imageUrl is not set here because fileUrl from response is a network path
  // Images will be loaded as blobs in loadImagesFromResponse() using the image ID

  return {
    id: dto.id?.toString() || '-',
    name: dto.name || 'Unknown',
    itemNo: dto.itemNo || '-',
    partNo: dto.partNo || '-',
    batchNo: dto.batchNo || '-',
    nsn: dto.nsn || '-',
    caliber: dto.caliber,
    expiryDate: dto.expiryDate ? formatDateTimeMilitary(dto.expiryDate, true) : '-',
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
export function mapExplosiveToAsset(dto: ExplosiveDto): Asset {
  // Note: imageUrl is not set here because fileUrl from response is a network path
  // Images will be loaded as blobs in loadImagesFromResponse() using the image ID

  return {
    id: dto.id?.toString() || '-',
    name: dto.name || 'Unknown',
    itemNo: dto.itemNo || '-',
    partNo: dto.partNo || '-',
    batchNo: dto.batchNo || '-',
    nsn: dto.nsn || '-',
    explosiveType: dto.explosiveType ? getExplosiveTypeName(dto.explosiveType) : '-',
    unNumber: dto.unNumber,
    netExplosiveQuantity: dto.netExplosiveQuantity,
    netExplosiveQuantityUnit: dto.netExplosiveQuantityUnit,
    totalWeight: dto.totalWeight,
    totalWeightUnit: dto.totalWeightUnit,
    hazardDivision: dto.hazardDivision,
    compatibility: dto.compatibility,
    expiryDate: dto.expiryDate ? formatDateTimeMilitary(dto.expiryDate, true) : '-',
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
export function mapWeaponArrayToAssets(dtos: WeaponDto[]): Asset[] {
  return (dtos || []).map(dto => mapWeaponToAsset(dto));
}

/**
 * Maps array of ExplosiveDto to Asset[]
 */
export function mapExplosiveArrayToAssets(dtos: ExplosiveDto[]): Asset[] {
  return (dtos || []).map(dto => mapExplosiveToAsset(dto));
}


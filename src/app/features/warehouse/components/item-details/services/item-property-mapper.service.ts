import { Injectable, Optional } from '@angular/core';
import { Cartridge } from '@models/cartridge.model';
import { Asset } from '@models/asset-list.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';
import { TranslationService } from '@services/translation.service';
import { ItemDetailsResolvedContext } from '../models/item-details-resolved-context';

type AssetUnion = Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto;
type InventoryItem = NonNullable<InventoryDetailDto['item']>;

interface CatalogFieldsLike {
  itemNo?: string;
  nsn?: string;
  partNo?: string;
}

interface LookupLike {
  nameAr: string;
  nameEn: string;
}

@Injectable()
export class ItemPropertyMapperService {
  constructor(
    private propertyAccessor: AssetPropertyAccessor,
    @Optional() private translationService?: TranslationService
  ) {}

  getItemName(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      const invItem = item as InventoryDetailDto;
      if (invItem.item) {
        return this.getInventoryItemName(invItem.item);
      }
      return '';
    }
    if (ctx.isCartridge) {
      return (item as Cartridge).name || '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.propertyAccessor.getAssetName(item as AssetUnion);
    }
    return '';
  }

  getProductId(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).item?.itemNo || '';
    }
    if (ctx.isCartridge) {
      const cartridge = item as Cartridge;
      return cartridge.productId || cartridge.itemNo || '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.getCatalogFields(item)?.itemNo || '';
    }
    return '';
  }

  getNSN(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).item?.nsn || '';
    }
    if (ctx.isCartridge) {
      return (item as Cartridge).ncn || '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.getCatalogFields(item)?.nsn || '';
    }
    return '';
  }

  getPrimaryPurpose(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const primaryPurpose = (item as Cartridge).primaryPurpose;
      return typeof primaryPurpose === 'string' ? primaryPurpose : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getPrimaryPurpose(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getWeaponType(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const weaponType = (item as Cartridge).weaponType;
      return typeof weaponType === 'string' ? weaponType : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getTypeForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getExplosiveType(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const explosiveType = (item as Cartridge).explosiveType;
      return typeof explosiveType === 'string' ? explosiveType : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isExplosive) {
      return this.propertyAccessor.getExplosiveTypeName(item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getProjectileColor(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const projectileColor = (item as Cartridge).projectileColor;
      return typeof projectileColor === 'string' ? projectileColor : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getProjectileColor(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getTotalWeight(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return (item as Cartridge).totalWeight || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getTotalWeight(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getProjectileMaterial(ctx: ItemDetailsResolvedContext): string {
    if (ctx.isCartridge) {
      return (ctx.item as Cartridge).projectileMaterial || '';
    }
    return '';
  }

  getCaseType(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const caseType = (item as Cartridge).caseType;
      return typeof caseType === 'string' ? caseType : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getCaseType(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getPrimer(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const primer = (item as Cartridge).primer;
      return typeof primer === 'string' ? primer : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getPrimer(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getPropellant(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const propellant = (item as Cartridge).propellant;
      return typeof propellant === 'string' ? propellant : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getPropellant(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getHazardDivision(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const hazardDivision = (item as Cartridge).hazardDivision;
      return typeof hazardDivision === 'string' ? hazardDivision : '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return (
        this.propertyAccessor.getHazardDivision(item as Asset | AmmunitionReadDto | ExplosiveDto) ||
        ''
      );
    }
    return '';
  }

  getCapabilityGroup(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return (item as Cartridge).capabilityGroup || '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return (
        this.propertyAccessor.getCompatibility(item as Asset | AmmunitionReadDto | ExplosiveDto) ||
        ''
      );
    }
    return '';
  }

  getCaliber(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const caliber = (item as Cartridge).caliber;
      return typeof caliber === 'string' ? caliber : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getCaliber(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getActionType(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const actionType = (item as Cartridge).actionType;
      return typeof actionType === 'string' ? actionType : '';
    }
    return '';
  }

  getBarrelLengthLabel(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const barrelLengthLabel = (item as Cartridge).barrelLengthLabel;
      return typeof barrelLengthLabel === 'string' ? barrelLengthLabel : '';
    }
    return '';
  }

  getOverallLengthLabel(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const overallLengthLabel = (item as Cartridge).overallLengthLabel;
      return typeof overallLengthLabel === 'string' ? overallLengthLabel : '';
    }
    return '';
  }

  getWeightLabel(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const weightLabel = (item as Cartridge).weightLabel;
      return typeof weightLabel === 'string' ? weightLabel : '';
    }
    return '';
  }

  getCapacity(ctx: ItemDetailsResolvedContext): number | undefined {
    if (ctx.isCartridge) {
      return (ctx.item as Cartridge).capacity;
    }
    return undefined;
  }

  getUnNumber(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const unNumber = (item as Cartridge).unNumber;
      return typeof unNumber === 'string' ? unNumber : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isExplosive) {
      return this.propertyAccessor.getUnNumber(item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getNetExplosiveQuantityLabel(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      const netExplosiveQuantityLabel = (item as Cartridge).netExplosiveQuantityLabel;
      return typeof netExplosiveQuantityLabel === 'string' ? netExplosiveQuantityLabel : '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isExplosive) {
      return this.propertyAccessor.getNetExplosiveQuantity(item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getTotalWeightLabel(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return (item as Cartridge).totalWeightLabel || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isExplosive) {
      return this.propertyAccessor.getTotalWeight(item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getArmNumber(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return (item as Cartridge).armNumber || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getArmNumber(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getBulletDiameter(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return (item as Cartridge).bulletDiameterLabel || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getBulletDiameter(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getPartNo(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).item?.partNo || '';
    }
    if (ctx.isCartridge) {
      return '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.getCatalogFields(item)?.partNo || '';
    }
    return '';
  }

  getBatchNo(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).batchNo || '';
    }
    if (ctx.isCartridge) {
      return '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return (
        this.propertyAccessor.getBatchNo(item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto) ||
        ''
      );
    }
    return '';
  }

  getPrice(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).item?.price?.toString() || '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.propertyAccessor.getPrice(item as AssetUnion) || '';
    }
    return '';
  }

  getMinimumQuantity(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).item?.minimumQuantity?.toString() || '';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.propertyAccessor.getMinimumQuantity(item as AssetUnion) || '';
    }
    return '';
  }

  getExpiryDate(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      const expiryDate = (item as InventoryDetailDto).expiryDate;
      if (!expiryDate) {
        return '';
      }
      try {
        const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
        return date.toLocaleDateString();
      } catch {
        return '';
      }
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.propertyAccessor.getExpiryDate(item as AssetUnion) || '';
    }
    return '';
  }

  getReadyForIssue(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isInventoryDetail) {
      return (item as InventoryDetailDto).readyForIssue ? 'Yes' : 'No';
    }
    if (ctx.isAsset || ctx.isDirectDto) {
      return this.propertyAccessor.getReadyForIssue(item as AssetUnion) || '';
    }
    return '';
  }

  getDistribution(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && (ctx.isAmmunition || ctx.isExplosive)) {
      return this.propertyAccessor.getDistribution(item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    return '';
  }

  getReferenceNo(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && (ctx.isAmmunition || ctx.isExplosive)) {
      return this.propertyAccessor.getReferenceNo(item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getReferenceNoForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getClassification(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if ((ctx.isAsset || ctx.isDirectDto) && (ctx.isAmmunition || ctx.isExplosive)) {
      return this.propertyAccessor.getClassification(item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getClassificationForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getCaliberCategory(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getAmmunitionCaliberCategory(item as Asset | AmmunitionReadDto) || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getWeaponCaliberCategory(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getType(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if ((ctx.isAsset || ctx.isDirectDto) && (ctx.isAmmunition || ctx.isExplosive)) {
      return this.propertyAccessor.getType(item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getTypeForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getNotes(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && (ctx.isAmmunition || ctx.isExplosive)) {
      return this.propertyAccessor.getNotes(item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getNotesForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getUnNumberForAmmunition(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return (item as Cartridge).unNumber || '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getUnNumberForAmmunition(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getLinked(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isAmmunition) {
      return this.propertyAccessor.getLinked(item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getModel(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getModel(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getYearOfManufacture(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getYearOfManufacture(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getCountryOfManufacture(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getCountryOfManufacture(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getCaliberUnit(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return '';
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getCaliberUnit(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getDistributionForWeapon(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getDistributionForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getUnNumberForWeapon(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      return this.propertyAccessor.getUnNumberForWeapon(item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getBarrelLengthWithUnit(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return this.getBarrelLengthLabel(ctx);
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      const weapon = item as Asset | WeaponDto;
      if (weapon && 'barrelLength' in weapon && weapon.barrelLength != null) {
        const unit = this.getLookupDisplayName(weapon.barrelLengthUnit);
        return `${weapon.barrelLength}${unit ? ' ' + unit : ''}`.trim();
      }
    }
    return '';
  }

  getOverallLengthWithUnit(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return this.getOverallLengthLabel(ctx);
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      const weapon = item as Asset | WeaponDto;
      if (weapon && 'overallLength' in weapon && weapon.overallLength != null) {
        const unit = this.getLookupDisplayName(weapon.overallLengthUnit);
        return `${weapon.overallLength}${unit ? ' ' + unit : ''}`.trim();
      }
    }
    return '';
  }

  getWeightWithUnit(ctx: ItemDetailsResolvedContext): string {
    const { item } = ctx;
    if (ctx.isCartridge) {
      return this.getWeightLabel(ctx);
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      const weapon = item as Asset | WeaponDto;
      if (weapon && 'weight' in weapon && weapon.weight != null) {
        const unit = this.getLookupDisplayName(weapon.weightUnit);
        return `${weapon.weight}${unit ? ' ' + unit : ''}`.trim();
      }
    }
    return '';
  }

  getCapacityForWeapon(ctx: ItemDetailsResolvedContext): number | undefined {
    if (ctx.isCartridge) {
      return this.getCapacity(ctx);
    }
    if ((ctx.isAsset || ctx.isDirectDto) && ctx.isWeapon) {
      const weapon = ctx.item as Asset | WeaponDto;
      return weapon && 'capacity' in weapon ? weapon.capacity : undefined;
    }
    return undefined;
  }

  private getLookupDisplayName(lookup: unknown): string {
    if (!lookup) {
      return '';
    }
    if (typeof lookup === 'string') {
      return lookup;
    }
    if (this.isLookupLike(lookup)) {
      return this.translationService?.isRTL() ? lookup.nameAr : lookup.nameEn;
    }
    return '';
  }

  private getInventoryItemName(item: InventoryItem): string {
    if (typeof item.name === 'string' && item.name.trim().length > 0) {
      return item.name;
    }
    return item.itemNo || '';
  }

  private getCatalogFields(item: ItemDetailsResolvedContext['item']): CatalogFieldsLike | null {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    return item as CatalogFieldsLike;
  }

  private isLookupLike(lookup: unknown): lookup is LookupLike {
    if (typeof lookup !== 'object' || lookup === null) {
      return false;
    }
    if (!('nameAr' in lookup) || !('nameEn' in lookup)) {
      return false;
    }
    return typeof lookup.nameAr === 'string' && typeof lookup.nameEn === 'string';
  }
}

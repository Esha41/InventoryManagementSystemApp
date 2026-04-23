import { Injectable, inject, computed, Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';
import { getLookupDisplayName } from '@utils/asset-list.utils';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import type { AssetUnion } from '@utils/asset-property.utils';
import { AssetDetailsData } from './asset-details.component';

/**
 * Service for formatting asset details
 * Extracts all getter logic from component following Angular 21 best practices
 */
@Injectable()
export class AssetDetailsFormatterService {
  private readonly propertyAccessor = inject(AssetPropertyAccessor);
  private readonly translateService = inject(TranslateService);

  /**
   * Create computed signals for all asset detail fields
   * This replaces all the getter methods in the component
   */
  createFormattedFields(
    asset: Signal<AssetDetailsData>,
    isAmmunition: Signal<boolean>,
    isWeapon: Signal<boolean>,
    isExplosive: Signal<boolean>
  ) {
    return {
      // Common fields
      assetName: computed(() => this.propertyAccessor.getAssetName(asset()) || '-'),
      productId: computed(() => asset()?.itemNo || '-'),
      nsn: computed(() => asset()?.nsn || '-'),
      partNo: computed(() => asset()?.partNo || '-'),
      batchNo: computed(() => this.propertyAccessor.getBatchNo(asset()) || '-'),
      price: computed(() => this.propertyAccessor.getPrice(asset()) || '-'),
      minimumQuantity: computed(() => this.propertyAccessor.getMinimumQuantity(asset()) || '-'),
      criticalQuantity: computed(() => this.propertyAccessor.getCriticalQuantity(asset()) || '-'),
      expiryDate: computed(() => this.propertyAccessor.getExpiryDate(asset()) || '-'),
      readyForIssue: computed(() => this.propertyAccessor.getReadyForIssue(asset()) || '-'),

      // Ammunition and Explosive
      armNumber: computed(() =>
        (isAmmunition() || isExplosive())
          ? this.propertyAccessor.getArmNumber(asset() as AmmunitionReadDto | ExplosiveDto) || '-'
          : '-'
      ),
      primaryPurpose: computed(() =>
        isAmmunition() || isWeapon() || isExplosive()
          ? this.propertyAccessor.getPrimaryPurpose(asset()) || '-'
          : '-'
      ),
      projectileColor: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getProjectileColor(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      ammunitionCaliber: computed(() =>
        isAmmunition() || isExplosive()
          ? this.propertyAccessor.getAmmunitionCaliber(asset() as AmmunitionReadDto | ExplosiveDto) || '-'
          : '-'
      ),
      bulletDiameter: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getBulletDiameter(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      totalWeight: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getTotalWeight(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      projectileMaterial: computed(() => {
        if (isAmmunition() && asset()) {
          const ammo = asset() as AmmunitionReadDto;
          return getLookupDisplayName(ammo.projectailMaterial, this.translateService) || '-';
        }
        return '-';
      }),
      caseType: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getCaseType(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      primer: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getPrimer(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      propellant: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getPropellant(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      nature: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getNature(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      linked: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getLinked(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),
      unNumberForAmmunition: computed(() =>
        isAmmunition()
          ? this.propertyAccessor.getUnNumberForAmmunition(asset() as AmmunitionReadDto) || '-'
          : '-'
      ),

      // Weapon specific
      weaponType: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getTypeForWeapon(asset() as WeaponDto) || '-'
          : '-'
      ),
      caliber: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getCaliber(asset() as WeaponDto) || '-'
          : '-'
      ),
      caliberUnit: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getCaliberUnit(asset() as WeaponDto) || '-'
          : '-'
      ),
      model: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getModel(asset() as WeaponDto) || '-'
          : '-'
      ),
      yearOfManufacture: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getYearOfManufacture(asset() as WeaponDto) || '-'
          : '-'
      ),
      countryOfManufacture: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getCountryOfManufacture(asset() as WeaponDto) || '-'
          : '-'
      ),
      distributionForWeapon: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getDistributionForWeapon(asset() as WeaponDto) || '-'
          : '-'
      ),
      unNumberForWeapon: computed(() =>
        isWeapon()
          ? this.propertyAccessor.getUnNumberForWeapon(asset() as WeaponDto) || '-'
          : '-'
      ),

      // Explosive specific (enum label only)
      explosiveType: computed(() =>
        isExplosive()
          ? this.propertyAccessor.getExplosiveTypeName(asset() as ExplosiveDto) || '-'
          : '-'
      ),
      /** Catalog item type (lookup) preferred, then legacy enum name */
      explosiveTypeDisplay: computed(() => {
        if (!isExplosive() || !asset()) return '-';
        const ex = asset() as ExplosiveDto;
        const fromLookup = this.propertyAccessor.getType(ex as AssetUnion);
        if (fromLookup && fromLookup !== '-') return fromLookup;
        const fromEnum = this.propertyAccessor.getExplosiveTypeName(ex as AssetUnion);
        return fromEnum && fromEnum !== '-' ? fromEnum : '-';
      }),
      unNumber: computed(() =>
        isExplosive()
          ? this.propertyAccessor.getUnNumber(asset() as ExplosiveDto) || '-'
          : '-'
      ),
      netExplosiveQuantity: computed(() =>
        isExplosive()
          ? this.propertyAccessor.getNetExplosiveQuantity(asset() as ExplosiveDto) || '-'
          : '-'
      ),
      totalWeightForExplosive: computed(() =>
        isExplosive()
          ? this.propertyAccessor.getTotalWeight(asset() as ExplosiveDto) || '-'
          : '-'
      ),

      // Shared fields
      distribution: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getDistribution(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        return '-';
      }),
      referenceNo: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getReferenceNo(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        if (isWeapon()) {
          return this.propertyAccessor.getReferenceNoForWeapon(asset() as WeaponDto) || '-';
        }
        return '-';
      }),
      classification: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getClassification(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        if (isWeapon()) {
          return this.propertyAccessor.getClassificationForWeapon(asset() as WeaponDto) || '-';
        }
        return '-';
      }),
      type: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getType(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        if (isWeapon()) {
          return this.propertyAccessor.getTypeForWeapon(asset() as WeaponDto) || '-';
        }
        return '-';
      }),
      notes: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getNotes(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        if (isWeapon()) {
          return this.propertyAccessor.getNotesForWeapon(asset() as WeaponDto) || '-';
        }
        return '-';
      }),
      hazardDivision: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getHazardDivision(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        return '-';
      }),
      capabilityGroup: computed(() => {
        if (isAmmunition() || isExplosive()) {
          return this.propertyAccessor.getCompatibility(asset() as AmmunitionReadDto | ExplosiveDto) || '-';
        }
        return '-';
      }),

      // Placeholder fields
      barrelLengthWithUnit: computed(() => '-'),
      overallLengthWithUnit: computed(() => '-'),
      weightWithUnit: computed(() => '-'),
      capacity: computed<number | undefined>(() => undefined),

      // Missing fields required by template
      unit: computed(() => this.propertyAccessor.getUnit(asset()) || '-'),
      compatibility: computed(() =>
        (isAmmunition() || isExplosive())
          ? this.propertyAccessor.getCompatibility(asset() as AmmunitionReadDto | ExplosiveDto) || '-'
          : '-'
      ),
      priceForWeapon: computed(() =>
        isWeapon() ? this.propertyAccessor.getPrice(asset()) || '-' : '-'
      ),
      minimumQuantityForWeapon: computed(() =>
        isWeapon() ? this.propertyAccessor.getMinimumQuantity(asset()) || '-' : '-'
      ),
      countryOfManufactureForWeapon: computed(() =>
        isWeapon() ? this.propertyAccessor.getCountryOfManufacture(asset() as WeaponDto) || '-' : '-'
      ),
      itemType: computed(() =>
        isWeapon() ? this.propertyAccessor.getTypeForWeapon(asset() as WeaponDto) || '-' : '-'
      )
    };
  }
}

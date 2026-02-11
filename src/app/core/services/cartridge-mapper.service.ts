import { Injectable } from '@angular/core';
import { Cartridge } from '@requests/pages/new-issue/components/cartridge-list/cartridge-list.component';
import { getLocalizedName } from '@utils/localization.utils';
import { getWeaponTypeName, getActionTypeName } from '@utils/weapon.utils';
import { getExplosiveTypeName } from '@utils/explosive.utils';

@Injectable({
  providedIn: 'root'
})
export class CartridgeMapperService {

  mapAmmunitionToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    // Bullet diameter unit values should not be translated (always use English)
    const bulletDiameterLabel = this.buildMeasurementLabel(dto.bulletDiameter, dto.bulletDiameterUnit, currentLang, true);

    // Linked labels - Arabic and English
    const linkedLabelAr = dto.isLinked ? 'مرتبط' : 'غير مرتبط';
    const linkedLabelEn = dto.isLinked ? 'Linked' : 'Not Linked';
    const linkedLabel = currentLang === 'ar' ? linkedLabelAr : linkedLabelEn;

    // Nature labels - extract Arabic and English from natureOption
    const natureOption = dto.natureOption || {};
    const natureLabelAr = natureOption.nameAr || natureOption.nameAR || null;
    const natureLabelEn = natureOption.nameEn || natureOption.nameEN || null;
    const natureLabel = getLocalizedName(dto.natureOption, currentLang);

    // Extract Arabic and English names from DTO
    const nameAr = dto.nameAr || dto.nameAR || null;
    const nameEn = dto.nameEn || dto.nameEN || null;

    return {
      id: Number(dto.id) || 0,
      name: getLocalizedName(dto, currentLang) || dto.itemNo || 'Ammunition',
      nameAr: nameAr || undefined,
      nameEn: nameEn || undefined,
      selected: false,
      added: false,
      quantity: null,
      itemNo: dto.itemNo,
      productId: dto.itemNo, // Using itemNo as productId fallback
      ncn: dto.nsn || undefined,
      primaryPurpose: getLocalizedName(dto.primaryPurpos, currentLang),
      projectileColor: getLocalizedName(dto.projectileColor, currentLang),
      totalWeight: dto.totalWeight ? `${dto.totalWeight} g` : undefined,
      projectileMaterial: getLocalizedName(dto.projectailMaterial, currentLang),
      caseType: getLocalizedName(dto.caseType, currentLang),
      primer: dto.primer,
      propellant: getLocalizedName(dto.propellant, currentLang),
      hazardDivision: getLocalizedName(dto.hazardDivision, currentLang),
      capabilityGroup: getLocalizedName(dto.compatibility, currentLang),
      bulletDiameterLabel,
      linkedLabel,
      linkedLabelAr: linkedLabelAr || undefined,
      linkedLabelEn: linkedLabelEn || undefined,
      natureLabel,
      natureLabelAr: natureLabelAr || undefined,
      natureLabelEn: natureLabelEn || undefined,
      // Backend returns enum as string: "Small", "Medium", "Large"
      ammunitionType: dto.ammunitionType ? String(dto.ammunitionType) : undefined,
      armNumber: dto.armNumber || undefined,
      itemType: 'Ammunition' // Set item type for ammunition
    };
  }

  mapAmmunitionArrayToCartridges(dtos: any[], currentLang: string = 'en'): Cartridge[] {
    return (dtos || []).map(dto => this.mapAmmunitionToCartridge(dto, currentLang));
  }

  mapWeaponToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    const nameAr = dto.nameAr || dto.nameAR || null;
    const nameEn = dto.nameEn || dto.nameEN || null;

    // Build barrel length label with unit
    const barrelLengthLabel = this.buildMeasurementLabel(
      dto.barrelLength,
      dto.barrelLengthUnit,
      currentLang
    );

    // Build overall length label with unit
    const overallLengthLabel = this.buildMeasurementLabel(
      dto.overallLength,
      dto.overallLengthUnit,
      currentLang
    );

    // Build weight label with unit
    const weightLabel = this.buildMeasurementLabel(
      dto.weight,
      dto.weightUnit,
      currentLang
    );

    return {
      id: Number(dto.id),
      name: getLocalizedName(dto, currentLang) || 'Weapon',
      nameAr: nameAr || undefined,
      nameEn: nameEn || undefined,
      itemNo: dto.itemNo,
      productId: dto.itemNo, // Set productId for weapons
      ncn: dto.nsn || undefined,
      selected: false,
      added: false,
      itemType: 'Weapon', // Set item type for weapons

      // Weapon specific - backend sends enum as string (JsonStringEnumConverter)
      weaponType: dto.weaponType ? getWeaponTypeName(dto.weaponType) : undefined,
      caliber: dto.caliber,
      actionType: dto.actionType ? getActionTypeName(dto.actionType) : undefined,
      barrelLength: dto.barrelLength,
      barrelLengthLabel: barrelLengthLabel,
      overallLength: dto.overallLength,
      overallLengthLabel: overallLengthLabel,
      weight: dto.weight,
      weightLabel: weightLabel,
      capacity: dto.capacity
    };
  }

  mapWeaponArrayToCartridges(dtos: any[], currentLang: string = 'en'): Cartridge[] {
    return (dtos || []).map(dto => this.mapWeaponToCartridge(dto, currentLang));
  }

  mapExplosiveToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    const nameAr = dto.nameAr || dto.nameAR || null;
    const nameEn = dto.nameEn || dto.nameEN || null;

    // Build total weight label with unit
    const totalWeightLabel = this.buildMeasurementLabel(
      dto.totalWeight,
      dto.totalWeightUnit,
      currentLang
    );

    // Build net explosive quantity label with unit
    const netExplosiveQuantityLabel = this.buildMeasurementLabel(
      dto.netExplosiveQuantity,
      dto.netExplosiveQuantityUnit,
      currentLang
    );

    return {
      id: Number(dto.id),
      name: getLocalizedName(dto, currentLang) || 'Explosive',
      nameAr: nameAr || undefined,
      nameEn: nameEn || undefined,
      itemNo: dto.itemNo,
      productId: dto.itemNo, // Set productId for explosives
      ncn: dto.nsn || undefined,
      selected: false,
      added: false,
      itemType: 'Explosive', // Set item type for explosives

      // Explosive specific - backend sends enum as string (JsonStringEnumConverter)
      explosiveType: dto.explosiveType ? getExplosiveTypeName(dto.explosiveType) : undefined,
      unNumber: dto.unNumber,
      netExplosiveQuantity: dto.netExplosiveQuantity,
      netExplosiveQuantityLabel: netExplosiveQuantityLabel,
      totalWeight: dto.totalWeight,
      totalWeightLabel: totalWeightLabel,
      hazardDivision: getLocalizedName(dto.hazardDivision, currentLang),
      capabilityGroup: getLocalizedName(dto.compatibility, currentLang)
    };
  }

  mapExplosiveArrayToCartridges(dtos: any[], currentLang: string = 'en'): Cartridge[] {
    return (dtos || []).map(dto => this.mapExplosiveToCartridge(dto, currentLang));
  }

  /**
   * Check if a cartridge is a weapon
   */
  isWeapon(cartridge: Cartridge | null): boolean {
    if (!cartridge) return false;
    return !!(cartridge.weaponType || cartridge.caliber || cartridge.actionType);
  }

  /**
   * Check if a cartridge is an explosive
   */
  isExplosive(cartridge: Cartridge | null): boolean {
    if (!cartridge) return false;
    return !!(cartridge.explosiveType || cartridge.unNumber || cartridge.netExplosiveQuantity !== undefined);
  }

  /**
   * Check if a cartridge is ammunition
   */
  isAmmunition(cartridge: Cartridge | null): boolean {
    if (!cartridge) return false;
    return !this.isWeapon(cartridge) && !this.isExplosive(cartridge);
  }

  private buildMeasurementLabel(value: any, unit: any, currentLang: string = 'en', useEnglishUnit: boolean = false): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    // If useEnglishUnit is true, always use English unit name (for bullet diameter values)
    const unitName = useEnglishUnit
      ? (unit?.nameEn || unit?.nameEN || unit?.name || '')
      : getLocalizedName(unit, currentLang);
    return unitName ? `${numeric} ${unitName}` : `${numeric}`;
  }
}

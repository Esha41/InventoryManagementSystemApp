import { Injectable } from '@angular/core';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { getLocalizedName } from '@utils/localization.utils';
import { getWeaponTypeName, getActionTypeName } from '@utils/weapon.utils';
import { getExplosiveTypeName } from '@utils/explosive.utils';

@Injectable({
  providedIn: 'root'
})
export class CartridgeMapperService {

  mapAmmunitionToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    const bulletDiameterLabel = this.buildMeasurementLabel(dto.bulletDiameter, dto.bulletDiameterUnit, currentLang);

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
      armNumber: dto.armNumber || undefined
    };
  }

  mapAmmunitionArrayToCartridges(dtos: any[], currentLang: string = 'en'): Cartridge[] {
    return (dtos || []).map(dto => this.mapAmmunitionToCartridge(dto, currentLang));
  }

  mapWeaponToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    const nameAr = dto.nameAr || dto.nameAR || null;
    const nameEn = dto.nameEn || dto.nameEN || null;

    return {
      id: Number(dto.id),
      name: getLocalizedName(dto, currentLang) || 'Weapon',
      nameAr: nameAr || undefined,
      nameEn: nameEn || undefined,
      itemNo: dto.itemNo,
      ncn: dto.nsn || undefined,
      selected: false,
      added: false,

      // Weapon specific
      weaponType: getWeaponTypeName(dto.weaponType),
      caliber: dto.caliber,
      actionType: getActionTypeName(dto.actionType),
      barrelLength: dto.barrelLength // Could add unit label helper here
    };
  }

  mapWeaponArrayToCartridges(dtos: any[], currentLang: string = 'en'): Cartridge[] {
    return (dtos || []).map(dto => this.mapWeaponToCartridge(dto, currentLang));
  }

  mapExplosiveToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    const nameAr = dto.nameAr || dto.nameAR || null;
    const nameEn = dto.nameEn || dto.nameEN || null;

    return {
      id: Number(dto.id),
      name: getLocalizedName(dto, currentLang) || 'Explosive',
      nameAr: nameAr || undefined,
      nameEn: nameEn || undefined,
      itemNo: dto.itemNo,
      ncn: dto.nsn || undefined, // nsn is used for display
      selected: false,
      added: false,

      // Explosive specific
      explosiveType: getExplosiveTypeName(dto.explosiveType),
      unNumber: dto.unNumber,
      netExplosiveQuantity: dto.netExplosiveQuantity
    };
  }

  mapExplosiveArrayToCartridges(dtos: any[], currentLang: string = 'en'): Cartridge[] {
    return (dtos || []).map(dto => this.mapExplosiveToCartridge(dto, currentLang));
  }

  private buildMeasurementLabel(value: any, unit: any, currentLang: string = 'en'): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    const unitName = getLocalizedName(unit, currentLang);
    return unitName ? `${numeric} ${unitName}` : `${numeric}`;
  }
}

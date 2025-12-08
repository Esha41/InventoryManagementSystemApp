import { Injectable } from '@angular/core';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { getLocalizedName } from '@utils/localization.utils';

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
      productId: dto.itemNo,
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


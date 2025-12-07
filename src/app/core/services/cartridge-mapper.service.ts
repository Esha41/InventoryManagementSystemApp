import { Injectable } from '@angular/core';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { getLocalizedName } from '@utils/localization.utils';

@Injectable({
  providedIn: 'root'
})
export class CartridgeMapperService {

  mapAmmunitionToCartridge(dto: any, currentLang: string = 'en'): Cartridge {
    const bulletDiameterLabel = this.buildMeasurementLabel(dto.bulletDiameter, dto.bulletDiameterUnit, currentLang);
    const linkedLabel = dto.isLinked ? 'Linked' : 'Not Linked';
    const natureLabel = getLocalizedName(dto.natureOption, currentLang);

    return {
      id: Number(dto.id) || 0,
      name: getLocalizedName(dto, currentLang) || dto.itemNo || 'Ammunition',
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
      natureLabel,
      ammunitionType: dto.ammunitionType ? Number(dto.ammunitionType) : undefined,
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


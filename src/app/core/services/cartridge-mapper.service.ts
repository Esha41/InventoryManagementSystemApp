import { Injectable } from '@angular/core';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';

@Injectable({
  providedIn: 'root'
})
export class CartridgeMapperService {

  mapAmmunitionToCartridge(dto: any): Cartridge {
    const bulletDiameterLabel = this.buildMeasurementLabel(dto.bulletDiameter, dto.bulletDiameterUnit);
    const caseLengthLabel = this.buildMeasurementLabel(dto.caseLength, dto.caseLengthUnit);
    const linkedLabel = dto.isLinked ? 'Linked' : 'Not Linked';
    const natureLabel = dto.natureOption?.nameEn || dto.natureOption?.nameAr;

    return {
      id: Number(dto.id) || 0,
      name: dto.name || dto.itemNo || 'Ammunition',
      selected: false,
      added: false,
      quantity: null,
      itemNo: dto.itemNo,
      productId: dto.itemNo,
      ncn: dto.nsn || undefined,
      primaryPurpose: dto.primaryPurpos?.nameEn || dto.primaryPurpos?.nameAr,
      projectileColor: dto.projectileColor?.nameEn || dto.projectileColor?.nameAr,
      totalWeight: dto.totalWeight ? `${dto.totalWeight} g` : undefined,
      projectileMaterial: dto.projectailMaterial?.nameEn || dto.projectailMaterial?.nameAr,
      caseType: dto.caseType?.nameEn || dto.caseType?.nameAr,
      primer: dto.primer,
      propellant: dto.propellant?.nameEn || dto.propellant?.nameAr,
      hazardDivision: dto.hazardDivision?.nameEn || dto.hazardDivision?.nameAr,
      capabilityGroup: dto.compatibility?.nameEn || dto.compatibility?.nameAr,
      bulletDiameterLabel,
      caseLengthLabel,
      linkedLabel,
      natureLabel,
      ammunitionType: dto.ammunitionType ? Number(dto.ammunitionType) : undefined
    };
  }

  mapAmmunitionArrayToCartridges(dtos: any[]): Cartridge[] {
    return (dtos || []).map(dto => this.mapAmmunitionToCartridge(dto));
  }

  private buildMeasurementLabel(value: any, unit: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return undefined;
    }
    const unitName = unit?.nameEn || unit?.nameAr;
    return unitName ? `${numeric} ${unitName}` : `${numeric}`;
  }
}


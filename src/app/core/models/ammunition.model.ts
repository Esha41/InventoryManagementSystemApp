import { ItemType } from './inventory.model';
import type { FileUploadDto } from './file-upload.model';

export interface LookupDto {
  id: number;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
  nameAR?: string | null;
  nameEN?: string | null;
}

export interface CatalogBaseItemDto {
  id: number;
  name: string;
  nameAr?: string | null;
  itemNo: string;
  itemType: ItemType;
  nsn?: string | null;
  partNo?: string | null;
  price?: number | null;
  minimumQuantity?: number | null;
  criticalQuantity?: number | null;
  maximumStock?: number | null;
  distribution?: string | null;
  referenceNo?: string | null;
  unNumber?: string | null;
  notes?: string | null;
  classificationId?: number | null;
  typeId?: number | null;
  isDeleted: boolean;
  classification?: LookupDto | null;
  type?: LookupDto | null;
  images?: FileUploadDto[];
  /** BaseItemPrimaryPurposes */
  primaryPurposes?: LookupDto[];
}


export interface AmmunitionDto extends CatalogBaseItemDto {
  ammunitionType?: number | null;
  bulletDiameter?: number | null;
  bulletDiameterUnitId?: number | null;
  armNumber?: string | null;
  caliberId?: number | null;
  isLinked: boolean;
  primer?: string | null;
  totalWeight?: number | null;
  natureOptionId?: number | null;
  projectileColorId?: number | null;
  projectailMaterialId?: number | null;
  caseTypeId?: number | null;
  propellantId?: number | null;
  compatibilityId?: number | null;
  hazardDivisionId?: number | null;
  caliber?: LookupDto | null;
  bulletDiameterUnit?: LookupDto | null;
  natureOption?: LookupDto | null;
  projectileColor?: LookupDto | null;
  projectailMaterial?: LookupDto | null;
  caseType?: LookupDto | null;
  propellant?: LookupDto | null;
  compatibility?: LookupDto | null;
  hazardDivision?: LookupDto | null;
}

export interface AmmunitionReadDtoExtras {
  lot?: number;
  batchNo?: string;
  hccId?: number;
  supplierId?: number;
  countryId?: number;
  manufacturerId?: number;
  primaryPurposId?: number;
  /** Legacy single navigation when `primaryPurposes` is not populated */
  primaryPurpos?: LookupDto;
  readyForIssue?: boolean;
  expiryDate?: Date | string;
  createdDate?: Date;
  modifiedDate?: Date;
  hcc?: LookupDto;
  supplier?: LookupDto;
  country?: LookupDto;
  manufacturer?: LookupDto;
}

export type AmmunitionReadDto = AmmunitionDto & AmmunitionReadDtoExtras;

export interface AmmunitionCreateDto {
  name: string;
  nameAr?: string;
  itemNo: string;
  partNo?: string;
  armNumber?: string;
  caliberId?: number | null;
  hccId?: number;
  supplierId?: number;
  countryId?: number;
  manufacturerId?: number;
  natureOptionId?: number;
  bulletDiameter?: number;
  bulletDiameterUnitId?: number;
  isLinked?: boolean;
  primer?: string;
  totalWeight?: number;
  nsn?: string;
  primaryPurposIds?: number[];
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId?: number;
  propellantId?: number;
  compatibilityId?: number;
  hazardDivisionId?: number;
  distribution?: string;
  unNumber?: string;
  referenceNo?: string;
  classificationId?: number;
  typeId?: number;
  ammunitionType?: number;
  notes?: string;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
  maximumStock?: number;
}

export interface AmmunitionUpdateDto {
  name: string;
  nameAr?: string;
  partNo: string;
  id: number;
  itemNo: string;
  lot: number;
  batchNo: string;
  hccId: number;
  supplierId?: number;
  countryId?: number;
  manufacturerId?: number;
  natureOptionId?: number;
  bulletDiameter?: number;
  bulletDiameterUnitId?: number;
  armNumber?: string;
  caliberId?: number | null;
  caliber?: LookupDto | null;
  isLinked: boolean;
  primer?: string;
  totalWeight?: number;
  nsn?: string;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId?: number;
  propellantId?: number;
  compatibilityId?: number;
  hazardDivisionId?: number;
  readyForIssue: boolean;
}

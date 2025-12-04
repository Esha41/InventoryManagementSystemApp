// Import lookup DTOs
export interface LookupDto {
  id: number;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
}

export interface AmmunitionReadDto {
  name: string;
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
  bulletDiameter: number;
  bulletDiameterUnitId: number;
  caseLength: number;
  caseLengthUnitId: number;
  isLinked: boolean;
  primer: string;
  totalWeight: number;
  nsn?: string;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId: number;
  propellantId: number;
  compatibilityId: number;
  hazardDivisionId: number;
  readyForIssue: boolean;
  expiryDate?: Date | string;
  price?: number;
  minimumQuantity?: number;
  createdDate: Date;
  modifiedDate?: Date;
  
  // Navigation properties
  hcc?: LookupDto;
  supplier?: LookupDto;
  country?: LookupDto;
  manufacturer?: LookupDto;
  natureOption?: LookupDto;
  bulletDiameterUnit?: LookupDto;
  caseLengthUnit?: LookupDto;
  primaryPurpos?: LookupDto;
  projectileColor?: LookupDto;
  projectailMaterial?: LookupDto;
  caseType?: LookupDto;
  propellant?: LookupDto;
  compatibility?: LookupDto;
  hazardDivision?: LookupDto;
}

export interface AmmunitionCreateDto {
  name: string;
  partNo: string;
  itemNo: string;
  // Note: batchNo, readyForIssue, and expiryDate are NOT in backend CreateUpdateAmmunitionDto
  // These fields are managed at the lot/inventory level, not the ammunition catalog level
  hccId: number;
  supplierId?: number;
  countryId?: number;
  manufacturerId?: number;
  natureOptionId?: number;
  bulletDiameter: number;
  bulletDiameterUnitId: number;
  caseLength: number;
  caseLengthUnitId: number;
  isLinked: boolean;
  primer: string;
  totalWeight: number;
  nsn?: string;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId: number;
  propellantId: number;
  compatibilityId: number;
  hazardDivisionId: number;
  price?: number;
  minimumQuantity?: number;
}

export interface AmmunitionUpdateDto {
  name: string;
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
  bulletDiameter: number;
  bulletDiameterUnitId: number;
  caseLength: number;
  caseLengthUnitId: number;
  isLinked: boolean;
  primer: string;
  totalWeight: number;
  nsn?: string;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId: number;
  propellantId: number;
  compatibilityId: number;
  hazardDivisionId: number;
  readyForIssue: boolean;
}


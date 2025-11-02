// Import lookup DTOs
export interface LookupDto {
  id: number;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
}

export interface AmmunitionReadDto {
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
  nsnId: number;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId: number;
  propellantId: number;
  compatibilityId: number;
  hazardDivisionId: number;
  readyForIssue: boolean;
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
  nsn?: LookupDto;
  primaryPurpos?: LookupDto;
  projectileColor?: LookupDto;
  projectailMaterial?: LookupDto;
  caseType?: LookupDto;
  propellant?: LookupDto;
  compatibility?: LookupDto;
  hazardDivision?: LookupDto;
}

export interface AmmunitionCreateDto {
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
  nsnId: number;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId: number;
  propellantId: number;
  compatibilityId: number;
  hazardDivisionId: number;
  readyForIssue?: boolean;
}

export interface AmmunitionUpdateDto {
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
  nsnId: number;
  primaryPurposId?: number;
  projectileColorId?: number;
  projectailMaterialId?: number;
  caseTypeId: number;
  propellantId: number;
  compatibilityId: number;
  hazardDivisionId: number;
  readyForIssue: boolean;
}


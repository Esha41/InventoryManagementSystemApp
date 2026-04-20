// Import lookup DTOs
export interface LookupDto {
  id: number;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
}

export interface ImageDto {
  id: number;
  fileUrl: string;
  fileName: string;
  originalName: string;
  isMain: boolean;
  entity: string;
  entityId: number;
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
  bulletDiameter?: number;
  bulletDiameterUnitId?: number;
  armNumber?: string;
  caliber?: string;
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
  distribution?: string;
  unNumber?: string;
  referenceNo?: string;
  classificationId?: number;
  typeId?: number;
  notes?: string;
  readyForIssue: boolean;
  expiryDate?: Date | string;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
  createdDate: Date;
  modifiedDate?: Date;
  
  // Navigation properties
  hcc?: LookupDto;
  supplier?: LookupDto;
  country?: LookupDto;
  manufacturer?: LookupDto;
  natureOption?: LookupDto;
  bulletDiameterUnit?: LookupDto;
  /** Legacy single navigation; prefer primaryPurposes from catalog API */
  primaryPurpos?: LookupDto;
  /** Purposes linked to this catalog item (BaseItemPrimaryPurposes) */
  primaryPurposes?: LookupDto[];
  projectileColor?: LookupDto;
  projectailMaterial?: LookupDto;
  caseType?: LookupDto;
  propellant?: LookupDto;
  compatibility?: LookupDto;
  hazardDivision?: LookupDto;
  classification?: LookupDto;
  type?: LookupDto;
  
  // Images array from response
  images?: ImageDto[];
}

export interface AmmunitionCreateDto {
  name: string;
  itemNo: string;
  // All other fields are optional - only Name and ItemNo are required
  partNo?: string;
  armNumber?: string;
  caliber?: string;
  // Note: batchNo, readyForIssue, and expiryDate are NOT in backend CreateUpdateAmmunitionDto
  // These fields are managed at the lot/inventory level, not the ammunition catalog level
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
  /** Matches API PrimaryPurposIds (BaseItemPrimaryPurposes) */
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
  notes?: string;
  price?: number;
  minimumQuantity?: number;
  criticalQuantity?: number;
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
  bulletDiameter?: number;
  bulletDiameterUnitId?: number;
  armNumber?: string;
  caliber?: string;
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


/**
 * Catalog line item for issue requests (ammunition / weapons / explosives UI).
 * Kept in core models so features do not import types from presentation components.
 */
export interface Cartridge {
  id: number;
  name: string;
  nameAr?: string;
  nameEn?: string;
  selected: boolean;
  itemNo?: string;
  productId?: string;
  ncn?: string;
  primaryPurpose?: string;
  projectileColor?: string;
  totalWeight?: string;
  projectileMaterial?: string;
  caseType?: string;
  primer?: string;
  propellant?: string;
  hazardDivision?: string;
  capabilityGroup?: string;
  bulletDiameterLabel?: string;
  linkedLabel?: string;
  linkedLabelAr?: string;
  linkedLabelEn?: string;
  natureLabel?: string;
  natureLabelAr?: string;
  natureLabelEn?: string;
  quantity?: number | null;
  added?: boolean;
  ammunitionType?: string | number;
  armNumber?: string;
  itemType?: string;

  weaponType?: string;
  caliber?: string;
  actionType?: string;
  barrelLength?: number;
  barrelLengthLabel?: string;
  overallLength?: number;
  overallLengthLabel?: string;
  weight?: number;
  weightLabel?: string;
  capacity?: number;

  explosiveType?: string;
  unNumber?: string;
  netExplosiveQuantity?: number;
  netExplosiveQuantityLabel?: string;
  totalWeightLabel?: string;
}

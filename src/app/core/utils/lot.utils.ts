/**
 * Lot-related utility functions
 */

// eslint-disable-next-line no-restricted-imports -- LotDetailDto lives with InventoryService today; move DTO to @models to drop this (tech debt).
import { LotDetailDto } from '@inventory/services/inventory.service';
import { LotItem } from '@models/supply-order.model';

/**
 * Constants for lot condition determination
 */
export const LOT_CONSTANTS = {
  DAYS_NEAR_EXPIRY_THRESHOLD: 60,
  DAYS_FAIR_CONDITION_THRESHOLD: 180,
  DAYS_UNTIL_EXPIRY_UNDEFINED: 999999,
} as const;

/**
 * Format location string from depot information
 */
export function formatLocation(depot?: { nameEn?: string; nameAr?: string }): string {
  if (!depot) return 'Unknown Location';
  return depot.nameEn || depot.nameAr || 'Unknown Location';
}

/**
 * Determines condition based on expiry date
 */
export type LotCondition = 'Good' | 'Fair' | 'Near Expiry' | 'Expired';

export function determineCondition(expiryDate?: string): LotCondition {
  if (!expiryDate) return 'Good';

  const days = calculateDaysUntilExpiry(expiryDate);
  if (days < 0) return 'Expired';
  if (days < LOT_CONSTANTS.DAYS_NEAR_EXPIRY_THRESHOLD) return 'Near Expiry';
  if (days < LOT_CONSTANTS.DAYS_FAIR_CONDITION_THRESHOLD) return 'Fair';
  return 'Good';
}

export type LotConditionNamespace = 'common' | 'supplyRequestDetail' | 'supplyOrder';

const LOT_CONDITION_SUFFIX_MAP: Record<LotCondition, string> = {
  Good: 'good',
  Fair: 'fair',
  'Near Expiry': 'nearExpiry',
  Expired: 'expired',
};

/**
 * Translation key for lot condition badge labels ({namespace}.lotConditions.*).
 * Returns null when the condition is not a known lot condition.
 */
export function getLotConditionTranslationKey(
  condition: LotCondition | string,
  namespace: LotConditionNamespace = 'common'
): string | null {
  const suffix = LOT_CONDITION_SUFFIX_MAP[condition as LotCondition];
  if (!suffix) return null;
  return `${namespace}.lotConditions.${suffix}`;
}

/**
 * Resolves a lot condition for display: translates known values, otherwise returns the original.
 */
export function getLotConditionLabel(
  condition: LotCondition | string,
  translate: { instant(key: string): string },
  namespace: LotConditionNamespace = 'common'
): string {
  const key = getLotConditionTranslationKey(condition, namespace);
  if (!key) return condition;
  const translated = translate.instant(key);
  return translated === key ? condition : translated;
}

/**
 * Normalizes expiry from API (string or Date) for day-boundary helpers.
 */
export function expiryDateInputToString(expiry?: string | Date): string | undefined {
  if (expiry === undefined || expiry === null) return undefined;
  if (typeof expiry === 'string') return expiry;
  return expiry.toISOString();
}

/**
 * Calculates days until expiry date.
 * Returns a large positive number when expiry is unknown; negative when already expired.
 */
export function calculateDaysUntilExpiry(expiryDate?: string): number {
  if (!expiryDate) return LOT_CONSTANTS.DAYS_UNTIL_EXPIRY_UNDEFINED;
  
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Map LotDetailDto from inventory API to UI LotItem format
 * @param includeEmptyLots When true, include lots with zero remaining quantity (for "all lots" view)
 */
export function mapLotDetailsToLotItems(
  lotDetails: LotDetailDto[],
  existingSelections?: Map<string, number>,
  includeEmptyLots?: boolean
): LotItem[] {
  const lots = lotDetails
    .filter(lot => includeEmptyLots || !lot.isEmptyLot)
    .map(lot => ({
      inventoryDetailId: lot.inventoryDetailId,
      lotNumber: lot.lot,
      quantity: lot.remainingQuantity,
      expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
      location: formatLocation(lot.depot),
      condition: lot.isExpired ? ('Expired' as const) : determineCondition(lot.expiryDate),
      daysUntilExpiry: calculateDaysUntilExpiry(lot.expiryDate),
      selectedQuantity: existingSelections?.get(lot.lot) ?? 0,
      depotName: lot.depot?.nameEn || lot.depot?.nameAr,
      supplierName: lot.supplier?.nameEn || lot.supplier?.nameAr,
      manufacturerName: lot.manufacturer?.nameEn || lot.manufacturer?.nameAr
    }));

  // Sort by expiry date (FEFO)
  return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}


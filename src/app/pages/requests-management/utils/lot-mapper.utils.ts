/**
 * Lot Mapper Utilities
 * Functions for mapping lot data from various sources to LotItem format
 * Note: mapLotDetailsToLotItems is available in @utils/lot.utils
 */

import { LotItem } from '@models/supply-order.model';
import { formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';

/**
 * Map suggested lots to LotItem format
 */
export function mapSuggestedLotsToLotItems(
  suggestions: any[],
  existingSelections?: Map<number, number>
): LotItem[] {
  const lots = suggestions.map(lotSuggestion => ({
    inventoryDetailId: lotSuggestion.inventoryDetailId,
    lotNumber: lotSuggestion.lot,
    quantity: lotSuggestion.availableQuantity,
    expiryDate: lotSuggestion.expiryDate ? new Date(lotSuggestion.expiryDate) : undefined,
    location: formatLocation(lotSuggestion.depot),
    condition: determineCondition(lotSuggestion.expiryDate),
    daysUntilExpiry: calculateDaysUntilExpiry(lotSuggestion.expiryDate),
    selectedQuantity: existingSelections?.get(lotSuggestion.lot) ?? lotSuggestion.suggestedQuantity,
    depotName: lotSuggestion.depot?.nameEn || lotSuggestion.depot?.nameAr,
    supplierName: lotSuggestion.supplier?.nameEn || lotSuggestion.supplier?.nameAr,
    manufacturerName: lotSuggestion.manufacturer?.nameEn || lotSuggestion.manufacturer?.nameAr
  }));

  // Sort by expiry date (FEFO)
  return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}


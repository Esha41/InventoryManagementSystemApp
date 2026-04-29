/**
 * Lot Mapper Utilities
 * Functions for mapping lot data from various sources to LotItem format
 * Note: mapLotDetailsToLotItems is available in @utils/lot.utils
 */

import { LotItem } from '@models/supply-order.model';
import { formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { getLocalizedName } from '@utils/localization.utils';

/**
 * Lot suggestion from backend (used internally for mapping)
 */
interface LotSuggestion {
  lot: number | string;
  inventoryDetailId: number;
  availableQuantity: number;
  suggestedQuantity: number;
  expiryDate?: string | Date;
  depot?: { nameEn?: string; nameAr?: string };
  supplier?: { nameEn?: string; nameAr?: string };
  manufacturer?: { nameEn?: string; nameAr?: string };
}

/**
 * Map suggested lots to LotItem format
 * Removes duplicates by lot number, keeping the first occurrence
 */
export function mapSuggestedLotsToLotItems(
  suggestions: LotSuggestion[],
  existingSelections?: Map<string, number>,
  currentLang: string = 'en'
): LotItem[] {
  // Remove duplicate suggestions by lot number (keep first occurrence)
  const uniqueSuggestions: LotSuggestion[] = [];
  const seenLots = new Set<string>();

  suggestions.forEach(suggestion => {
    const lotKey = String(suggestion.lot ?? '');
    if (!seenLots.has(lotKey)) {
      seenLots.add(lotKey);
      uniqueSuggestions.push(suggestion);
    }
  });

  const lots = uniqueSuggestions.map(lotSuggestion => ({
    inventoryDetailId: lotSuggestion.inventoryDetailId,
    lotNumber: String(lotSuggestion.lot ?? ''),
    quantity: lotSuggestion.availableQuantity,
    expiryDate: lotSuggestion.expiryDate ? new Date(lotSuggestion.expiryDate) : undefined,
    location: formatLocation(lotSuggestion.depot),
    // Backend expiryDate can be `string | Date`; map utils expect `string | undefined`.
    condition: determineCondition(
      typeof lotSuggestion.expiryDate === 'string' ? lotSuggestion.expiryDate : undefined
    ),
    daysUntilExpiry: calculateDaysUntilExpiry(
      typeof lotSuggestion.expiryDate === 'string' ? lotSuggestion.expiryDate : undefined
    ),
    selectedQuantity: existingSelections?.get(String(lotSuggestion.lot ?? '')) ?? lotSuggestion.suggestedQuantity,
    depotName: lotSuggestion.depot ? getLocalizedName(lotSuggestion.depot, currentLang) : undefined,
    supplierName: lotSuggestion.supplier ? getLocalizedName(lotSuggestion.supplier, currentLang) : undefined,
    manufacturerName: lotSuggestion.manufacturer ? getLocalizedName(lotSuggestion.manufacturer, currentLang) : undefined
  }));

  // Sort by expiry date (FEFO)
  return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}


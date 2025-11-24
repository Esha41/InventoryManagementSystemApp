/**
 * Lot Mapper Utilities
 * Functions for mapping lot data from various sources to LotItem format
 */

import { LotDetailDto } from '@services/inventory.service';
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

/**
 * Map LotDetailDto to LotItem format
 */
export function mapLotDetailsToLotItems(
  lotDetails: LotDetailDto[],
  existingSelections?: Map<number, number>
): LotItem[] {
  const lots = lotDetails
    .filter(lot => !lot.isEmptyLot)
    .map(lot => ({
      inventoryDetailId: lot.inventoryDetailId,
      lotNumber: lot.lot,
      quantity: lot.remainingQuantity,
      expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
      location: formatLocation(lot.depot),
      condition: lot.isExpired ? 'Near Expiry' as const : determineCondition(lot.expiryDate),
      daysUntilExpiry: calculateDaysUntilExpiry(lot.expiryDate),
      selectedQuantity: existingSelections?.get(lot.lot) ?? 0,
      depotName: lot.depot?.nameEn || lot.depot?.nameAr,
      supplierName: lot.supplier?.nameEn || lot.supplier?.nameAr,
      manufacturerName: lot.manufacturer?.nameEn || lot.manufacturer?.nameAr
    }));

  return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}


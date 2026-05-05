/**
 * Lot Selection Service
 * Handles lot selection modal business logic
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { InventoryService, LotDetailDto } from '@inventory/services/inventory.service';
import { OrderItem, LotItem } from '@models/supply-request.model';
import { mapLotDetailsToLotItems } from '@utils/lot.utils';
import { formatLocation, determineCondition, calculateDaysUntilExpiry } from '@utils/lot.utils';
import { ToastService } from '@services/toast.service';
import { TranslateService } from '@ngx-translate/core';
import { ConfigService } from '@services/config.service';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

export interface LoadLotsResult {
  lots: LotItem[];
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LotSelectionService {
  constructor(
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private translate: TranslateService,
    private config: ConfigService
  ) {}

  /**
   * Load available lots for an item and quantity
   */
  loadAvailableLotsForQuantity(
    item: OrderItem,
    existingSelections: Map<string, number>
  ): Observable<LoadLotsResult> {
    return this.inventoryService.getAvailableLotsForQuantity(item.itemId, item.approvedQuantity).pipe(
      map((lots: LotDetailDto[]) => {
        const currentSelections = new Map(existingSelections);
        const mappedLots = mapLotDetailsToLotItems(lots, currentSelections);
        
        return {
          lots: mappedLots,
          success: true
        };
      })
    );
  }

  /**
   * Get lot by number and validate it belongs to the item
   */
  getLotByNumberAndValidate(
    lotNumber: string,
    item: OrderItem
  ): Observable<{ lot: LotDetailDto; isValid: boolean; error?: string }> {
    return this.inventoryService.getLotByNumber(lotNumber).pipe(
      map((lot: LotDetailDto) => {
        if (lot.itemId !== item.itemId) {
          return {
            lot,
            isValid: false,
            error: this.translate.instant('supplyRequestDetail.lotBelongsToDifferentItem', {
              lotNumber: lotNumber,
              itemName: lot.itemName
            })
          };
        }

        const existingLot = item.availableLots.find(l => String(l.lotNumber) === String(lot.lot));
        if (existingLot) {
          return {
            lot,
            isValid: false,
            error: this.translate.instant('supplyRequestDetail.lotAlreadyInList', {
              lotNumber: lotNumber
            })
          };
        }

        return { lot, isValid: true };
      })
    );
  }

  /**
   * Convert LotDetailDto to LotItem
   */
  convertLotDetailToLotItem(lot: LotDetailDto): LotItem {
    return {
      inventoryDetailId: lot.inventoryDetailId,
      lotNumber: String(lot.lot ?? ''),
      quantity: lot.remainingQuantity,
      expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
      location: formatLocation(lot.depot),
      condition: lot.isExpired ? 'Expired' : determineCondition(lot.expiryDate),
      daysUntilExpiry: calculateDaysUntilExpiry(lot.expiryDate),
      selectedQuantity: 0,
      depotName: getLocalizedName(lot.depot, getCurrentLang(this.translate)),
      supplierName: getLocalizedName(lot.supplier, getCurrentLang(this.translate)),
      manufacturerName: getLocalizedName(lot.manufacturer, getCurrentLang(this.translate))
    };
  }

  /**
   * Add lot to item's available lots and sort by expiry
   */
  addLotToItem(item: OrderItem, newLot: LotItem): void {
    item.availableLots.push(newLot);
    item.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * Remove lot from item's available lots
   */
  removeLotFromItem(item: OrderItem, lotNumber: string): boolean {
    const index = item.availableLots.findIndex(lot => String(lot.lotNumber) === String(lotNumber));
    if (index > -1) {
      item.availableLots.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Validate lot number input
   */
  validateLotNumber(lotNumber: string): { isValid: boolean; parsedLot?: string; error?: string } {
    const trimmed = lotNumber?.trim() ?? '';
    if (!trimmed) {
      return {
        isValid: false,
        error: this.translate.instant('supplyRequestDetail.pleaseEnterLotNumber')
      };
    }

    if (trimmed.length > 64) {
      return {
        isValid: false,
        error: this.translate.instant('supplyRequestDetail.invalidLotNumber')
      };
    }

    return { isValid: true, parsedLot: trimmed };
  }
}


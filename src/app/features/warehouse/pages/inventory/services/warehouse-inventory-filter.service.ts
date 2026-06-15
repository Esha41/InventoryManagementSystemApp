import { Injectable } from '@angular/core';
import { InventoryDetailDto, ItemType } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';

export interface FilterOptions {
  searchTerm: string;
  activeTab: 'ammunition' | 'weapon' | 'explosive';
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryFilterService {
  
  /**
   * Normalize item type to number
   */
  normalizeItemType(itemType: ItemType | string | number | undefined): number | undefined {
    if (itemType === undefined || itemType === null) {
      return undefined;
    }
    if (typeof itemType === 'number') {
      return itemType;
    }
    if (typeof itemType === 'string') {
      const fromEnum = ItemType[itemType as keyof typeof ItemType];
      if (typeof fromEnum === 'number') {
        return fromEnum;
      }

      const parsed = parseInt(itemType, 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return Number(itemType);
  }

  /**
   * Filter inventory details by tab
   */
  filterByTab(details: InventoryDetailDto[], activeTab: 'ammunition' | 'weapon' | 'explosive'): InventoryDetailDto[] {
    if (activeTab === 'ammunition') {
      return details.filter(d => {
        const itemType = this.normalizeItemType(d.item?.itemType);
        const isAmmunition = itemType === ItemType.Ammunition;
        const isUndefinedAndNotStatic = itemType === undefined && !this.isStaticItem(d);
        return isAmmunition || isUndefinedAndNotStatic;
      });
    } else if (activeTab === 'explosive') {
      return details.filter(d => {
        const itemType = this.normalizeItemType(d.item?.itemType);
        return itemType === ItemType.Explosive;
      });
    }
    return details;
  }

  /**
   * Filter inventory details by search term
   */
  filterInventoryBySearch(
    details: InventoryDetailDto[],
    searchTerm: string,
    getItemName: (detail: InventoryDetailDto) => string,
    getItemNo: (detail: InventoryDetailDto) => string,
    getSupplierName: (detail: InventoryDetailDto) => string
  ): InventoryDetailDto[] {
    if (!searchTerm.trim()) {
      return details;
    }

    const term = searchTerm.trim().toLowerCase();
    return details.filter(detail => {
      const itemName = getItemName(detail).toLowerCase();
      const itemNo = getItemNo(detail).toLowerCase();
      const supplierName = getSupplierName(detail).toLowerCase();
      const lot = detail.lot?.toString().toLowerCase() || '';
      const batchNo = detail.batchNo?.toLowerCase() || '';

      return itemName.includes(term) ||
        itemNo.includes(term) ||
        supplierName.includes(term) ||
        lot.includes(term) ||
        batchNo.includes(term);
    });
  }

  /**
   * Filter assets by search term
   */
  filterAssetsBySearch(
    assets: AssetDto[],
    searchTerm: string,
    getAssetItemName: (asset: AssetDto) => string
  ): AssetDto[] {
    if (!searchTerm.trim()) {
      return assets;
    }

    const term = searchTerm.trim().toLowerCase();
    return assets.filter(asset => {
      const itemName = getAssetItemName(asset).toLowerCase();
      const serialNumber = asset.serialNumber?.toLowerCase() || '';
      const rfid = asset.rfid?.toLowerCase() || '';

      return itemName.includes(term) ||
        serialNumber.includes(term) ||
        rfid.includes(term);
    });
  }

  /**
   * Check if an item is static (weapon/explosive dummy data)
   */
  isStaticItem(detail: InventoryDetailDto): boolean {
    return detail.id < 0;
  }

  /**
   * Normalize inventory details item types
   */
  normalizeInventoryDetails(details: InventoryDetailDto[]): InventoryDetailDto[] {
    return details.map(detail => {
      if (detail.item) {
        const normalizedType = this.normalizeItemType(detail.item.itemType);
        if (normalizedType !== undefined) {
          return {
            ...detail,
            item: {
              ...detail.item,
              itemType: normalizedType as ItemType
            }
          };
        }
      }
      return detail;
    });
  }
}


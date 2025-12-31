import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDate as formatDateUtil, formatNumber as formatNumberUtil } from '@utils/format.utils';

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryFormatterService {

  constructor(private translateService: TranslateService) {}

  /**
   * Get item name from inventory detail
   */
  getItemName(detail: InventoryDetailDto | null | undefined): string {
    if (!detail) return 'Unknown Item';
    const lang = getCurrentLang(this.translateService);
    const localized = getLocalizedName(detail.item, lang);
    return localized || detail.item?.itemNo || 'Unknown Item';
  }

  /**
   * Get caliber/item number
   */
  getItemNo(detail: InventoryDetailDto): string {
    return detail.item?.itemNo || '-';
  }

  /**
   * Get supplier name
   */
  getSupplierName(detail: InventoryDetailDto): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(detail.supplier, lang) || '-';
  }

  /**
   * Get HCC name
   */
  getHccName(detail: InventoryDetailDto): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(detail.item?.hcc, lang) || '-';
  }

  /**
   * Get item name from asset
   */
  getAssetItemName(asset: AssetDto | null | undefined): string {
    if (!asset) return 'Unknown Item';
    const lang = getCurrentLang(this.translateService);
    const localized = getLocalizedName(asset.item, lang);
    return localized || asset.item?.name || 'Unknown Item';
  }

  /**
   * Get asset item number
   */
  getAssetItemNo(asset: AssetDto): string {
    return asset.item?.itemNo || '-';
  }

  /**
   * Get asset status label
   */
  getAssetStatusLabel(asset: AssetDto): string {
    if (!asset.status) return '-';
    const statusMap: { [key: number]: string } = {
      1: 'Available',
      2: 'In Use',
      3: 'Under Maintenance',
      4: 'Retired'
    };
    return statusMap[asset.status] || '-';
  }

  /**
   * Format date for display (uses shared format utility)
   * Returns '-' for empty dates to match UI expectations
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const formatted = formatDateUtil(date);
    return formatted === 'N/A' ? '-' : formatted;
  }

  /**
   * Format number with thousands separator (uses shared format utility)
   */
  formatNumber(num: number): string {
    return formatNumberUtil(num);
  }

  /**
   * Get delete asset message
   */
  getDeleteAssetMessage(asset: AssetDto | null | undefined): string {
    if (!asset) return '';
    return `${this.getAssetItemName(asset)} (${asset.serialNumber || 'No Serial'})`;
  }
}


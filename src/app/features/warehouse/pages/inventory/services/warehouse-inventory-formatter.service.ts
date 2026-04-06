import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto, getAssetStatusLabel as getAssetStatusKey } from '@models/asset.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateShort, formatNumber as formatNumberUtil } from '@utils/format.utils';

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
   * Get manufacturer name
   */
  getManufacturerName(detail: InventoryDetailDto): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(detail.manufacturer, lang) || '-';
  }

  /**
   * Lot-level primary purpose (from API navigation or resolved via item.primaryPurposes).
   */
  getPrimaryPurposeName(detail: InventoryDetailDto): string {
    const lang = getCurrentLang(this.translateService);
    if (detail.primaryPurpos) {
      const label = getLocalizedName(detail.primaryPurpos, lang);
      if (label) {
        return label;
      }
    }
    const id = detail.primaryPurposId;
    if (id != null && detail.item?.primaryPurposes?.length) {
      const match = detail.item.primaryPurposes.find(p => p.id === id);
      if (match) {
        return getLocalizedName(match, lang) || '-';
      }
    }
    return '-';
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
   * Get asset status label (translated)
   */
  getAssetStatusLabel(asset: AssetDto): string {
    if (!asset.status) return '-';
    const key = getAssetStatusKey(asset.status);
    return this.translateService.instant(key) || '-';
  }

  /**
   * Format date for display (uses shared format utility)
   * Returns '-' for empty dates to match UI expectations
   */
  formatDate(date?: Date | string): string {
    if (!date) return '-';
    const formatted = formatDateShort(date);
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


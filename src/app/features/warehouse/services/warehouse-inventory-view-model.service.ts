import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@models/lookup.model';
import { InventoryDetailDto } from '@models/inventory.model';
import { BatchSummaryDto } from '@models/batch.model';
import { WarehouseInventoryService } from './warehouse-inventory.service';
import { BatchTableSortColumn } from '../pages/inventory/components/batch-table/batch-table.component';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';
import { PaginationUtils } from '@utils/pagination.utils';

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryViewModelService {
  constructor(private warehouseInventoryService: WarehouseInventoryService) {}

  getLookupLabel(
    option: DropdownOption<LookupItem> | LookupItem | null,
    translateService: TranslateService
  ): string {
    const item = this.unwrapLookupOption(option);
    return item ? getLocalizedName(item, getCurrentLang(translateService)) || '' : '';
  }

  getPreviewImportAssetType(
    activeTab: 'ammunition' | 'explosive' | 'batch',
    batchExcelImportMode: boolean
  ): 'ammunition' | 'weapon' | 'explosive' | 'batch' {
    if (batchExcelImportMode) return 'batch';
    if (activeTab === 'explosive') return 'explosive';
    if (activeTab === 'batch') return 'weapon';
    return 'ammunition';
  }

  isItemExpired(item: InventoryDetailDto): boolean {
    if (!item.expiryDate) return false;
    const expiry = new Date(item.expiryDate);
    return expiry < new Date();
  }

  getPaginatedBatches(input: {
    activeTab: 'ammunition' | 'explosive' | 'batch';
    filteredBatches: BatchSummaryDto[];
    currentPage: number;
    rowsPerPage: number;
    sortColumn: BatchTableSortColumn;
    sortDirection: 'asc' | 'desc';
  }): BatchSummaryDto[] {
    if (input.activeTab !== 'batch') return [];
    const sorted = this.warehouseInventoryService.sortBatches(
      input.filteredBatches,
      input.sortColumn,
      input.sortDirection
    );
    return PaginationUtils.paginateList(sorted, input.currentPage, input.rowsPerPage);
  }

  private unwrapLookupOption<T>(option: DropdownOption<T> | T | null): T | null {
    if (option == null) return null;
    if (typeof option === 'object' && option !== null && 'value' in option) {
      return (option as DropdownOption<T>).value as T;
    }
    return option as T;
  }
}

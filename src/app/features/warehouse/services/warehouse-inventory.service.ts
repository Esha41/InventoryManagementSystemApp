import { Injectable } from '@angular/core';
import { FilterData } from '@models/pagination.model';
import { ItemType } from '@models/inventory.model';
import { BatchAssetFilter, BatchSummaryDto } from '@models/batch.model';
import { WarehouseInventoryTableSortColumn } from '../pages/inventory/components/inventory-table/inventory-table.component';
import { BatchTableSortColumn } from '../pages/inventory/components/batch-table/batch-table.component';

export interface WarehouseInventoryRequestBuildInput {
  activeTab: 'ammunition' | 'explosive' | 'batch';
  currentPage: number;
  rowsPerPage: number;
  searchTerm: string;
  invoiceFilter: string | null;
  supplierId: number | null;
  manufacturerId: number | null;
  primaryPurposeId: number | null;
  sortColumn: WarehouseInventoryTableSortColumn;
  sortDirection: 'asc' | 'desc';
  language: string;
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryService {
  buildBatchAssetFilter(input: {
    itemIds: number[];
    supplierIds: number[];
    manufacturerIds: number[];
    primaryPurposeIds: number[];
  }): BatchAssetFilter | undefined {
    const filter: BatchAssetFilter = {};
    if (input.itemIds.length) filter.itemIds = input.itemIds;
    if (input.supplierIds.length) filter.supplierIds = input.supplierIds;
    if (input.manufacturerIds.length) filter.manufacturerIds = input.manufacturerIds;
    if (input.primaryPurposeIds.length) filter.primaryPurposeIds = input.primaryPurposeIds;

    return filter.itemIds || filter.supplierIds || filter.manufacturerIds || filter.primaryPurposeIds
      ? filter
      : undefined;
  }

  applyBatchSearch(batches: BatchSummaryDto[], searchTerm: string): BatchSummaryDto[] {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return batches;
    }
    return batches.filter(batch => batch.batchNumber?.toLowerCase().includes(normalized));
  }

  buildPagedRequest(input: WarehouseInventoryRequestBuildInput): { page: number; pageSize: number; filter?: FilterData } {
    const searchTerm = input.searchTerm.trim();
    let filterData: FilterData | undefined;

    if (input.activeTab === 'batch') {
      const filters: FilterData[] = [];
      if (searchTerm) {
        filters.push({
          logic: 'or',
          filters: [{ field: 'BatchNumber', operator: 'contains', value: searchTerm }]
        });
      }
      if (filters.length > 0) {
        filterData = { logic: 'and', filters };
      }
    } else {
      const itemType = input.activeTab === 'explosive' ? ItemType.Explosive : ItemType.Ammunition;
      const filters: FilterData[] = [
        { field: 'Item.ItemType', operator: 'eq', value: itemType.toString() }
      ];

      if (input.supplierId != null) {
        filters.push({ field: 'SupplierId', operator: 'eq', value: String(input.supplierId) });
      }
      if (input.manufacturerId != null) {
        filters.push({ field: 'ManufacturerId', operator: 'eq', value: String(input.manufacturerId) });
      }
      if (input.primaryPurposeId != null) {
        filters.push({ field: 'PrimaryPurposId', operator: 'eq', value: String(input.primaryPurposeId) });
      }

      if (input.invoiceFilter) {
        filters.push({
          field: 'Inventory.InvoiceNumber',
          operator: 'eq',
          value: input.invoiceFilter
        });
      } else if (searchTerm) {
        filters.push({
          logic: 'or',
          filters: [
            { field: 'Item.Name', operator: 'contains', value: searchTerm },
            { field: 'Item.ItemNo', operator: 'contains', value: searchTerm },
            { field: 'BatchNo', operator: 'contains', value: searchTerm },
            { field: 'Lot', operator: 'contains', value: searchTerm },
            { field: 'Supplier.NameEn', operator: 'contains', value: searchTerm },
            { field: 'Supplier.NameAr', operator: 'contains', value: searchTerm },
            { field: 'Inventory.InvoiceNumber', operator: 'contains', value: searchTerm }
          ]
        });
      }

      filterData = {
        logic: 'and',
        filters,
        sortField: this.resolveInventoryBackendSortField(input.sortColumn, input.language),
        sortDirection: input.sortDirection === 'asc' ? 1 : 2
      };
    }

    return {
      page: input.currentPage,
      pageSize: input.rowsPerPage,
      filter: filterData
    };
  }

  resolveInventoryDefaultDirection(column: WarehouseInventoryTableSortColumn): 'asc' | 'desc' {
    switch (column) {
      case 'quantity':
      case 'readyForIssue':
        return 'desc';
      case 'expiryDate':
        return 'asc';
      default:
        return 'asc';
    }
  }

  resolveBatchDefaultDirection(column: BatchTableSortColumn): 'asc' | 'desc' {
    return column === 'quantity' ? 'desc' : 'asc';
  }

  sortBatches(
    batches: BatchSummaryDto[],
    sortColumn: BatchTableSortColumn,
    sortDirection: 'asc' | 'desc'
  ): BatchSummaryDto[] {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    return [...batches].sort((a, b) => {
      if (sortColumn === 'quantity') {
        return multiplier * (a.quantity - b.quantity);
      }
      return (
        multiplier *
        (a.batchNumber || '').localeCompare(b.batchNumber || '', undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      );
    });
  }

  getTotalPages(totalItems: number, rowsPerPage: number): number {
    if (rowsPerPage <= 0) {
      return 1;
    }
    return totalItems === 0 ? 1 : Math.ceil(totalItems / rowsPerPage);
  }

  resolveExportConfig(activeTab: 'ammunition' | 'explosive' | 'batch'):
    | { kind: 'batch' }
    | { kind: 'inventory'; itemType: 1 | 3; exportTab: 'ammunition' | 'explosive' } {
    if (activeTab === 'batch') {
      return { kind: 'batch' };
    }
    return {
      kind: 'inventory',
      itemType: activeTab === 'ammunition' ? ItemType.Ammunition : ItemType.Explosive,
      exportTab: activeTab
    };
  }

  private resolveInventoryBackendSortField(column: WarehouseInventoryTableSortColumn, language: string): string {
    const supplierField = language === 'ar' ? 'Supplier.NameAr' : 'Supplier.NameEn';
    const manufacturerField = language === 'ar' ? 'Manufacturer.NameAr' : 'Manufacturer.NameEn';
    const map: Record<WarehouseInventoryTableSortColumn, string> = {
      itemName: 'Item.Name',
      supplier: supplierField,
      manufacturer: manufacturerField,
      lot: 'Lot',
      quantity: 'ItemQuantity',
      readyForIssue: 'ReadyForIssue',
      expiryDate: 'ExpiryDate',
      itemNo: 'Item.ItemNo'
    };
    return map[column];
  }
}

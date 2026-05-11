import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LookupService } from '@services/lookup.service';
import { WeaponService } from '@assets/services/weapon.service';
import { InventoryService } from '@inventory/services/inventory.service';
import { BatchService } from '@warehouse/services/batch.service';
import { LookupItem } from '@models/lookup.model';
import { BatchAssetFilter, BatchAssetItemCountDto } from '@models/batch.model';
import { AssetDto } from '@models/asset.model';
import { PagedRequest } from '@models/api-response.model';
import { WeaponDto } from '@models/weapon.model';

export interface WarehouseDepotContext {
  depots: LookupItem[];
  suppliers: LookupItem[];
  manufacturers: LookupItem[];
  primaryPurposes: LookupItem[];
  weaponItems: LookupItem[];
}

export interface ExpandedBatchAssetsResponse {
  assets: AssetDto[];
  assetCount: number;
  assetsTotalPages: number;
  assetsPageIndex: number;
  assetsPageSize: number;
  assetItemCounts: BatchAssetItemCountDto[];
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseInventoryDataService {
  constructor(
    private lookupService: LookupService,
    private weaponService: WeaponService,
    private inventoryService: InventoryService,
    private batchService: BatchService
  ) {}

  loadDepotContext(): Observable<WarehouseDepotContext> {
    return forkJoin({
      depots: this.lookupService.getDepots(),
      suppliers: this.lookupService.getSuppliers().pipe(catchError(() => of([] as LookupItem[]))),
      manufacturers: this.lookupService.getManufacturers().pipe(catchError(() => of([] as LookupItem[]))),
      primaryPurposes: this.lookupService.getPrimaryPurposes().pipe(catchError(() => of([] as LookupItem[]))),
      weapons: this.weaponService.getAll().pipe(catchError(() => of([] as WeaponDto[])))
    }).pipe(
      map(({ depots, suppliers, manufacturers, primaryPurposes, weapons }) => ({
        depots,
        suppliers,
        manufacturers,
        primaryPurposes,
        weaponItems: (weapons ?? []).map(w => ({
          id: w.id,
          // WeaponDto exposes a single `name` field; map it to both localized lookup slots.
          nameEn: w.name,
          nameAr: w.name
        }))
      })),
      catchError(() =>
        of({
          depots: [],
          suppliers: [],
          manufacturers: [],
          primaryPurposes: [],
          weaponItems: []
        })
      )
    );
  }

  loadInventoryById(inventoryId: number) {
    return this.inventoryService.getById(inventoryId);
  }

  loadInventoryPage(depotId: number, request: PagedRequest) {
    return this.inventoryService.getInventoryDetailsPaginated(depotId, request);
  }

  loadBatchSummaries(depotId: number, filters?: BatchAssetFilter) {
    return this.batchService.getSummary(depotId, filters);
  }

  loadExpandedBatchAssets(input: {
    batchId: number;
    filters?: BatchAssetFilter;
    includeAllAssets: boolean;
    assetsPage: number;
    assetsPageSize: number;
    assetsItemId?: number | null;
  }) {
    const assetsItemId = input.assetsItemId ?? undefined;
    if (input.includeAllAssets) {
      return this.batchService.getById(input.batchId, {
        includeAllAssets: true,
        filters: input.filters,
        assetsItemId
      });
    }
    return this.batchService.getById(input.batchId, {
      assetsPage: input.assetsPage,
      assetsPageSize: input.assetsPageSize,
      filters: input.filters,
      assetsItemId
    });
  }

  deleteBatch(batchId: number) {
    return this.batchService.delete(batchId);
  }

  exportBatchAssetsExcel(batchId: number, lang: string) {
    return this.batchService.exportAssetsExcel(batchId, lang);
  }
}

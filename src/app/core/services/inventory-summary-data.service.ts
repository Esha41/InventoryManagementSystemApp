import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { InventoryService } from '@services/inventory.service';
import { AssetService } from '@services/asset.service';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { AssetDto, AssetStatus } from '@models/asset.model';


@Injectable({ providedIn: 'root' })
export class InventorySummaryDataService {
    constructor(
        private readonly inventoryService: InventoryService,
        private readonly assetService: AssetService
    ) { }

    /**
     * Load all inventory items (ammunition, weapons as assets, explosives)
     * @returns Observable of combined inventory summary data
     */
    loadAllItems(): Observable<ItemInventorySummaryDto[]> {
        return forkJoin({
            // Get ammunition and explosives from inventory summary (lot-based)
            inventorySummary: this.inventoryService.getAllItemsSummary().pipe(
                map(items => this.filterOutWeapons(items)),
                catchError(() => of([]))
            ),
            // Get weapons from assets (asset-based)
            weaponAssets: this.assetService.getAll<AssetDto>().pipe(
                map(assets => this.transformAssetsToSummary(assets)),
                catchError(() => of([]))
            )
        }).pipe(
            map(({ inventorySummary, weaponAssets }) =>
                [...inventorySummary, ...weaponAssets]
            )
        );
    }

    private filterOutWeapons(items: ItemInventorySummaryDto[]): ItemInventorySummaryDto[] {
        return items.filter(item => item.itemType !== ItemType.Weapon);
    }
    private transformAssetsToSummary(assets: AssetDto[]): ItemInventorySummaryDto[] {
        const assetsByItem = this.groupAssetsByItemId(assets);
        return this.createSummariesFromGroupedAssets(assetsByItem);
    }
    private groupAssetsByItemId(assets: AssetDto[]): Map<number, AssetDto[]> {
        const assetsByItem = new Map<number, AssetDto[]>();

        assets.forEach(asset => {
            if (!asset.isDeleted) {
                const existing = assetsByItem.get(asset.itemId) || [];
                existing.push(asset);
                assetsByItem.set(asset.itemId, existing);
            }
        });

        return assetsByItem;
    }

    private createSummariesFromGroupedAssets(
        assetsByItem: Map<number, AssetDto[]>
    ): ItemInventorySummaryDto[] {
        const summaries: ItemInventorySummaryDto[] = [];

        assetsByItem.forEach((itemAssets, itemId) => {
            const summary = this.createSummaryForAssetGroup(itemId, itemAssets);
            if (summary) {
                summaries.push(summary);
            }
        });

        return summaries;
    }

    private createSummaryForAssetGroup(
        itemId: number,
        itemAssets: AssetDto[]
    ): ItemInventorySummaryDto | null {
        const firstAsset = itemAssets[0];
        const weapon = firstAsset?.item;

        if (!weapon) {
            return null;
        }

        return {
            itemId,
            itemName: weapon.name || '',
            itemNo: weapon.itemNo || '',
            itemType: ItemType.Weapon,
            nsn: weapon.nsn || '',
            partNo: weapon.partNo || '',
            totalQuantity: itemAssets.length,
            usedQuantity: 0,
            reservedQuantityByOrdersOnProcessing: 0, // Not applicable for assets
            remainingQuantity: this.countAssetsByStatus(itemAssets, 'ReadyToIssue'),
            totalLots: itemAssets.length // For weapons, represents total asset count
        };
    }

    private countAssetsByStatus(assets: AssetDto[], status: AssetStatus | string): number {
        return assets.filter(asset => asset.status === status || asset.status === (status as number)).length;
    }
}

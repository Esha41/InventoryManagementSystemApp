import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import {
  AssetSupplyService,
  CreateAssetSupplyDto,
  DepotBatchSelectionDto,
  WeaponAccessoryDefaultLineDto,
  WeaponAccessoryDefaultsDto
} from '@requests/services/asset-supply.service';
import { AssetService } from '@assets/services/asset.service';
import { AssetDto } from '@core/models/asset.model';
import { BatchDto } from '@core/models/batch.model';
import { OrderDto } from '@models/order.model';
import { WeaponSupplyLookupService } from './weapon-supply-lookup.service';

export interface ReceiverInfo {
    receiverEmployeeId: number;
    location?: string;
    expectedReturnDate?: string;
    notes?: string;
}

export interface AssetAccessoryRow {
    accessoryId: number;
    itemNo?: string | null;
    name: string;
    nameAr?: string | null;
    defaultQuantity: number;
    suppliedQuantity: number;
}

export interface BatchWithSelection extends BatchDto {
    expanded: boolean;
    selectedAssetIds: Set<number>;
    custodianMap: Map<number, number | undefined>;
    notesMap: Map<number, string>;
}

@Injectable()
export class WeaponSupplyReviewService {
    private _batches = new BehaviorSubject<BatchWithSelection[]>([]);
    batches$ = this._batches.asObservable();

    orderData: OrderDto | null = null;
    defaultCustodianId: number | undefined;

    private requestedItemMap = new Map<number, { itemName: string; quantity: number }>();
    /** Original selection: batchId -> itemId -> quantity */
    private selectionQuantities = new Map<number, Map<number, number>>();
    /** weapon itemId -> catalog template rows */
    private accessoryTemplates = new Map<number, AssetAccessoryRow[]>();
    /** asset id -> accessory rows for that serial */
    private accessoryMap = new Map<number, AssetAccessoryRow[]>();

    constructor(
        private assetSupplyService: AssetSupplyService,
        private assetService: AssetService,
        private lookupService: WeaponSupplyLookupService,
        private toastService: ToastService,
        private translate: TranslateService
    ) {}

    get batches(): BatchWithSelection[] {
        return this._batches.value;
    }

    setBatches(batches: BatchWithSelection[]): void {
        this._batches.next([...batches]);
    }

    initializeFromOrder(order: OrderDto): void {
        this.orderData = order;
        this.defaultCustodianId = this.lookupService.resolveEmployeeByUserId(order.requesterId || '');
        this.requestedItemMap.clear();
        (order.requestItems ?? []).forEach(ri => {
            if (ri.itemId != null) {
                this.requestedItemMap.set(ri.itemId, {
                    itemName: ri.itemName || 'Unknown Item',
                    quantity: ri.quantity
                });
            }
        });
    }

    getRequestedItems(): Map<number, { itemName: string; quantity: number }> {
        return this.requestedItemMap;
    }

    loadSelections(orderId: number): Observable<DepotBatchSelectionDto[]> {
        return this.assetSupplyService.getWeaponSupplySelection(orderId);
    }

    loadAccessoryDefaults(orderId: number): Observable<WeaponAccessoryDefaultsDto> {
        return this.assetSupplyService.getWeaponAccessoryDefaults(orderId);
    }

    applyAccessoryDefaults(defaults: WeaponAccessoryDefaultsDto): void {
        this.accessoryTemplates.clear();
        const byWeapon = defaults?.defaultsByWeaponItemId ?? {};
        Object.entries(byWeapon).forEach(([weaponItemId, lines]) => {
            this.accessoryTemplates.set(
                Number(weaponItemId),
                (lines ?? []).map(line => this.toAccessoryRow(line))
            );
        });
    }

    getAccessoriesForAsset(assetId: number): AssetAccessoryRow[] {
        return this.accessoryMap.get(assetId) ?? [];
    }

    hasAccessoriesForAsset(assetId: number): boolean {
        return this.getAccessoriesForAsset(assetId).length > 0;
    }

    setSuppliedQuantity(assetId: number, accessoryId: number, quantity: number): void {
        const rows = this.accessoryMap.get(assetId);
        if (!rows) return;
        const row = rows.find(r => r.accessoryId === accessoryId);
        if (row) {
            row.suppliedQuantity = quantity;
        }
    }

    applySelections(selections: DepotBatchSelectionDto[]): void {
        this.selectionQuantities.clear();
        for (const s of selections) {
            if (!this.selectionQuantities.has(s.batchId)) {
                this.selectionQuantities.set(s.batchId, new Map());
            }
            const itemMap = this.selectionQuantities.get(s.batchId)!;
            itemMap.set(s.itemId, (itemMap.get(s.itemId) ?? 0) + s.quantity);
        }
    }

    validateQuantities(): string[] | null {
        const errors: string[] = [];

        for (const batch of this.batches) {
            const expectedItems = this.selectionQuantities.get(batch.id);
            if (!expectedItems) continue;

            const actualByItem = new Map<number, number>();
            for (const asset of batch.assets) {
                actualByItem.set(asset.itemId, (actualByItem.get(asset.itemId) ?? 0) + 1);
            }

            for (const [itemId, expectedQty] of expectedItems) {
                const actualQty = actualByItem.get(itemId) ?? 0;
                if (actualQty !== expectedQty) {
                    const itemInfo = this.requestedItemMap.get(itemId);
                    const itemName = itemInfo?.itemName ?? `Item ${itemId}`;
                    errors.push(
                        this.translate.instant('weaponSupplyReview.batchQuantityMismatch', {
                            itemName,
                            batchNumber: batch.batchNumber,
                            expected: expectedQty,
                            actual: actualQty
                        })
                    );
                }
            }
        }

        return errors.length > 0 ? errors : null;
    }

    loadBatchesFromApi(orderId: number): Observable<BatchDto[]> {
        return this.assetSupplyService.getSelectedBatchesWithAssets(orderId);
    }

    applyBatchData(batchDtos: BatchDto[]): void {
        this.accessoryMap.clear();
        const batches: BatchWithSelection[] = batchDtos.map(b => {
            const selectedIds = new Set<number>();
            const custodianMap = new Map<number, number | undefined>();
            const notesMap = new Map<number, string>();

            (b.assets ?? []).forEach(a => {
                selectedIds.add(a.id);
                custodianMap.set(a.id, this.defaultCustodianId);
                notesMap.set(a.id, '');
                this.initAccessoriesForAsset(a.id, a.itemId);
            });

            return {
                ...b,
                expanded: false,
                selectedAssetIds: selectedIds,
                custodianMap,
                notesMap
            };
        });

        this.setBatches(batches);
    }

    toggleBatchExpanded(batchId: number): void {
        const batches = this.batches;
        const batch = batches.find(b => b.id === batchId);
        if (batch) {
            batch.expanded = !batch.expanded;
            this.setBatches(batches);
        }
    }

    removeAsset(batchId: number, assetId: number): void {
        const batches = this.batches;
        const batch = batches.find(b => b.id === batchId);
        if (!batch) return;

        batch.selectedAssetIds.delete(assetId);
        batch.assets = batch.assets.filter(a => a.id !== assetId);
        batch.assetCount = batch.assets.length;
        batch.custodianMap.delete(assetId);
        batch.notesMap.delete(assetId);
        this.accessoryMap.delete(assetId);
        this.setBatches(batches);
    }

    addAssetToBatch(batchId: number, asset: AssetDto): void {
        const batches = this.batches;
        const batch = batches.find(b => b.id === batchId);
        if (!batch) return;

        if (batch.selectedAssetIds.has(asset.id)) {
            this.toastService.warning(
                this.translate.instant('weaponSupplyReview.assetAlreadyInBatch')
            );
            return;
        }

        batch.assets.push(asset);
        batch.selectedAssetIds.add(asset.id);
        batch.assetCount = batch.assets.length;
        batch.custodianMap.set(asset.id, this.defaultCustodianId);
        batch.notesMap.set(asset.id, '');
        this.initAccessoriesForAsset(asset.id, asset.itemId);
        this.setBatches(batches);

        this.toastService.success(
            this.translate.instant('weaponSupplyReview.assetAdded', { serial: asset.serialNumber || asset.id })
        );
    }

    setCustodian(batchId: number, assetId: number, custodianId: number | undefined): void {
        const batch = this.batches.find(b => b.id === batchId);
        if (batch) {
            batch.custodianMap.set(assetId, custodianId);
        }
    }

    setNotes(batchId: number, assetId: number, notes: string): void {
        const batch = this.batches.find(b => b.id === batchId);
        if (batch) {
            batch.notesMap.set(assetId, notes);
        }
    }

    getTotalSelectedCount(): number {
        return this.batches.reduce((sum, b) => sum + b.assets.length, 0);
    }

    getTotalRequestedCount(): number {
        let total = 0;
        this.requestedItemMap.forEach(v => total += v.quantity);
        return total;
    }

    isFullyFulfilled(): boolean {
        const selectedByItem = new Map<number, number>();
        for (const batch of this.batches) {
            for (const asset of batch.assets) {
                const current = selectedByItem.get(asset.itemId) ?? 0;
                selectedByItem.set(asset.itemId, current + 1);
            }
        }
        for (const [itemId, info] of this.requestedItemMap) {
            if ((selectedByItem.get(itemId) ?? 0) < info.quantity) return false;
        }
        return true;
    }

    private accessoriesAreValid(): boolean {
        for (const batch of this.batches) {
            for (const asset of batch.assets) {
                const rows = this.accessoryMap.get(asset.id) ?? [];
                for (const row of rows) {
                    if (row.suppliedQuantity < 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    canSubmit(receiverEmployeeId: number | undefined, hasFiles: boolean = false): boolean {
        if (!receiverEmployeeId) return false;
        if (!hasFiles) return false;
        if (this.getTotalSelectedCount() === 0) return false;
        if (this.validateQuantities() !== null) return false;
        if (!this.accessoriesAreValid()) return false;
        return true;
    }

    createSupplyDto(orderId: number, receiverInfo: ReceiverInfo): CreateAssetSupplyDto {
        const supplyDetails = this.batches.flatMap(batch =>
            batch.assets.map(a => ({
                assetId: a.id,
                conditionOnSupply: undefined,
                custodianId: batch.custodianMap.get(a.id),
                notes: batch.notesMap.get(a.id) || undefined,
                accessories: (this.accessoryMap.get(a.id) ?? []).map(row => ({
                    accessoryId: row.accessoryId,
                    defaultQuantity: row.defaultQuantity,
                    suppliedQuantity: row.suppliedQuantity
                }))
            }))
        );

        return {
            orderId,
            receiverEmployeeId: receiverInfo.receiverEmployeeId,
            location: receiverInfo.location || undefined,
            expectedReturnDate: receiverInfo.expectedReturnDate || undefined,
            notes: receiverInfo.notes || undefined,
            supplyDetails
        };
    }

    submitSupply(
        dto: CreateAssetSupplyDto,
        otherFiles: File[],
        receiverSignatureFile?: File | null
    ): Observable<number> {
        return this.assetSupplyService.createAndSubmit(dto, otherFiles, receiverSignatureFile);
    }

    searchAssetBySerial(serialNumber: string): Observable<AssetDto | null> {
        return this.assetService.getBySerialNumber<AssetDto>(serialNumber);
    }

    private initAccessoriesForAsset(assetId: number, weaponItemId: number): void {
        const template = this.accessoryTemplates.get(weaponItemId) ?? [];
        if (template.length === 0) {
            this.accessoryMap.delete(assetId);
            return;
        }
        this.accessoryMap.set(
            assetId,
            template.map(row => ({ ...row }))
        );
    }

    private toAccessoryRow(line: WeaponAccessoryDefaultLineDto): AssetAccessoryRow {
        return {
            accessoryId: line.accessoryId,
            itemNo: line.itemNo,
            name: line.name,
            nameAr: line.nameAr,
            defaultQuantity: line.defaultQuantity,
            suppliedQuantity: line.defaultQuantity
        };
    }
}

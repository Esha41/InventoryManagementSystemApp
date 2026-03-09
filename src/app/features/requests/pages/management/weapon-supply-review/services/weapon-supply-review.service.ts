import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { AssetSupplyService, OrderAssetsToSupplyDto, CreateAssetSupplyDto } from '@services/asset-supply.service';
import { AssetService } from '@services/asset.service';
import { AssetDto } from '@core/models/asset.model';
import { OrderDto } from '@models/order.model';
import { SelectedAsset } from './asset-selection.service';
import { WeaponSupplyLookupService } from './weapon-supply-lookup.service';

export interface ReceiverInfo {
    receiverName: string;
    receiverMilitaryId: string;
    receiverRankId: number;
    location?: string;
    expectedReturnDate?: string;
    notes?: string;
}

export interface ItemWithAssets {
    itemId: number;
    itemName: string;
    requestedQuantity: number;
    availableQuantity: number;
    canFulfill: boolean;
    selectedAssets: SelectedAsset[];
    selectedCount: number;
}

@Injectable()
export class WeaponSupplyReviewService {

    private _itemsWithAssets = new BehaviorSubject<ItemWithAssets[]>([]);
    itemsWithAssets$ = this._itemsWithAssets.asObservable();

    orderData: OrderDto | null = null;
    defaultCustodianId: number | undefined;

    constructor(
        private assetSupplyService: AssetSupplyService,
        private assetService: AssetService,
        private lookupService: WeaponSupplyLookupService,
        private toastService: ToastService,
        private translate: TranslateService
    ) { }

    get items(): ItemWithAssets[] {
        return this._itemsWithAssets.value;
    }

    setItems(items: ItemWithAssets[]): void {
        this._itemsWithAssets.next(items);
    }

    initializeItemsFromOrder(order: OrderDto): void {
        this.orderData = order;
        this.defaultCustodianId = this.lookupService.resolveEmployeeByUserId(order.requesterId || '');

        if (!order.requestItems) return;

        const items: ItemWithAssets[] = order.requestItems.map(item => ({
            itemId: item.itemId,
            itemName: item.itemName || 'Unknown Item',
            requestedQuantity: item.quantity,
            availableQuantity: 0,
            canFulfill: false,
            selectedAssets: [],
            selectedCount: 0
        }));

        this.setItems(items);
    }

    updateItemsWithAvailableAssets(data: OrderAssetsToSupplyDto): void {
        const currentItems = this.items;

        data.items.forEach(newItem => {
            const existingItem = currentItems.find(i => i.itemId === newItem.itemId);
            if (existingItem) {
                existingItem.availableQuantity = newItem.availableQuantity;
                existingItem.canFulfill = newItem.canFulfill;

                const previousAssetMap = new Map(
                    existingItem.selectedAssets.map(a => [a.id, a])
                );

                const newAvailableAssets: SelectedAsset[] = newItem.availableAssets.map(asset => {
                    const prev = previousAssetMap.get(asset.id);
                    return {
                        id: asset.id,
                        assetId: asset.id,
                        serialNumber: asset.serialNumber,
                        assetTag: asset.assetTag,
                        condition: asset.condition,
                        selected: prev ? prev.selected : false,
                        custodianId: prev?.custodianId ?? this.defaultCustodianId,
                        conditionOnSupply: asset.condition || prev?.conditionOnSupply || '',
                        notes: prev?.notes ?? '',
                        depot: asset.depot
                    };
                });

                existingItem.selectedAssets = newAvailableAssets;
                existingItem.selectedCount = existingItem.selectedAssets.filter(a => a.selected).length;
            }
        });

        this.setItems(currentItems);
    }

    scanSerialNumber(serialNumber: string): void {
        if (!serialNumber?.trim()) return;

        const foundInAvailable = this.findAndSelectInAvailableAssets(serialNumber);
        if (foundInAvailable) {
            this.toastService.success(this.translate.instant('weaponSupplyReview.assetSelected', { serial: serialNumber }));
            return;
        }

        this.assetService.getBySerialNumber<AssetDto>(serialNumber)
            .subscribe({
                next: (asset) => {
                    if (!asset) {
                        this.toastService.error(this.translate.instant('weaponSupplyReview.assetNotFound'));
                        return;
                    }

                    if (asset.itemId) {
                        const currentItems = this.items;
                        const matchingItem = currentItems.find(item => item.itemId === asset.itemId);

                        if (matchingItem) {
                            const existingAsset = matchingItem.selectedAssets.find(a => a.id === asset.id);
                            if (existingAsset) {
                                if (!existingAsset.selected) {
                                    this.toggleAssetSelection(matchingItem, existingAsset, true);
                                    this.toastService.success(this.translate.instant('weaponSupplyReview.assetSelected', { serial: serialNumber }));
                                } else {
                                    this.toastService.info(this.translate.instant('weaponSupplyReview.assetAlreadySelected', { serial: serialNumber }));
                                }
                            } else {
                                const newAsset: SelectedAsset = {
                                    id: asset.id,
                                    assetId: asset.id,
                                    serialNumber: asset.serialNumber,
                                    assetTag: asset.assetTag,
                                    condition: asset.condition,
                                    selected: true,
                                    custodianId: this.defaultCustodianId,
                                    conditionOnSupply: asset.condition || '',
                                    notes: ''
                                };
                                matchingItem.selectedAssets.push(newAsset);
                                matchingItem.selectedCount++;
                                this.toastService.success(this.translate.instant('weaponSupplyReview.assetAddedAndSelected', { serial: serialNumber }));
                                this.setItems(currentItems);
                            }
                        } else {
                            this.toastService.warning(this.translate.instant('weaponSupplyReview.assetItemNotRequested'));
                        }
                    } else {
                        this.toastService.warning(this.translate.instant('weaponSupplyReview.cannotMatchAssetToOrder'));
                    }
                },
                error: () => {
                    this.toastService.error(this.translate.instant('weaponSupplyReview.errorFetchingAsset'));
                }
            });
    }

    private findAndSelectInAvailableAssets(serialNumber: string): boolean {
        let found = false;
        const items = this.items;
        const normalizedSerial = serialNumber.toLowerCase();

        for (const item of items) {
            const asset = item.selectedAssets.find(a => a.serialNumber?.toLowerCase() === normalizedSerial);
            if (asset) {
                if (!asset.selected) {
                    this.toggleAssetSelection(item, asset, true);
                }
                found = true;
                break;
            }
        }

        if (found) this.setItems(items);
        return found;
    }

    toggleAssetSelection(item: ItemWithAssets, asset: SelectedAsset, selected: boolean): void {
        if (selected && item.selectedCount >= item.requestedQuantity) {
            return;
        }
        asset.selected = selected;
        item.selectedCount = item.selectedAssets.filter(a => a.selected).length;
    }

    createSupplyDto(
        orderId: number,
        receiverInfo: ReceiverInfo,
        items: ItemWithAssets[]
    ): CreateAssetSupplyDto {
        const selectedAssets = items.flatMap(item =>
            item.selectedAssets
                .filter(a => a.selected)
                .map(a => ({
                    assetId: a.assetId || a.id,
                    conditionOnSupply: a.conditionOnSupply || a.condition || undefined,
                    custodianId: a.custodianId,
                    notes: a.notes || undefined
                }))
        );

        return {
            orderId,
            receiverName: receiverInfo.receiverName,
            receiverMilitaryId: receiverInfo.receiverMilitaryId,
            receiverRankId: receiverInfo.receiverRankId,
            location: receiverInfo.location || undefined,
            expectedReturnDate: receiverInfo.expectedReturnDate || undefined,
            notes: receiverInfo.notes || undefined,
            supplyDetails: selectedAssets
        };
    }

    submitSupply(dto: CreateAssetSupplyDto): Observable<number> {
        return this.assetSupplyService.createAndSubmit(dto);
    }
}

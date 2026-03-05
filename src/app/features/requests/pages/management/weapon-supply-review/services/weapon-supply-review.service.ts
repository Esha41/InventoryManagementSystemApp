import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, map, catchError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { AssetSupplyService, OrderAssetsToSupplyDto, CreateAssetSupplyDto } from '@services/asset-supply.service';
import { AssetService } from '@services/asset.service';
import { OrderDto } from '@models/order.model';
import { SelectedAsset } from './asset-selection.service';

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

    // State
    private _itemsWithAssets = new BehaviorSubject<ItemWithAssets[]>([]);
    itemsWithAssets$ = this._itemsWithAssets.asObservable();

    orderData: OrderDto | null = null;
    defaultCustodianId: string = '';

    constructor(
        private assetSupplyService: AssetSupplyService,
        private assetService: AssetService,
        private toastService: ToastService,
        private translate: TranslateService
    ) { }

    get items(): ItemWithAssets[] {
        return this._itemsWithAssets.value;
    }

    setItems(items: ItemWithAssets[]) {
        this._itemsWithAssets.next(items);
    }

    initializeItemsFromOrder(order: OrderDto) {
        this.orderData = order;
        this.defaultCustodianId = order.requesterId || '';

        if (!order.requestItems) return;

        const items = order.requestItems.map(item => ({
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

    updateItemsWithAvailableAssets(data: OrderAssetsToSupplyDto) {
        const currentItems = this.items;

        data.items.forEach(newItem => {
            const existingItem = currentItems.find(i => i.itemId === newItem.itemId);
            if (existingItem) {
                existingItem.availableQuantity = newItem.availableQuantity;
                existingItem.canFulfill = newItem.canFulfill;

                // Merge available assets
                const newAvailableAssets = newItem.availableAssets.map(asset => ({
                    id: asset.id,
                    assetId: asset.id, // For DTO mapping
                    serialNumber: asset.serialNumber,
                    assetTag: asset.assetTag,
                    condition: asset.condition,
                    selected: false,
                    custodianId: this.defaultCustodianId,
                    conditionOnSupply: asset.condition || '',
                    notes: '',
                    depot: asset.depot
                } as SelectedAsset));

                const existingIds = existingItem.selectedAssets.map(a => a.id);
                const uniqueNewAssets = newAvailableAssets.filter(a => !existingIds.includes(a.id));

                existingItem.selectedAssets = [...existingItem.selectedAssets, ...uniqueNewAssets];
            }
        });

        this.setItems(currentItems);
    }

    scanSerialNumber(serialNumber: string): void {
        if (!serialNumber || !serialNumber.trim()) return;

        // First check if already loaded in any item's available assets
        const foundInAvailable = this.findAndSelectInAvailableAssets(serialNumber);
        if (foundInAvailable) {
            this.toastService.success(this.translate.instant('weaponSupplyReview.assetSelected', { serial: serialNumber }));
            return;
        }

        // If not found locally, fetch from API
        this.assetService.getBySerialNumber(serialNumber)
            .subscribe({
                next: (asset: any) => {
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
                                this.setItems(currentItems); // Trigger update
                            }
                        } else {
                            this.toastService.warning(this.translate.instant('weaponSupplyReview.assetItemNotRequested'));
                        }
                    } else {
                        this.toastService.warning(this.translate.instant('weaponSupplyReview.cannotMatchAssetToOrder'));
                    }
                },
                error: (err) => {
                    this.toastService.error(this.translate.instant('weaponSupplyReview.errorFetchingAsset'));
                }
            });
    }

    private findAndSelectInAvailableAssets(serialNumber: string): boolean {
        let found = false;
        const items = this.items;

        for (const item of items) {
            const asset = item.selectedAssets.find(a => a.serialNumber?.toLowerCase() === serialNumber.toLowerCase());
            if (asset) {
                if (!asset.selected) {
                    this.toggleAssetSelection(item, asset, true);
                }
                found = true;
                break;
            }
        }

        if (found) this.setItems(items); // Update state if changed
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
        receiverInfo: any,
        items: ItemWithAssets[]
    ): CreateAssetSupplyDto {
        const selectedAssets = items.flatMap(item =>
            item.selectedAssets
                .filter(a => a.selected)
                .map(a => {
                    // a.custodianId holds the employee ID as string from the dropdown; convert to number
                    const detailCustodianId = a.custodianId ? Number(a.custodianId) : undefined;
                    return {
                        assetId: a.assetId || a.id,
                        conditionOnSupply: a.conditionOnSupply || a.condition || undefined,
                        custodianId: detailCustodianId,
                        notes: a.notes || undefined
                    };
                })
        );

        return {
            orderId: orderId,
            custodianId: this.defaultCustodianId,
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

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, Edit2, Trash2 } from 'lucide-angular';

import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, getAssetStatusLabel } from '@models/asset.model';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditAssetModalComponent } from '../edit-asset/components/edit-asset-modal/edit-asset-modal.component';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
    selector: 'app-asset-details',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule,
        CardComponent,
        ConfirmDialogComponent,
        EditAssetModalComponent,
        HasPermissionDirective
    ],
    templateUrl: './asset-details.component.html',
    styleUrl: './asset-details.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetDetailsComponent implements OnInit, OnDestroy {
    readonly ArrowLeft = ArrowLeft;
    readonly Edit2 = Edit2;
    readonly Trash2 = Trash2;

    asset: AssetDto | null = null;
    loading = true;
    error: string | null = null;
    warehouseId: number = 0;

    // Modal states
    showEditModal = false;
    showDeleteDialog = false;
    loadingAsset = false;

    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private assetService: AssetService,
        private toastService: ToastService,
        private translateService: TranslateService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        const assetId = Number(this.route.snapshot.paramMap.get('id'));
        this.warehouseId = Number(this.route.snapshot.paramMap.get('warehouseId'));

        if (assetId) {
            this.loadAssetDetails(assetId);
        } else {
            this.loading = false;
            this.error = 'Invalid asset ID';
            this.cdr.markForCheck();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadAssetDetails(id: number): void {
        this.loading = true;
        this.cdr.markForCheck();
        this.assetService.getById<AssetDto>(id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (asset) => {
                    this.asset = asset;
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: (error) => {
                    console.error('Error loading asset:', error);
                    this.error = 'Failed to load asset details';
                    this.loading = false;
                    this.cdr.markForCheck();
                    this.translateService.get(['toast.error', 'assetDetails.failedToLoad']).subscribe(translations => {
                        this.toastService.error(
                            translations['assetDetails.failedToLoad'] || 'Failed to load asset details',
                            translations['toast.error']
                        );
                    });
                }
            });
    }

    getItemName(): string {
        if (!this.asset?.item) return '-';
        const lang = getCurrentLang(this.translateService);
        return getLocalizedName(this.asset.item, lang) || this.asset.item.name || '-';
    }

    getStatusLabel(): string {
        return getAssetStatusLabel(this.asset?.status);
    }

    getStatusColor(): string {
        switch (this.asset?.status) {
            case 1: return 'success';
            case 2: return 'info';
            case 3: return 'warning';
            case 4: return 'error';
            default: return 'default';
        }
    }

    /**
     * Check if asset is a weapon (itemType === 2)
     * Handles both number and string types from backend
     */
    get isWeapon(): boolean {
        const itemType = this.asset?.item?.itemType;
        if (itemType === undefined || itemType === null) return false;
        // Handle number type (ItemType enum)
        if (typeof itemType === 'number') {
            return itemType === 2;
        }
        // Handle string type (from backend serialization)
        if (typeof itemType === 'string') {
            return itemType === '2' || itemType === 'Weapon';
        }
        return false;
    }

    formatDate(date?: Date | string): string {
        if (!date) return '-';
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        return dateObj.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    onBack(): void {
        // Preserve tab query parameter when navigating back
        const tabParam = this.route.snapshot.queryParams['tab'];
        const queryParams = tabParam ? { tab: tabParam } : {};

        this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
            queryParams
        });
    }

    onEdit(): void {
        if (!this.asset) return;
        // Reload asset to ensure we have latest data
        this.loadingAsset = true;
        this.cdr.markForCheck();
        this.assetService.getById<AssetDto>(this.asset.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (asset) => {
                    this.asset = asset;
                    this.loadingAsset = false;
                    this.showEditModal = true;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.loadingAsset = false;
                    this.cdr.markForCheck();
                }
            });
    }

    onDelete(): void {
        if (!this.asset) return;
        this.showDeleteDialog = true;
        this.cdr.markForCheck();
    }

    onEditModalClosed(): void {
        this.showEditModal = false;
        // Reload asset data after edit
        if (this.asset) {
            this.loadAssetDetails(this.asset.id);
        }
        this.cdr.markForCheck();
    }

    onEditModalSaved(): void {
        // Asset will be reloaded in onEditModalClosed
    }

    onDeleteConfirm(): void {
        if (!this.asset) return;

        this.assetService.delete(this.asset.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.translateService.get(['toast.success', 'assetDetails.deleted']).subscribe(translations => {
                        this.toastService.success(
                            translations['assetDetails.deleted'] || 'Asset deleted successfully',
                            translations['toast.success']
                        );
                    });
                    this.showDeleteDialog = false;
                    // Preserve tab query parameter when navigating back after delete
                    const tabParam = this.route.snapshot.queryParams['tab'];
                    const queryParams = tabParam ? { tab: tabParam } : {};

                    this.router.navigate(['/warehouse', this.warehouseId, 'inventory'], {
                        queryParams
                    });
                },
                error: (error) => {
                    console.error('Error deleting asset:', error);
                    this.translateService.get(['toast.error', 'assetDetails.failedToDelete']).subscribe(translations => {
                        this.toastService.error(
                            translations['assetDetails.failedToDelete'] || 'Failed to delete asset',
                            translations['toast.error']
                        );
                    });
                    this.showDeleteDialog = false;
                    this.cdr.markForCheck();
                }
            });
    }

    onDeleteCancel(): void {
        this.showDeleteDialog = false;
        this.cdr.markForCheck();
    }

    getDeleteMessage(): string {
        if (!this.asset) return '';
        return `${this.getItemName()} (${this.asset.serialNumber || 'No Serial'})`;
    }
}

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, switchMap, of, catchError } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, Edit2, Trash2 } from 'lucide-angular';

import { AssetService } from '@services/asset.service';
import { ToastService } from '@services/toast.service';
import { AssetDto, getAssetStatusLabel } from '@models/asset.model';
import { CardComponent } from '@components/card/card.component';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditAssetModalComponent } from '../edit/components/edit-asset-modal/edit-asset-modal.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { formatDateShort } from '@utils/format.utils';
import { WeaponDto } from '@models/weapon.model';
import { AssetPropertyAccessor } from '@core/utils/asset-property.utils';
import { LookupService } from '@services/lookup.service';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';

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

    // Image state
    imageUrl: string | null = null;
    private blobUrls: Set<string> = new Set();

    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private assetService: AssetService,
        private toastService: ToastService,
        private translateService: TranslateService,
        private cdr: ChangeDetectorRef,
        public propertyAccessor: AssetPropertyAccessor,
        private lookupService: LookupService,
        private fileUploadService: FileUploadService,
        private http: HttpClient
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
        // Clean up all blob URLs to prevent memory leaks
        this.blobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.warn('Error revoking blob URL:', e);
            }
        });
        this.blobUrls.clear();
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadAssetDetails(id: number): void {
        this.loading = true;
        this.cdr.markForCheck();
        
        // Initialize AssetPropertyAccessor with lookup data
        this.lookupService.getUnits().pipe(takeUntil(this.destroy$)).subscribe({
            next: (units) => {
                const tabParam = this.route.snapshot.queryParams['tab'] || 'weapon';
                this.propertyAccessor.initialize(units, tabParam as 'ammunition' | 'weapon' | 'explosive');
            }
        });

        this.assetService.getById<AssetDto>(id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (asset) => {
                    this.asset = asset;
                    this.loading = false;
                    // Load image after asset data is loaded
                    if (asset?.item?.id) {
                        this.loadImage(asset.item.id);
                    }
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
        const formatted = formatDateShort(date);
        return formatted === 'N/A' ? '-' : formatted;
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

    // Weapon details getters
    getWeaponItem(): WeaponDto | null {
        return this.asset?.item || null;
    }

    getCaliber(): string {
        return this.propertyAccessor.getCaliber(this.getWeaponItem()) || '-';
    }

    getCaliberUnit(): string {
        return this.propertyAccessor.getCaliberUnit(this.getWeaponItem()) || '-';
    }

    getModel(): string {
        return this.propertyAccessor.getModel(this.getWeaponItem()) || '-';
    }

    getYearOfManufacture(): string {
        return this.propertyAccessor.getYearOfManufacture(this.getWeaponItem()) || '-';
    }

    getCountryOfManufacture(): string {
        return this.propertyAccessor.getCountryOfManufacture(this.getWeaponItem()) || '-';
    }

    getDistribution(): string {
        return this.propertyAccessor.getDistributionForWeapon(this.getWeaponItem()) || '-';
    }

    getReferenceNo(): string {
        return this.propertyAccessor.getReferenceNoForWeapon(this.getWeaponItem()) || '-';
    }

    getUnNumber(): string {
        return this.propertyAccessor.getUnNumberForWeapon(this.getWeaponItem()) || '-';
    }

    getClassification(): string {
        return this.propertyAccessor.getClassificationForWeapon(this.getWeaponItem()) || '-';
    }

    getWeaponType(): string {
        return this.propertyAccessor.getTypeForWeapon(this.getWeaponItem()) || '-';
    }

    getWeaponNotes(): string {
        return this.propertyAccessor.getNotesForWeapon(this.getWeaponItem()) || '-';
    }

    getPartNo(): string {
        return this.getWeaponItem()?.partNo || '-';
    }

    getNSN(): string {
        return this.getWeaponItem()?.nsn || '-';
    }

    getItemNo(): string {
        return this.getWeaponItem()?.itemNo || '-';
    }

    getPrice(): string {
        const price = this.getWeaponItem()?.price;
        return price != null ? price.toString() : '-';
    }

    getMinimumQuantity(): string {
        const minQty = this.getWeaponItem()?.minimumQuantity;
        return minQty != null ? minQty.toString() : '-';
    }

    getExpiryDate(): string {
        const expiryDate = this.getWeaponItem()?.expiryDate;
        if (!expiryDate) return '-';
        return this.formatDate(expiryDate);
    }

    getReadyForIssue(): string {
        const ready = this.getWeaponItem()?.readyForIssue;
        return ready != null ? (ready ? 'Yes' : 'No') : '-';
    }

    private loadImage(itemId: number): void {
        // Clean up previous image URL
        if (this.imageUrl) {
            try {
                URL.revokeObjectURL(this.imageUrl);
                this.blobUrls.delete(this.imageUrl);
            } catch (e) {
                console.warn('Error revoking previous image blob URL:', e);
            }
        }
        this.imageUrl = null;

        // Load images from weapon item
        this.fileUploadService.getFilesByEntity(FileEntityType.Weapon, itemId)
            .pipe(
                takeUntil(this.destroy$),
                switchMap((files: any[]) => {
                    if (!files || files.length === 0) {
                        return of(null);
                    }

                    // Get main images (there might be multiple with isMain: true)
                    const mainImages = files.filter((img: any) => img.isMain);
                    let latestImage: any;
                    
                    if (mainImages.length > 0) {
                        // If multiple main images exist, get the one with highest ID (latest uploaded)
                        latestImage = mainImages.reduce((latest: any, current: any) => 
                            (current.id > latest.id) ? current : latest
                        );
                    } else {
                        // If no main image, get the image with highest ID (latest uploaded)
                        latestImage = files.reduce((latest: any, current: any) => 
                            (current.id > latest.id) ? current : latest
                        );
                    }
                    
                    if (!latestImage?.id) {
                        return of(null);
                    }

                    // Get the download URL for the latest image
                    const imageUrl = this.fileUploadService.getFileDownloadUrl(latestImage.id);
                    
                    // Fetch image as blob with authentication
                    return this.http.get(imageUrl, { responseType: 'blob' }).pipe(
                        switchMap((blob) => {
                            if (blob.type && blob.type.startsWith('image/')) {
                                const blobUrl = URL.createObjectURL(blob);
                                this.blobUrls.add(blobUrl);
                                this.imageUrl = blobUrl;
                                this.cdr.markForCheck();
                            }
                            return of(null);
                        }),
                        catchError((err) => {
                            console.warn('Failed to load image blob:', err);
                            return of(null);
                        })
                    );
                }),
                catchError((err) => {
                    console.warn('Failed to get files:', err);
                    return of(null);
                })
            )
            .subscribe();
    }
}

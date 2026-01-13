import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, ChevronDown, ChevronRight, ChevronLeft, Package, AlertCircle, Search, Download, History, ArrowRight, User, Building } from 'lucide-angular';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { AssetService } from '@services/asset.service';
import { AssetHistoryService, AssetHistoryDto } from '@services/asset-history.service';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { AssetDto, AssetStatus } from '@models/asset.model';
import { CardComponent } from '@components/card/card.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { InventorySummaryDataService } from '@services/inventory-summary-data.service';
import { InventorySummaryUtils } from '@utils/inventory-summary.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { ToastService } from '@services/toast.service';

@Component({
    selector: 'app-inventory-summary',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        TranslateModule,
        LucideAngularModule,
        CardComponent,
        LoadingStateComponent,
        ErrorStateComponent,
        PaginationComponent,
        RowsPerPageComponent
    ],
    providers: [InventorySummaryDataService],
    templateUrl: './inventory-summary.component.html',
    styleUrls: ['./inventory-summary.component.css']
})
export class InventorySummaryComponent implements OnInit, OnDestroy {
    // Data
    items: ItemInventorySummaryDto[] = [];
    filteredItems: ItemInventorySummaryDto[] = [];
    paginatedItems: ItemInventorySummaryDto[] = [];

    // Accordion state
    expandedItemIds = new Set<number>();
    lotsByItemId = new Map<number, LotDetailDto[]>();
    assetsByItemId = new Map<number, AssetDto[]>();
    loadingLots = new Set<number>();
    loadingAssets = new Set<number>();

    // Asset History state
    expandedAssetIds = new Set<number>();
    historyByAssetId = new Map<number, AssetHistoryDto[]>();
    loadingHistory = new Set<number>();

    // UI state
    loading = true;
    error: string | null = null;
    activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
    searchTerm = '';

    // Pagination
    currentPage = 1;
    rowsPerPage = 10;
    totalPages = 1;

    // Icons
    readonly ChevronDown = ChevronDown;
    readonly ChevronRight = ChevronRight;
    readonly ChevronLeft = ChevronLeft;
    readonly Package = Package;
    readonly AlertCircle = AlertCircle;
    readonly Search = Search;
    readonly Download = Download;
    readonly History = History;
    readonly ArrowRight = ArrowRight;
    readonly User = User;
    readonly Building = Building;

    private destroy$ = new Subject<void>();

    constructor(
        private dataService: InventorySummaryDataService,
        private inventoryService: InventoryService,
        private assetService: AssetService,
        private assetHistoryService: AssetHistoryService,
        private translateService: TranslateService,
        private translationService: TranslationService,
        private excelExportService: ExcelExportService,
        private toastService: ToastService
    ) { }

    get isRTL(): boolean {
        return this.translationService?.isRTL() ?? false;
    }

    getExpandIcon(isExpanded: boolean): any {
        if (isExpanded) {
            return ChevronDown;
        }
        return this.isRTL ? ChevronLeft : ChevronRight;
    }

    ngOnInit(): void {
        this.loadInventorySummary();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Load all inventory items from all sources
     */
    loadInventorySummary(): void {
        this.loading = true;
        this.error = null;

        this.dataService.loadAllItems()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (items) => {
                    this.items = items;
                    this.applyFilters();
                    this.loading = false;
                },
                error: () => {
                    this.error = 'Failed to load inventory summary';
                    this.loading = false;
                }
            });
    }

    /**
     * Switch between tabs (ammunition, weapon, explosive)
     */
    switchTab(tab: 'ammunition' | 'weapon' | 'explosive'): void {
        this.activeTab = tab;
        this.currentPage = 1;
        this.searchTerm = '';
        this.applyFilters();
    }

    /**
     * Handle search input change
     */
    onSearchChange(): void {
        this.currentPage = 1;
        this.applyFilters();
    }

    /**
     * Apply filters (tab + search) and update pagination
     */
    private applyFilters(): void {
        let filtered = [...this.items];

        // Filter by item type based on active tab
        const itemType = InventorySummaryUtils.getItemTypeFromTab(this.activeTab);
        filtered = filtered.filter(item => item.itemType === itemType);

        // Apply search filter
        if (this.searchTerm.trim()) {
            const search = this.searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.itemName?.toLowerCase().includes(search) ||
                item.itemNo?.toLowerCase().includes(search) ||
                item.nsn?.toLowerCase().includes(search) ||
                item.partNo?.toLowerCase().includes(search)
            );
        }

        this.filteredItems = filtered;
        this.updatePagination();
    }

    /**
     * Update pagination based on filtered items
     */
    private updatePagination(): void {
        this.totalPages = Math.ceil(this.filteredItems.length / this.rowsPerPage);

        // Ensure current page is valid
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        this.paginatedItems = this.filteredItems.slice(startIndex, endIndex);
    }

    /**
     * Handle page change
     */
    onPageChange(page: number): void {
        this.currentPage = page;
        this.updatePagination();
    }

    /**
     * Handle rows per page change
     */
    onRowsPerPageChange(rows: number): void {
        this.rowsPerPage = rows;
        this.currentPage = 1;
        this.updatePagination();
    }

    /**
     * Toggle accordion row expansion
     */
    toggleRow(itemId: number, itemType: number): void {
        if (this.expandedItemIds.has(itemId)) {
            this.expandedItemIds.delete(itemId);
        } else {
            this.expandedItemIds.add(itemId);

            // For weapons (itemType 2), load assets instead of lots
            if (itemType === 2) {
                if (!this.assetsByItemId.has(itemId)) {
                    this.loadAssetsForItem(itemId);
                }
            } else {
                // For ammunition and explosives, load lots
                if (!this.lotsByItemId.has(itemId)) {
                    this.loadLotsForItem(itemId);
                }
            }
        }
    }

    /**
     * Check if row is expanded
     */
    isExpanded(itemId: number): boolean {
        return this.expandedItemIds.has(itemId);
    }

    /**
     * Toggle asset history expansion
     */
    toggleAsset(assetId: number): void {
        if (this.expandedAssetIds.has(assetId)) {
            this.expandedAssetIds.delete(assetId);
        } else {
            this.expandedAssetIds.add(assetId);
            if (!this.historyByAssetId.has(assetId)) {
                this.loadHistoryForAsset(assetId);
            }
        }
    }

    /**
     * Check if asset is expanded
     */
    isAssetExpanded(assetId: number): boolean {
        return this.expandedAssetIds.has(assetId);
    }

    /**
     * Load history for an asset
     */
    private loadHistoryForAsset(assetId: number): void {
        this.loadingHistory.add(assetId);

        this.assetHistoryService.getByAssetId(assetId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (history) => {
                    this.historyByAssetId.set(assetId, history);
                    this.loadingHistory.delete(assetId);
                },
                error: (err) => {
                    console.error('Error loading history', err);
                    this.loadingHistory.delete(assetId);
                    this.toastService.error('Error loading history');
                }
            });
    }

    getHistoryForAsset(assetId: number): AssetHistoryDto[] {
        return this.historyByAssetId.get(assetId) || [];
    }

    isLoadingHistory(assetId: number): boolean {
        return this.loadingHistory.has(assetId);
    }

    /**
     * Load lot details for an item
     */
    private loadLotsForItem(itemId: number): void {
        this.loadingLots.add(itemId);

        this.inventoryService.getLotsByItemId(itemId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (lots) => {
                    this.lotsByItemId.set(itemId, lots);
                    this.loadingLots.delete(itemId);
                },
                error: () => {
                    this.loadingLots.delete(itemId);
                }
            });
    }

    /**
     * Get lots for a specific item
     */
    getLotsForItem(itemId: number): LotDetailDto[] {
        return this.lotsByItemId.get(itemId) || [];
    }

    /**
     * Check if lots are currently loading for an item
     */
    isLoadingLots(itemId: number): boolean {
        return this.loadingLots.has(itemId);
    }

    /**
     * Load assets for a weapon item
     */
    private loadAssetsForItem(itemId: number): void {
        this.loadingAssets.add(itemId);

        this.assetService.getAll<AssetDto>({ search: '' })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (assets) => {
                    // Filter assets by itemId and not deleted
                    const itemAssets = assets.filter(a => a.itemId === itemId && !a.isDeleted);
                    this.assetsByItemId.set(itemId, itemAssets);
                    this.loadingAssets.delete(itemId);
                },
                error: () => {
                    this.loadingAssets.delete(itemId);
                }
            });
    }

    /**
     * Get assets for a specific weapon item
     */
    getAssetsForItem(itemId: number): AssetDto[] {
        return this.assetsByItemId.get(itemId) || [];
    }

    /**
     * Check if assets are currently loading for an item
     */
    isLoadingAssets(itemId: number): boolean {
        return this.loadingAssets.has(itemId);
    }

    /**
     * Get asset status label
     */
    getAssetStatusLabel(asset: AssetDto): string {
        switch (asset.status) {
            case AssetStatus.Active: return 'assetStatus.active';
            case AssetStatus.Inactive: return 'assetStatus.inactive';
            case AssetStatus.Maintenance: return 'assetStatus.maintenance';
            case AssetStatus.Disposed: return 'assetStatus.disposed';
            case AssetStatus.Lost: return 'assetStatus.lost';
            case AssetStatus.Damaged: return 'assetStatus.damaged';
            default: return 'assetStatus.unknown';
        }
    }

    /**
     * Get asset status badge class
     */
    getAssetStatusClass(asset: AssetDto): string {
        switch (asset.status) {
            case AssetStatus.Active: return 'bg-green-100 text-green-800';
            case AssetStatus.Inactive: return 'bg-blue-100 text-blue-800';
            case AssetStatus.Maintenance: return 'bg-yellow-100 text-yellow-800';
            case AssetStatus.Disposed: return 'bg-red-100 text-red-800';
            case AssetStatus.Lost: return 'bg-red-100 text-red-800';
            case AssetStatus.Damaged: return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    /**
     * Get asset assignee name (custodian)
     */
    getAssetAssigneeName(asset: AssetDto): string {
        return asset.custodian ? getLocalizedName(asset.custodian, getCurrentLang(this.translateService)) || '-' : '-';
    }

    /**
     * Get asset depot name
     */
    getAssetDepotName(asset: AssetDto): string {
        return asset.depot ? getLocalizedName(asset.depot, getCurrentLang(this.translateService)) || '-' : '-';
    }

    // Formatting methods using utils
    formatNumber(num: number): string {
        return InventorySummaryUtils.formatNumber(num);
    }

    formatDate(date?: string): string {
        return InventorySummaryUtils.formatDate(date);
    }

    getItemTypeName(itemType: number): string {
        return InventorySummaryUtils.getItemTypeName(itemType);
    }

    // Lot detail getters
    getDepotName(lot: LotDetailDto): string {
        return lot.depot ? getLocalizedName(lot.depot, getCurrentLang(this.translateService)) || '-' : '-';
    }

    getSupplierName(lot: LotDetailDto): string {
        return lot.supplier ? getLocalizedName(lot.supplier, getCurrentLang(this.translateService)) || '-' : '-';
    }

    getManufacturerName(lot: LotDetailDto): string {
        return lot.manufacturer ? getLocalizedName(lot.manufacturer, getCurrentLang(this.translateService)) || '-' : '-';
    }

    getCountryName(lot: LotDetailDto): string {
        return lot.country ? getLocalizedName(lot.country, getCurrentLang(this.translateService)) || '-' : '-';
    }

    /**
     * Export inventory summary to Excel
     */
    exportToExcel(): void {
        const columns: ExcelColumn[] = [
            {
                header: this.translateService.instant('inventorySummary.itemName'),
                key: 'itemName',
                width: 30
            },
            {
                header: this.translateService.instant('inventorySummary.itemNo'),
                key: 'itemNo',
                width: 15
            },
            {
                header: this.translateService.instant('inventorySummary.partNo'),
                key: 'partNo',
                width: 15,
                format: (value: string) => value || '-'
            },
            {
                header: this.translateService.instant('inventorySummary.nsn'),
                key: 'nsn',
                width: 15,
                format: (value: string) => value || '-'
            },
            {
                header: this.translateService.instant('inventorySummary.totalQty'),
                key: 'totalQuantity',
                width: 15
            },
            {
                header: this.translateService.instant('inventorySummary.usedQty'),
                key: 'usedQuantity',
                width: 15
            },
            {
                header: this.translateService.instant('inventorySummary.reservedQty'),
                key: 'reservedQuantityByOrdersOnProcessing',
                width: 18
            },
            {
                header: this.translateService.instant('inventorySummary.remainingQty'),
                key: 'remainingQuantity',
                width: 18
            },
            {
                header: this.translateService.instant('inventorySummary.totalLots'),
                key: 'totalLots',
                width: 12
            }
        ];

        const fileName = `Inventory_Summary_${this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1)}`;

        this.excelExportService.exportToExcel({
            fileName: fileName,
            sheetName: 'Summary',
            columns: columns,
            data: this.filteredItems,
            includeTimestamp: true
        });

        this.translateService.get(['common.exportSuccess', 'toast.success']).subscribe(translations => {
            this.toastService.success(translations['common.exportSuccess'], translations['toast.success']);
        });
    }
}

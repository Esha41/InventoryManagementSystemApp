import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, ChevronDown, ChevronRight, ChevronLeft, Package, AlertCircle, Search, Download, Upload, History, ArrowRight, User, Building } from 'lucide-angular';
import { InventoryService, LotDetailDto } from '@inventory/services/inventory.service';
import { AssetService } from '@assets/services/asset.service';
import { AssetHistoryService, AssetHistoryDto } from '@assets/services/asset-history.service';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { AssetDto, AssetStatus, getAssetStatusLabel } from '@models/asset.model';
import { PagedListRequest } from '@models/pagination.model';
import { pageCountForLength } from '@inventory/pages/overview/inventory-dashboard.helpers';
import { CardComponent } from '@components/card/card.component';
import { LoadingStateComponent, ErrorStateComponent, TableClampTooltipDirective } from '@components/index';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { InventorySummaryDataService } from '@inventory/services/inventory-summary-data.service';
import { InventorySummaryUtils } from '@warehouse/utils/inventory-summary.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { ExcelService, ExcelColumn } from '@services/excel.service';
import { ToastService } from '@services/toast.service';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { trackById, trackByKey, trackByIndex } from '@utils/trackby.utils';
import { defaultPageSize } from '@constants/app.constants';

type ExpandChevronIcon = typeof ChevronDown | typeof ChevronLeft | typeof ChevronRight;

@Component({
    selector: 'app-warehouse-inventory-summary',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        LucideAngularModule,
        CardComponent,
        LoadingStateComponent,
        ErrorStateComponent,
        PaginationComponent,
        RowsPerPageComponent,
        AppDatePipe,
        TableClampTooltipDirective
    ],
    templateUrl: './warehouse-inventory-summary.component.html',
    styleUrls: ['./warehouse-inventory-summary.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WarehouseInventorySummaryComponent implements OnInit, OnDestroy {
    /** Current server page rows (before optional client search filter). */
    pageItems: ItemInventorySummaryDto[] = [];
    /** Total rows for active tab from API (pagination). */
    serverTotalCount = 0;

    // Accordion state
    expandedItemIds = new Set<number>();
    lotsByItemId = new Map<number, LotDetailDto[]>();
    /** Current server page of assets per expanded weapon row (POST .../item/{id}/paged). */
    assetsByItemId = new Map<number, AssetDto[]>();
    assetTotalCountByItemId = new Map<number, number>();
    assetCurrentPageByItemId = new Map<number, number>();
    /** Page size for weapon asset accordion (one API request per page). */
    assetRowsPerPage = defaultPageSize;
    loadingLots = new Set<number>();
    loadingAssets = new Set<number>();

    // Asset History state
    expandedAssetIds = new Set<number>();
    historyByAssetId = new Map<number, AssetHistoryDto[]>();
    loadingHistory = new Set<number>();

    // UI state
    loading = true;
    /** True while accumulating all pages for Excel export. */
    isExporting = false;
    error: string | null = null;
    activeTab: 'ammunition' | 'weapon' | 'explosive' = 'ammunition';
    searchTerm = '';

    // Pagination (server-driven)
    currentPage = 1;
    rowsPerPage = defaultPageSize;

    // Icons
    readonly ChevronDown = ChevronDown;
    readonly ChevronRight = ChevronRight;
    readonly ChevronLeft = ChevronLeft;
    readonly Package = Package;
    readonly AlertCircle = AlertCircle;
    readonly Search = Search;
    readonly Upload = Upload;
    readonly Download = Download;
    readonly History = History;
    readonly ArrowRight = ArrowRight;
    readonly User = User;
    readonly Building = Building;
    readonly trackByItemId = trackByKey('itemId');
    readonly trackById = trackById;
    readonly trackByIndex = trackByIndex;
    readonly trackByInventoryDetailId = trackByKey('inventoryDetailId');

    private destroy$ = new Subject<void>();

    constructor(
        private dataService: InventorySummaryDataService,
        private inventoryService: InventoryService,
        private assetService: AssetService,
        private assetHistoryService: AssetHistoryService,
        private translateService: TranslateService,
        private translationService: TranslationService,
        private excelService: ExcelService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    get isRTL(): boolean {
        return this.translationService?.isRTL() ?? false;
    }

    /** Rows to show: server page, optionally narrowed by search (current page only). */
    get displayRows(): ItemInventorySummaryDto[] {
        if (!this.searchTerm.trim()) {
            return this.pageItems;
        }
        const search = this.searchTerm.toLowerCase();
        return this.pageItems.filter(item =>
            item.itemName?.toLowerCase().includes(search) ||
            item.itemNo?.toLowerCase().includes(search) ||
            item.nsn?.toLowerCase().includes(search) ||
            item.partNo?.toLowerCase().includes(search)
        );
    }

    /** Total pages from server count. */
    get totalPages(): number {
        if (this.serverTotalCount <= 0) {
            return 0;
        }
        return Math.ceil(this.serverTotalCount / this.rowsPerPage);
    }

    /** Aggregates: first chip = tab total from server; quantity chips = current visible rows only. */
    get summaryItemCount(): number {
        return this.serverTotalCount;
    }

    get summaryTotalLots(): number {
        return this.displayRows.reduce((s, i) => s + (Number(i.totalLots) || 0), 0);
    }

    get summaryTotalQuantity(): number {
        return this.displayRows.reduce((s, i) => s + (Number(i.totalQuantity) || 0), 0);
    }

    get summaryUsedQuantity(): number {
        return this.displayRows.reduce((s, i) => s + (Number(i.usedQuantity) || 0), 0);
    }

    get summaryReservedQuantity(): number {
        return this.displayRows.reduce(
            (s, i) => s + (Number(i.reservedQuantityByOrdersOnProcessing) || 0),
            0
        );
    }

    get summaryRemainingQuantity(): number {
        return this.displayRows.reduce((s, i) => s + (Number(i.remainingQuantity) || 0), 0);
    }

    getExpandIcon(isExpanded: boolean): ExpandChevronIcon {
        if (isExpanded) {
            return this.ChevronDown;
        }
        return this.isRTL ? this.ChevronLeft : this.ChevronRight;
    }

    ngOnInit(): void {
        this.loadPage();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadPage(): void {
        this.loading = true;
        this.error = null;
        this.cdr.markForCheck();

        this.dataService
            .loadWarehouseSummaryPage(this.activeTab, this.currentPage, this.rowsPerPage, undefined)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ items, totalCount }) => {
                    this.pageItems = items;
                    this.serverTotalCount = totalCount;
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error = 'Failed to load inventory summary';
                    this.loading = false;
                    this.pageItems = [];
                    this.serverTotalCount = 0;
                    this.cdr.markForCheck();
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
        this.expandedItemIds.clear();
        this.lotsByItemId.clear();
        this.assetsByItemId.clear();
        this.assetTotalCountByItemId.clear();
        this.assetCurrentPageByItemId.clear();
        this.expandedAssetIds.clear();
        this.historyByAssetId.clear();
        this.loadPage();
    }

    /**
     * Handle search input change
     */
    onSearchChange(): void {
        this.cdr.markForCheck();
    }

    onPageChange(page: number): void {
        if (page === this.currentPage) {
            return;
        }
        this.currentPage = page;
        this.loadPage();
    }

    onRowsPerPageChange(rows: number): void {
        if (rows === this.rowsPerPage) {
            return;
        }
        this.rowsPerPage = rows;
        this.currentPage = 1;
        this.loadPage();
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
                    this.assetCurrentPageByItemId.set(itemId, 1);
                    this.loadAssetsForItem(itemId, 1);
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
        this.cdr.markForCheck();

        this.assetHistoryService.getByAssetId(assetId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (history) => {
                    this.historyByAssetId.set(assetId, history);
                    this.loadingHistory.delete(assetId);
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    console.error('Error loading history', err);
                    this.loadingHistory.delete(assetId);
                    this.toastService.error('Error loading history');
                    this.cdr.markForCheck();
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
        this.cdr.markForCheck();

        this.inventoryService.getLotsByItemId(itemId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (lots) => {
                    this.lotsByItemId.set(itemId, lots);
                    this.loadingLots.delete(itemId);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.loadingLots.delete(itemId);
                    this.cdr.markForCheck();
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
     * Load one page of assets for a weapon item (`POST /api/Asset/item/{itemId}/paged`).
     */
    private loadAssetsForItem(itemId: number, page: number): void {
        this.assetCurrentPageByItemId.set(itemId, page);
        this.loadingAssets.add(itemId);
        this.cdr.markForCheck();

        const request: PagedListRequest = {
            page,
            pageSize: this.assetRowsPerPage
        };

        this.assetService.getAssetsByItemIdPaged(itemId, request)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (res) => {
                    this.assetsByItemId.set(itemId, res.items ?? []);
                    this.assetTotalCountByItemId.set(itemId, res.totalCount ?? 0);
                    this.loadingAssets.delete(itemId);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.loadingAssets.delete(itemId);
                    this.cdr.markForCheck();
                }
            });
    }

    getAssetTotalPages(itemId: number): number {
        const total = this.assetTotalCountByItemId.get(itemId) ?? 0;
        return pageCountForLength(total, this.assetRowsPerPage);
    }

    getAssetCurrentPage(itemId: number): number {
        return this.assetCurrentPageByItemId.get(itemId) ?? 1;
    }

    onWeaponAssetPageChange(itemId: number, page: number): void {
        if (page === this.getAssetCurrentPage(itemId)) {
            return;
        }
        this.loadAssetsForItem(itemId, page);
    }

    /**
     * Get assets for a specific weapon item (current server page)
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
        return getAssetStatusLabel(asset.status);
    }

    /**
     * Get asset status badge class (API returns enum names as strings)
     */
    getAssetStatusClass(asset: AssetDto): string {
        const status = asset.status as AssetStatus | string | undefined;
        switch (status) {
            case AssetStatus.ReadyToIssue:
            case 'ReadyToIssue': return 'bg-green-100 text-green-800';
            case AssetStatus.NotReadyToIssue:
            case 'NotReadyToIssue': return 'bg-yellow-100 text-yellow-800';
            case AssetStatus.InMaintenance:
            case 'InMaintenance':
            case AssetStatus.UnserviceableRepairable:
            case 'UnserviceableRepairable': return 'bg-yellow-100 text-yellow-800';
            case AssetStatus.UnserviceableUnrepairable:
            case 'UnserviceableUnrepairable':
            case AssetStatus.AwaitingDisposal:
            case 'AwaitingDisposal':
            case AssetStatus.Disposed:
            case 'Disposed': return 'bg-red-100 text-red-800';
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
     * Export inventory summary to Excel (all rows for the tab, not the current page).
     */
    exportToExcel(): void {
        if (this.loading || this.isExporting || this.serverTotalCount === 0) {
            return;
        }

        this.isExporting = true;
        this.cdr.markForCheck();

        this.dataService
            .loadAllWarehouseSummaryItems(this.activeTab, undefined)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: items => {
                    const rows = this.filterItemsBySearch(items);
                    this.isExporting = false;
                    this.cdr.markForCheck();

                    if (rows.length === 0) {
                        const msgKey = this.searchTerm.trim()
                            ? 'inventorySummary.noResults'
                            : 'inventorySummary.noItems';
                        this.toastService.error(
                            this.translateService.instant(msgKey),
                            this.translateService.instant('common.error')
                        );
                        return;
                    }

                    const fileName = `Inventory_Summary_${this.activeTab.charAt(0).toUpperCase() + this.activeTab.slice(1)}`;
                    this.excelService.exportToExcel({
                        fileName,
                        sheetName: 'Summary',
                        columns: this.buildExportColumns(),
                        data: rows,
                        includeTimestamp: true
                    });

                    this.translateService
                        .get(['common.exportSuccess', 'toast.success'])
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(translations => {
                            this.toastService.success(
                                translations['common.exportSuccess'],
                                translations['toast.success']
                            );
                        });
                },
                error: () => {
                    this.isExporting = false;
                    this.cdr.markForCheck();
                    this.toastService.error(
                        this.translateService.instant('common.error'),
                        this.translateService.instant('common.error')
                    );
                }
            });
    }

    private filterItemsBySearch(items: ItemInventorySummaryDto[]): ItemInventorySummaryDto[] {
        if (!this.searchTerm.trim()) {
            return items;
        }
        const search = this.searchTerm.toLowerCase();
        return items.filter(
            item =>
                item.itemName?.toLowerCase().includes(search) ||
                item.itemNo?.toLowerCase().includes(search) ||
                item.nsn?.toLowerCase().includes(search) ||
                item.partNo?.toLowerCase().includes(search)
        );
    }

    private buildExportColumns(): ExcelColumn[] {
        return [
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
                header: 'Part No',
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
    }
}

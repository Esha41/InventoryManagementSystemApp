import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, ChevronDown, ChevronRight, Package, AlertCircle, Search } from 'lucide-angular';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { ItemInventorySummaryDto } from '@models/inventory.model';
import { CardComponent } from '@components/card/card.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { InventorySummaryDataService } from '@services/inventory-summary-data.service';
import { InventorySummaryUtils } from '@utils/inventory-summary.utils';

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
    loadingLots = new Set<number>();

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
    readonly Package = Package;
    readonly AlertCircle = AlertCircle;
    readonly Search = Search;

    private destroy$ = new Subject<void>();

    constructor(
        private dataService: InventorySummaryDataService,
        private inventoryService: InventoryService
    ) { }

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
                error: (error) => {
                    console.error('Error loading inventory summary:', error);
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
    toggleRow(itemId: number): void {
        if (this.expandedItemIds.has(itemId)) {
            this.expandedItemIds.delete(itemId);
        } else {
            this.expandedItemIds.add(itemId);

            // Load lots if not already loaded
            if (!this.lotsByItemId.has(itemId)) {
                this.loadLotsForItem(itemId);
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
                error: (error) => {
                    console.error(`Error loading lots for item ${itemId}:`, error);
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
        return lot.depot?.nameEn || lot.depot?.nameAr || '-';
    }

    getSupplierName(lot: LotDetailDto): string {
        return lot.supplier?.nameEn || lot.supplier?.nameAr || '-';
    }

    getManufacturerName(lot: LotDetailDto): string {
        return lot.manufacturer?.nameEn || lot.manufacturer?.nameAr || '-';
    }

    getCountryName(lot: LotDetailDto): string {
        return lot.country?.nameEn || lot.country?.nameAr || '-';
    }
}

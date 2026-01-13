import { Injectable } from '@angular/core';
import { ItemWithAssets } from './weapon-supply-review.service';

/**
 * Service to handle UI-specific state and operations for weapon supply review
 */
@Injectable()
export class WeaponSupplyUIService {

    // Pagination state
    private _currentPage: number = 1;
    private _pageSize: number = 5;

    // Search state
    private _searchTerm: string = '';

    // Accordion state
    private _expandedState: { [key: number]: boolean } = {};

    get currentPage(): number {
        return this._currentPage;
    }

    get pageSize(): number {
        return this._pageSize;
    }

    get searchTerm(): string {
        return this._searchTerm;
    }

    /**
     * Filter items based on search term
     */
    filterItems(items: ItemWithAssets[]): ItemWithAssets[] {
        if (!this._searchTerm || !this._searchTerm.trim()) {
            return items;
        }

        const term = this._searchTerm.toLowerCase();
        return items.filter(item =>
            item.itemName.toLowerCase().includes(term) ||
            item.selectedAssets.some(a => a.serialNumber?.toLowerCase().includes(term))
        );
    }

    /**
     * Get paginated items
     */
    paginateItems(items: ItemWithAssets[]): ItemWithAssets[] {
        const start = (this._currentPage - 1) * this._pageSize;
        const end = start + this._pageSize;
        return items.slice(start, end);
    }

    /**
     * Calculate total pages
     */
    getTotalPages(totalItems: number): number {
        return Math.ceil(totalItems / this._pageSize);
    }

    /**
     * Update search term and reset to first page
     */
    setSearchTerm(term: string): void {
        this._searchTerm = term;
        this._currentPage = 1;
    }

    /**
     * Navigate to specific page
     */
    setPage(page: number, totalPages: number): void {
        if (page >= 1 && page <= totalPages) {
            this._currentPage = page;
        }
    }

    /**
     * Toggle item expansion state
     */
    toggleItemExpanded(itemId: number): void {
        if (this._expandedState[itemId] === undefined) {
            this._expandedState[itemId] = false; // Default is open, so toggle to close
        } else {
            this._expandedState[itemId] = !this._expandedState[itemId];
        }
    }

    /**
     * Check if item is expanded
     */
    isItemExpanded(itemId: number): boolean {
        return this._expandedState[itemId] === undefined ? true : this._expandedState[itemId];
    }

    /**
     * Reset all UI state
     */
    reset(): void {
        this._currentPage = 1;
        this._searchTerm = '';
        this._expandedState = {};
    }
}

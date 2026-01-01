import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LookupItem, LookupTableConfig, CreateUpdateLookupDto, LOOKUP_TABLES } from '@models/lookup.model';
import { LookupService } from './lookup.service';
import { TranslateService } from '@ngx-translate/core';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

/**
 * Lookup Management Service
 * Handles lookup-related business logic, filtering, and data operations
 */
@Injectable({
  providedIn: 'root'
})
export class LookupManagementService {
  constructor(
    private lookupService: LookupService,
    private translateService: TranslateService
  ) {}

  /**
   * Get all lookup tables
   */
  getLookupTables(): LookupTableConfig[] {
    return LOOKUP_TABLES;
  }

  /**
   * Load lookup items for a specific table
   */
  loadLookupItems(tableEndpoint: string): Observable<LookupItem[]> {
    return this.lookupService.getLookupItems(tableEndpoint).pipe(
      map(items => items.filter(item => !item.isDeleted))
    );
  }

  /**
   * Create a lookup item
   */
  createLookupItem(tableEndpoint: string, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    return this.lookupService.createLookupItem(tableEndpoint, dto);
  }

  /**
   * Update a lookup item
   */
  updateLookupItem(tableEndpoint: string, itemId: number, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    return this.lookupService.updateLookupItem(tableEndpoint, itemId, dto);
  }

  /**
   * Delete a lookup item
   */
  deleteLookupItem(tableEndpoint: string, itemId: number, dto: CreateUpdateLookupDto): Observable<boolean> {
    return this.lookupService.deleteLookupItem(tableEndpoint, itemId, dto);
  }

  /**
   * Filter lookup items by search term
   */
  filterLookupItems(items: LookupItem[], searchTerm: string): LookupItem[] {
    if (!searchTerm.trim()) {
      return items;
    }
    const search = searchTerm.toLowerCase();
    return items.filter(item =>
      item.nameEn.toLowerCase().includes(search) ||
      item.nameAr.toLowerCase().includes(search) ||
      (item.code && item.code.toLowerCase().includes(search))
    );
  }

  /**
   * Get localized lookup item name
   */
  getLookupItemName(item: LookupItem | null | undefined): string {
    if (!item) return '';
    return getLocalizedName(item, getCurrentLang(this.translateService)) || item.nameEn || '';
  }

  /**
   * Get the translated name for an ItemType enum value
   */
  getItemTypeName(item: LookupItem): string {
    let itemType = item.itemType;
    if (itemType === undefined || itemType === null) return '-';

    // Convert string enum to number if needed
    if (typeof itemType === 'string') {
      const itemTypeMap: { [key: string]: number } = {
        'Ammunition': 1,
        'Weapon': 2,
        'Explosive': 3
      };
      itemType = itemTypeMap[itemType] || 0;
    }

    // If still 0 or invalid, return dash
    if (itemType === 0) return '-';

    const translationKey = itemType === 1 ? 'lookupFormModal.ammunition'
      : itemType === 2 ? 'lookupFormModal.weapon'
        : itemType === 3 ? 'lookupFormModal.explosive'
          : '';

    if (!translationKey) return '-';

    return this.translateService.instant(translationKey);
  }

  /**
   * Get the raw ItemType enum value
   */
  getItemType(item: LookupItem): number {
    let itemType = item.itemType;
    if (itemType === undefined || itemType === null) return 0;

    if (typeof itemType === 'string') {
      const itemTypeMap: { [key: string]: number } = {
        'Ammunition': 1,
        'Weapon': 2,
        'Explosive': 3
      };
      return itemTypeMap[itemType] || 0;
    }

    return itemType;
  }
}


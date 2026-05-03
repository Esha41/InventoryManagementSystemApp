import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { LookupItem, LookupTableConfig, CreateUpdateLookupDto, LOOKUP_TABLES } from '@models/lookup.model';
import { LookupService } from '@services/lookup.service';
import { RequestPurposeService } from '@requests/services/request-purpose.service';
import { TranslateService } from '@ngx-translate/core';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { EmployeeService } from './employee.service';
import { EmployeeDto } from '@core/models/asset.model';

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
    private requestPurposeService: RequestPurposeService,
    private translateService: TranslateService,
    private employeeService: EmployeeService
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
  loadLookupItems(table: LookupTableConfig): Observable<LookupItem[]> {
    // Special case: Employee uses dedicated Employee API but is managed via lookup UI
    if (table.name === 'Employee') {
      return this.employeeService.getEmployees().pipe(
        map((employees: EmployeeDto[]) =>
          (employees || [])
            .filter(e => !e.isDeleted)
            .map(e => {
              const dept = e.department;
              const rank = e.rank;
              const lang = getCurrentLang(this.translateService);
              const departmentName = dept
                ? (lang === 'ar' ? (dept.nameAr || dept.nameEn) : (dept.nameEn || dept.nameAr)) || '-'
                : '-';
              const rankName = rank
                ? (lang === 'ar' ? (rank.nameAr || rank.nameEn) : (rank.nameEn || rank.nameAr)) || '-'
                : '-';
              return {
                id: e.id,
                nameEn: e.nameEn || '',
                nameAr: e.nameAr || '',
                code: e.militaryId || '',
                isDeleted: e.isDeleted,
                departmentName,
                rankName,
                phone: e.phone || '-',
                email: e.email || '-'
              } as LookupItem;
            })
        )
      );
    }

    if (table.requestPurposeType) {
      return this.requestPurposeService.getAll(table.requestPurposeType).pipe(
        map(items => items.filter(item => !item.isDeleted))
      );
    }
    return this.lookupService.getLookupItems(table.apiEndpoint).pipe(
      map(items => items.filter(item => !item.isDeleted))
    );
  }

  /**
   * Create a lookup item
   */
  createLookupItem(table: LookupTableConfig, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    if (table.requestPurposeType) {
      return this.requestPurposeService.create(table.requestPurposeType, dto);
    }
    return this.lookupService.createLookupItem(table.apiEndpoint, dto);
  }

  /**
   * Update a lookup item
   */
  updateLookupItem(table: LookupTableConfig, itemId: number, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    if (table.requestPurposeType) {
      return this.requestPurposeService.update(itemId, dto);
    }
    return this.lookupService.updateLookupItem(table.apiEndpoint, itemId, dto);
  }

  /**
   * Delete a lookup item
   */
  deleteLookupItem(table: LookupTableConfig, itemId: number, dto: CreateUpdateLookupDto): Observable<boolean> {
    if (table.requestPurposeType) {
      return this.requestPurposeService.delete(itemId);
    }
    return this.lookupService.deleteLookupItem(table.apiEndpoint, itemId, dto);
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
      (item.code && item.code.toLowerCase().includes(search)) ||
      (item.departmentName && item.departmentName.toLowerCase().includes(search)) ||
      (item.rankName && item.rankName.toLowerCase().includes(search)) ||
      (item.phone && item.phone !== '-' && item.phone.toLowerCase().includes(search)) ||
      (item.email && item.email !== '-' && item.email.toLowerCase().includes(search)) ||
      this.getItemTypeName(item).toLowerCase().includes(search)
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
    const itemType = item.itemType;
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


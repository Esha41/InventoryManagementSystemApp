import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Package, Plus, CheckCircle, Clock } from 'lucide-angular';
import { SupplyItemDisplay } from '@models/supply-order.model';
import { formatNumber as formatNumberUtil, formatDate as formatDateUtil } from '@utils/format.utils';
import { getSupplyItemDisplayName } from '@requests/utils/supply-order-format.utils';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { TranslationService } from '@services/translation.service';

/**
 * Supply Items List Component
 * Displays and manages supply items with edit/delete functionality
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-supply-items-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective
  ],
  templateUrl: './supply-items-list.component.html',
  styleUrls: ['./supply-items-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplyItemsListComponent {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Package = Package;
  readonly Plus = Plus;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;

  @Input() supplyItems: SupplyItemDisplay[] = [];
  @Input() supplyId: number = 0;
  @Input() updatingItem: boolean = false;
  @Input() deletingItem: boolean = false;
  @Output() addLotClick = new EventEmitter<void>();
  @Output() editItem = new EventEmitter<SupplyItemDisplay>();
  @Output() updateItem = new EventEmitter<SupplyItemDisplay>();
  @Output() cancelEdit = new EventEmitter<SupplyItemDisplay>();
  @Output() deleteItem = new EventEmitter<SupplyItemDisplay>();

  formatNumber = formatNumberUtil;
  formatDate = formatDateUtil;

  constructor(
    private translateService: TranslateService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) { }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  onAddLotClick(): void {
    this.addLotClick.emit();
  }

  onEditItem(item: SupplyItemDisplay): void {
    this.editItem.emit(item);
  }

  onUpdateItem(item: SupplyItemDisplay): void {
    this.updateItem.emit(item);
  }

  onCancelEdit(item: SupplyItemDisplay): void {
    this.cancelEdit.emit(item);
  }

  onDeleteItem(item: SupplyItemDisplay): void {
    this.deleteItem.emit(item);
  }

  /**
   * Calculate the maximum allowed quantity for a supply item
   * This considers the requested quantity and current total supplied quantity
   */
  getMaxAllowedQuantity(item: SupplyItemDisplay): number {
    const originalQuantity = item.originalQuantity || item.quantity;
    const currentTotalSupplied = item.totalSuppliedQuantity;
    const maxAllowed = item.requestedQuantity - (currentTotalSupplied - originalQuantity);
    return Math.max(0, maxAllowed);
  }

  getTotalQuantity(): number {
    return this.supplyItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  isPartiallyFulfilled(item: SupplyItemDisplay): boolean {
    return !item.isFullyFulfilled &&
      item.totalSuppliedQuantity > 0 &&
      item.totalSuppliedQuantity < item.requestedQuantity;
  }

  /**
   * Get localized name for a supply item display row
   */
  getSupplyItemDisplayName(item: SupplyItemDisplay): string {
    return getSupplyItemDisplayName(item, this.translateService);
  }

  /**
   * Get depot display name - Arabic when RTL, English when LTR
   */
  getDepotDisplayName(item: SupplyItemDisplay): string {
    if (!item.depotName && !item.depotNameAr && !item.depotNameEn) return '';
    return this.isRTL
      ? (item.depotNameAr || item.depotNameEn || item.depotName || '')
      : (item.depotNameEn || item.depotNameAr || item.depotName || '');
  }

  onQuantityBlur(item: SupplyItemDisplay): void {
    item.quantityError = undefined;
    this.cdr.markForCheck();
  }
}


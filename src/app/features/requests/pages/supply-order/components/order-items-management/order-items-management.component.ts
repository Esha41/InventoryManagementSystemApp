import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { OrderRequestItemDto } from '@models/order.model';
import { formatNumber as formatNumberUtil } from '@utils/format.utils';
import { getItemProductId } from '@requests/utils/supply-order-format.utils';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { TableClampTooltipDirective } from '@components/table-clamp-tooltip/table-clamp-tooltip.directive';

/**
 * Order Items Management Component
 * Displays and manages order items table with add/edit/remove functionality
 * Extracted from supply-order.component.ts following Angular best practices
 */
@Component({
  selector: 'app-order-items-management',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective,
    TableClampTooltipDirective
  ],
  templateUrl: './order-items-management.component.html',
  styleUrls: ['./order-items-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderItemsManagementComponent {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Plus = Plus;

  @Input() orderItems: OrderRequestItemDto[] = [];
  @Input() canIncreaseQuantity: boolean = false;
  @Input() canDecreaseQuantity: boolean = false;
  /** When true, omits outer card chrome (used inside supply-request-detail collapsible). */
  @Input() embedded = false;
  @Output() addItemClick = new EventEmitter<void>();
  @Output() editItemClick = new EventEmitter<OrderRequestItemDto>();
  @Output() removeItemClick = new EventEmitter<OrderRequestItemDto>();

  formatNumber = formatNumberUtil;

  onAddItemClick(): void {
    this.addItemClick.emit();
  }

  onEditItemClick(item: OrderRequestItemDto, event: Event): void {
    event.stopPropagation();
    this.editItemClick.emit(item);
  }

  onRemoveItemClick(item: OrderRequestItemDto, event: Event): void {
    event.stopPropagation();
    this.removeItemClick.emit(item);
  }

  getItemProductId(item: OrderRequestItemDto): string {
    return getItemProductId(item);
  }
}


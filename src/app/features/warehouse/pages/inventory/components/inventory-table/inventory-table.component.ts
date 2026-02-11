import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Trash2, Eye } from 'lucide-angular';
import { InventoryDetailDto } from '@models/inventory.model';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective
  ],
  templateUrl: './inventory-table.component.html',
  styleUrls: ['./inventory-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryTableComponent {
  @Input() items: InventoryDetailDto[] = [];
  @Input() isStaticItem: (detail: InventoryDetailDto) => boolean = () => false;
  @Input() getItemName: (detail: InventoryDetailDto) => string = () => '';
  @Input() getSupplierName: (detail: InventoryDetailDto) => string = () => '';
  @Input() formatNumber: (num: number) => string = () => '';
  @Input() formatDate: (date?: Date | string) => string = () => '';

  @Output() editItem = new EventEmitter<InventoryDetailDto>();
  @Output() deleteItem = new EventEmitter<InventoryDetailDto>();
  @Output() viewItem = new EventEmitter<InventoryDetailDto>();
  @Output() filterByInvoice = new EventEmitter<string>();

  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Eye = Eye;
}


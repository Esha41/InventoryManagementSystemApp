import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrderReportItem } from '@models/order-report.model';

/**
 * Component for displaying order items table
 */
@Component({
  selector: 'app-order-items-table',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './order-items-table.component.html',
  styleUrls: ['./order-items-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderItemsTableComponent {
  @Input() items: OrderReportItem[] = [];
  @Input() totalQuantity: number = 0;
}

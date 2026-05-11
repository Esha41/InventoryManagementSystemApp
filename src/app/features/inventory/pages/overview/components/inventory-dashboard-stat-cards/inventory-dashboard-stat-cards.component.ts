import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package, Layers, Boxes } from 'lucide-angular';

@Component({
  selector: 'app-inventory-dashboard-stat-cards',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './inventory-dashboard-stat-cards.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryDashboardStatCardsComponent {
  @Input({ required: true }) lowStockCount!: number;
  @Input({ required: true }) expiringSoonCount!: number;
  @Input({ required: true }) itemCount!: number;
  /** Headline `lotCount`: total inventory lots (ammo/explosive lots, excluding weapon assets). */
  @Input({ required: true }) lotCountStat!: number;
  @Input({ required: true }) batchCountStat!: number;
  @Input({ required: true }) byType!: { ammo: number; weapon: number; explosive: number };

  @Output() lowStockClick = new EventEmitter<void>();
  @Output() expiringSoonClick = new EventEmitter<void>();

  readonly Package = Package;
  readonly Layers = Layers;
  readonly Boxes = Boxes;
}

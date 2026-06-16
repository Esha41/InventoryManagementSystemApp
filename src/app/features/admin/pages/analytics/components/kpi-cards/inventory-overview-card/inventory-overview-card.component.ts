import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package } from 'lucide-angular';
import { InventoryMetrics } from '@admin/services/admin-analytics.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { Router } from '@angular/router';

interface InventoryAlertTile {
  value: (m: InventoryMetrics) => number;
  labelKey: string;
  wideOnMobile?: boolean;
  navigate: () => void;
  activeClasses: string;
  activeValueClass: string;
}

@Component({
  selector: 'app-inventory-overview-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe],
  templateUrl: './inventory-overview-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full min-h-0' }
})
export class InventoryOverviewCardComponent {
  @Input() metrics!: InventoryMetrics;

  readonly Package = Package;

  readonly alertTiles: InventoryAlertTile[] = [
    {
      value: m => m.lowStockItems ?? 0,
      labelKey: 'adminDashboard.inventory.lowStock',
      activeClasses: 'border-red-200 bg-red-50',
      activeValueClass: 'text-red-600',
      navigate: () => this.navigateToLowStock()
    },
    {
      value: m => m.criticalStockItems ?? 0,
      labelKey: 'adminDashboard.inventory.criticalStock',
      activeClasses: 'border-red-300 bg-red-50',
      activeValueClass: 'text-red-700',
      navigate: () => this.navigateToCriticalStock()
    },
    {
      value: m => m.expiringItems ?? 0,
      labelKey: 'adminDashboard.inventory.expiringSoon',
      activeClasses: 'border-orange-200 bg-orange-50',
      activeValueClass: 'text-orange-600',
      navigate: () => this.navigateToExpiring()
    },
    {
      value: m => m.pendingIssuanceRequests ?? 0,
      labelKey: 'adminDashboard.inventory.pendingIssuance',
      activeClasses: 'border-amber-200 bg-amber-50',
      activeValueClass: 'text-amber-600',
      navigate: () => this.navigateToDraftSupplies()
    },
    {
      value: m => m.ordersNotFullyFulfilled ?? 0,
      labelKey: 'adminDashboard.inventory.ordersNotFullyFulfilled',
      activeClasses: 'border-orange-200 bg-orange-50',
      activeValueClass: 'text-orange-700',
      wideOnMobile: true,
      navigate: () => this.navigateToOrdersAwaiting()
    }
  ];

  constructor(private router: Router) { }

  navigateToLowStock(): void {
    this.router.navigate(['/inventory-dashboard/low-stock']);
  }

  navigateToCriticalStock(): void {
    this.router.navigate(['/inventory-dashboard/critical-stock']);
  }

  navigateToExpiring(): void {
    this.router.navigate(['/inventory-dashboard/expiring-lots']);
  }

  navigateToDraftSupplies(): void {
    this.router.navigate(['/inventory-dashboard/draft-supplies']);
  }

  navigateToOrdersAwaiting(): void {
    this.router.navigate(['/inventory-dashboard/orders-awaiting-fulfillment']);
  }
}

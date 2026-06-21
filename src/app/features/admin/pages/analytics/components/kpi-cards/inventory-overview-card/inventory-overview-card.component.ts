import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package } from 'lucide-angular';
import { InventoryMetrics } from '@admin/services/admin-analytics.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { Router } from '@angular/router';
import { ADMIN_ANALYTICS_DASHBOARD_URL } from '@inventory/pages/overview/inventory-dashboard.data-load';

interface InventoryAlertTile {
  value: (m: InventoryMetrics) => number;
  labelKey: string;
  wideOnMobile?: boolean;
  route: string;
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
      route: 'low-stock',
      activeClasses: 'border-red-200 bg-red-50',
      activeValueClass: 'text-red-600'
    },
    {
      value: m => m.criticalStockItems ?? 0,
      labelKey: 'adminDashboard.inventory.criticalStock',
      route: 'critical-stock',
      activeClasses: 'border-red-300 bg-red-50',
      activeValueClass: 'text-red-700'
    },
    {
      value: m => m.expiringItems ?? 0,
      labelKey: 'adminDashboard.inventory.expiringSoon',
      route: 'expiring-lots',
      activeClasses: 'border-orange-200 bg-orange-50',
      activeValueClass: 'text-orange-600'
    },
    {
      value: m => m.pendingIssuanceRequests ?? 0,
      labelKey: 'adminDashboard.inventory.pendingIssuance',
      route: 'draft-supplies',
      activeClasses: 'border-amber-200 bg-amber-50',
      activeValueClass: 'text-amber-600'
    },
    {
      value: m => m.ordersNotFullyFulfilled ?? 0,
      labelKey: 'adminDashboard.inventory.ordersNotFullyFulfilled',
      route: 'orders-awaiting-fulfillment',
      activeClasses: 'border-orange-200 bg-orange-50',
      activeValueClass: 'text-orange-700',
      wideOnMobile: true
    }
  ];

  constructor(private router: Router) { }

  openReport(route: string): void {
    this.router.navigate(['/inventory-dashboard', route], {
      queryParams: { returnTo: ADMIN_ANALYTICS_DASHBOARD_URL }
    });
  }
}

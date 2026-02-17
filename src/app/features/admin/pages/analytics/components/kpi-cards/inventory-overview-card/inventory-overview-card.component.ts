import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package, TrendingDown, AlertTriangle, TrendingUp, Archive, Clock } from 'lucide-angular';
import { InventoryMetrics } from '@services/admin-analytics.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { Router } from '@angular/router';

/**
 * Inventory Overview Card Component
 * Displays inventory statistics and alerts
 */
@Component({
  selector: 'app-inventory-overview-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe],
  template: `
    <div class="flex flex-col h-full" *ngIf="metrics">
      <div class="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <lucide-icon [img]="Package" class="w-6 h-6 text-[var(--color-brand)]"></lucide-icon>
        <h3 class="text-lg font-semibold text-[var(--color-text)] m-0">{{ 'adminDashboard.inventory.title' | translate }}</h3>
      </div>

      <div class="mb-4 sm:mb-6">
        <div class="p-3 sm:p-4 rounded-lg text-center bg-blue-500/10 border border-blue-500/20 overflow-hidden">
          <div class="text-2xl sm:text-3xl font-bold text-[var(--color-text)] leading-none truncate">{{ (metrics?.totalItems || 0) | number }}</div>
          <div class="text-xs text-[var(--color-text-muted)] mt-2 truncate">{{ 'adminDashboard.inventory.totalItems' | translate }}</div>
        </div>
      </div>

      <div class="flex flex-col gap-3 flex-1 overflow-hidden">
        <div class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 min-h-[2.75rem] bg-[var(--color-background)] rounded-lg border-l-[3px] transition-all duration-200 cursor-pointer hover:shadow-md hover:bg-[var(--color-background-hover)]/50"
             (click)="navigateToLowStock()"
             [ngClass]="(metrics?.lowStockItems || 0) > 0 ? 'border-l-red-500 bg-red-500/5 hover:bg-red-500/10' : 'border-l-transparent'">
          <lucide-icon [img]="TrendingDown" class="w-6 h-6 text-[var(--color-text-muted)] flex-shrink-0" 
                       [class.text-red-500]="(metrics?.lowStockItems || 0) > 0"></lucide-icon>
          <div class="flex-1 min-w-0">
            <div class="text-xl font-bold text-[var(--color-text)] truncate" 
                 [class.text-red-500]="(metrics?.lowStockItems || 0) > 0">{{ metrics?.lowStockItems || 0 }}</div>
            <div class="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{{ 'adminDashboard.inventory.lowStock' | translate }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 min-h-[2.75rem] bg-[var(--color-background)] rounded-lg border-l-[3px] transition-all duration-200 cursor-pointer hover:shadow-md hover:bg-[var(--color-background-hover)]/50"
             (click)="navigateToExpiring()"
             [ngClass]="(metrics?.expiringItems || 0) > 0 ? 'border-l-orange-500 bg-orange-500/5 hover:bg-orange-500/10' : 'border-l-transparent'">
          <lucide-icon [img]="Clock" class="w-6 h-6 text-[var(--color-text-muted)] flex-shrink-0" 
                       [class.text-orange-500]="(metrics?.expiringItems || 0) > 0"></lucide-icon>
          <div class="flex-1 min-w-0">
            <div class="text-xl font-bold text-[var(--color-text)] truncate" 
                 [class.text-orange-500]="(metrics?.expiringItems || 0) > 0">{{ metrics?.expiringItems || 0 }}</div>
            <div class="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{{ 'adminDashboard.inventory.expiringSoon' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        {{ 'adminDashboard.lastUpdated' | translate }}: {{ metrics?.lastUpdated | appDateTime }}
      </div>
    </div>
    
    <div class="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]" *ngIf="!metrics">
      <div class="w-8 h-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin"></div>
      <p>Loading inventory metrics...</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryOverviewCardComponent {
  @Input() metrics!: InventoryMetrics;

  readonly Package = Package;
  readonly TrendingDown = TrendingDown;
  readonly AlertTriangle = AlertTriangle;
  readonly TrendingUp = TrendingUp;
  readonly Archive = Archive;
  readonly Clock = Clock;

  constructor(private router: Router) { }

  navigateToLowStock(): void {
    this.router.navigate(['/inventory-dashboard/low-stock']);
  }

  navigateToExpiring(): void {
    this.router.navigate(['/inventory-dashboard/expiring-lots']);
  }
}

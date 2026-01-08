import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package, TrendingDown, AlertTriangle, TrendingUp, Archive } from 'lucide-angular';
import { InventoryMetrics } from '@services/admin-analytics.service';

/**
 * Inventory Overview Card Component
 * Displays inventory statistics and alerts
 */
@Component({
    selector: 'app-inventory-overview-card',
    standalone: true,
    imports: [CommonModule, TranslateModule, LucideAngularModule],
    template: `
    <div class="inventory-card" *ngIf="metrics">
      <div class="card-header">
        <lucide-icon [img]="Package" class="card-icon"></lucide-icon>
        <h3 class="card-title">{{ 'adminDashboard.inventory.title' | translate }}</h3>
      </div>

      <div class="main-stats">
        <div class="stat-item primary">
          <div class="stat-value">{{ (metrics?.totalItems || 0) | number }}</div>
          <div class="stat-label">{{ 'adminDashboard.inventory.totalItems' | translate }}</div>
        </div>
        <div class="stat-item secondary">
          <div class="stat-value">{{ (metrics?.totalQuantity || 0) | number }}</div>
          <div class="stat-label">{{ 'adminDashboard.inventory.totalQuantity' | translate }}</div>
        </div>
      </div>

      <div class="alerts-grid">
        <div class="alert-item" [ngClass]="{'has-alerts': (metrics?.lowStockItems || 0) > 0}">
          <lucide-icon [img]="TrendingDown" class="alert-icon"></lucide-icon>
          <div class="alert-content">
            <div class="alert-value">{{ metrics?.lowStockItems || 0 }}</div>
            <div class="alert-label">{{ 'adminDashboard.inventory.lowStock' | translate }}</div>
          </div>
        </div>

        <div class="alert-item" [ngClass]="{'has-alerts': (metrics?.expiringSoon || 0) > 0}">
          <lucide-icon [img]="AlertTriangle" class="alert-icon"></lucide-icon>
          <div class="alert-content">
            <div class="alert-value">{{ metrics?.expiringSoon || 0 }}</div>
            <div class="alert-label">{{ 'adminDashboard.inventory.expiringSoon' | translate }}</div>
          </div>
        </div>

        <div class="alert-item" [ngClass]="{'has-alerts': (metrics?.overstockItems || 0) > 0}">
          <lucide-icon [img]="TrendingUp" class="alert-icon"></lucide-icon>
          <div class="alert-content">
            <div class="alert-value">{{ metrics?.overstockItems || 0 }}</div>
            <div class="alert-label">{{ 'adminDashboard.inventory.overstock' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="last-updated">
          {{ 'adminDashboard.lastUpdated' | translate }}: {{ metrics?.lastUpdated | date:'short' }}
        </div>
      </div>
    </div>
    <div class="loading-state" *ngIf="!metrics">
      <p>Loading inventory metrics...</p>
    </div>
  `,
    styles: [`
    .inventory-card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .card-icon {
      width: 1.5rem;
      height: 1.5rem;
      color: var(--color-primary);
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0;
    }

    .main-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-item {
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .stat-item.primary {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
    }

    .stat-item.secondary {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
    }

    .stat-value {
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.5rem;
    }

    .alerts-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex: 1;
    }

    .alert-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--color-background);
      border-radius: 8px;
      border-left: 3px solid transparent;
      transition: all 0.2s ease;
    }

    .alert-item.has-alerts {
      border-left-color: rgb(239, 68, 68);
      background: rgba(239, 68, 68, 0.05);
    }

    .alert-icon {
      width: 1.5rem;
      height: 1.5rem;
      color: var(--color-text-muted);
    }

    .alert-item.has-alerts .alert-icon {
      color: rgb(239, 68, 68);
    }

    .alert-content {
      flex: 1;
    }

    .alert-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .alert-item.has-alerts .alert-value {
      color: rgb(239, 68, 68);
    }

    .alert-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 0.125rem;
    }

    .card-footer {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
    }

    .last-updated {
      color: var(--color-text-muted);
    }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryOverviewCardComponent {
    @Input() metrics!: InventoryMetrics;

    readonly Package = Package;
    readonly TrendingDown = TrendingDown;
    readonly AlertTriangle = AlertTriangle;
    readonly TrendingUp = TrendingUp;
    readonly Archive = Archive;
}

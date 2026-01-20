import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Map } from 'lucide-angular';
import { LookupService, LookupItem } from '@services/lookup.service';
import { WarehouseSummaryDto } from '@models/warehouse.model';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-warehouse-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './warehouse-list.component.html',
  styleUrls: ['./warehouse-list.component.css']
})
export class WarehouseListComponent implements OnInit, OnDestroy {
  warehouses: WarehouseSummaryDto[] = [];
  loading = true;
  error: string | null = null;

  readonly Map = Map;

  private destroy$ = new Subject<void>();

  constructor(
    private lookupService: LookupService,
    private router: Router,
    private translateService: TranslateService
  ) { }

  ngOnInit(): void {
    this.loadWarehouses();

    // Subscribe to language changes to update warehouse names
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Re-map warehouses to update localized names
        this.warehouses = this.warehouses.map(warehouse => ({
          ...warehouse,
          name: getLocalizedName(warehouse.depot, getCurrentLang(this.translateService))
        }));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadWarehouses(): void {
    this.loading = true;
    this.error = null;

    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          // Map Depot entities to WarehouseSummaryDto structure
          this.warehouses = depots
            .filter(depot => !depot.isDeleted)
            .map(depot => this.mapDepotToWarehouse(depot));
          this.loading = false;
        },
        error: () => {
          this.translateService.get('warehouse.failedToLoad').subscribe(msg => {
            this.error = msg;
          });
          this.loading = false;
        }
      });
  }

  /**
   * Map Depot (LookupItem) to WarehouseSummaryDto
   */
  private mapDepotToWarehouse(depot: LookupItem): WarehouseSummaryDto {
    if (!depot.id) {
      throw new Error('Depot ID is required');
    }

    // Extract code from nameEn if available (e.g., "Warehouse DOH-01" -> "DOH-01")
    // If nameEn doesn't contain a code, use a default format
    const codeFromName = depot.nameEn?.match(/([A-Z]{3}-\d{2})/);
    const code =
      depot.code ||
      depot.depotCode ||
      (codeFromName ? codeFromName[1] : `DEP-${depot.id.toString().padStart(2, '0')}`);

    // TODO: Replace with actual API data when backend is ready
    // Generate dummy statistics based on warehouse code for consistency
    // This will be replaced with actual data later
    // const dummyStats = this.getDummyStatistics(depot.id, code);

    return {
      id: depot.id.toString(),
      name: getLocalizedName(depot, getCurrentLang(this.translateService)), // Use localized name
      code: code,
      // TODO: Replace with actual API data when backend is ready
      neqPercentage: 0, // dummyStats.neqPercentage,
      consumedPercentage: 0, // dummyStats.consumedPercentage,
      totalCapacity: 0, // dummyStats.totalCapacity,
      currentStock: 0, // dummyStats.currentStock,
      depot: depot // Store the full depot object for dynamic localization
    };
  }

  // TODO: Replace with actual API data when backend is ready
  /**
   * Generate dummy statistics for warehouse display
   * TODO: Replace with actual API data when backend is ready
   */
  // private getDummyStatistics(warehouseId: number, code: string): {
  //   neqPercentage: number;
  //   consumedPercentage: number;
  //   totalCapacity: number;
  //   currentStock: number;
  // } {
  //   return {
  //     neqPercentage: 0,
  //     consumedPercentage: 0,
  //     totalCapacity: 0,
  //     currentStock: 0
  //   };
  // }

  onViewWarehouse(warehouseId: string): void {
    // Navigate to warehouse inventory detail page
    this.router.navigate(['/warehouse', warehouseId, 'inventory']);
  }

  refreshWarehouses(): void {
    this.loadWarehouses();
  }

  onViewOnMap(): void {

    if (this.warehouses.length > 0) {
      const firstWarehouseId = this.warehouses[0].id;
      this.router.navigate(['/warehouse', firstWarehouseId, 'inventory', '0', 'map']);
    }
  }
}

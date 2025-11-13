import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { LookupService, LookupItem } from '@services/lookup.service';
import { WarehouseSummaryDto } from '@models/warehouse.model';

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule],
  templateUrl: './warehouse.component.html',
  styleUrls: ['./warehouse.component.css']
})
export class WarehouseComponent implements OnInit, OnDestroy {
  warehouses: WarehouseSummaryDto[] = [];
  loading = true;
  error: string | null = null;

  readonly Eye = Eye;

  private destroy$ = new Subject<void>();

  constructor(
    private lookupService: LookupService,
    private router: Router,
    private translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
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
        error: (error) => {
          console.error('Error loading depots:', error);
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

    // Extract code from nameEn (e.g., "Warehouse DOH-01" -> "DOH-01")
    // If nameEn doesn't contain a code, use a default format
    const codeFromName = depot.nameEn.match(/([A-Z]{3}-\d{2})/);
    const code =
      depot.code ||
      depot.depotCode ||
      (codeFromName ? codeFromName[1] : `DEP-${depot.id.toString().padStart(2, '0')}`);

    return {
      id: depot.id.toString(),
      name: depot.nameEn,
      code: code,
      // TODO: Calculate these from actual inventory data
      neqPercentage: 0,
      consumedPercentage: 0,
      totalCapacity: 0,
      currentStock: 0
    };
  }

  onViewWarehouse(warehouseId: string): void {
    // Navigate to warehouse inventory detail page
    this.router.navigate(['/warehouse', warehouseId, 'inventory']);
  }

  refreshWarehouses(): void {
    this.loadWarehouses();
  }
}

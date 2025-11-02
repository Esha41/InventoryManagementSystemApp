import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Eye } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { DepotDto } from '@models/depot.model';
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
    private router: Router
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
          // Keep static values for NEQ, Consumed, Total Capacity, Current Stock as requested
          this.warehouses = depots
            .filter(depot => !depot.isDeleted)
            .map(depot => this.mapDepotToWarehouse(depot));
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading depots:', error);
          this.error = 'Failed to load warehouses. Please try again.';
          this.loading = false;
        }
      });
  }

  /**
   * Map DepotDto to WarehouseSummaryDto
   * Static values are kept for NEQ, Consumed, Total Capacity, Current Stock as requested
   */
  private mapDepotToWarehouse(depot: DepotDto): WarehouseSummaryDto {
    // Extract code from nameEn (e.g., "Warehouse DOH-01" -> "DOH-01")
    // If nameEn doesn't contain a code, use a default format
    const codeMatch = depot.nameEn.match(/([A-Z]{3}-\d{2})/);
    const code = codeMatch ? codeMatch[1] : `DEP-${depot.id.toString().padStart(2, '0')}`;

    return {
      id: depot.id.toString(),
      name: depot.nameEn,
      code: code,
      // Static values as requested - these will be replaced with real data later
      neqPercentage: 90,
      consumedPercentage: 95,
      totalCapacity: 10000,
      currentStock: 9500
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

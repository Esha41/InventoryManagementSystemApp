import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { DepotDto } from '@models/depot.model';
import { WarehouseLocationDto } from '@models/warehouse.model';

@Component({
  selector: 'app-warehouse-map',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './warehouse-map.component.html',
  styleUrls: ['./warehouse-map.component.css']
})
export class WarehouseMapComponent implements OnInit, OnDestroy {
  warehouseId: string = '';
  itemId: string = '';
  loading = true;
  
  readonly ArrowLeft = ArrowLeft;

  warehouses: WarehouseLocationDto[] = [];
  selectedWarehouse: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private lookupService: LookupService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.warehouseId = params['warehouseId'];
      this.itemId = params['itemId'];
      this.loadWarehouseLocations();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadWarehouseLocations(): void {
    this.loading = true;
    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots: DepotDto[]) => {
          // Map depots to warehouse locations
          this.warehouses = depots
            .filter(depot => !depot.isDeleted)
            .map(depot => this.mapDepotToWarehouseLocation(depot));
          
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Failed to load warehouse locations:', error);
          this.loading = false;
        }
      });
  }

  /**
   * Map Depot to WarehouseLocationDto
   */
  private mapDepotToWarehouseLocation(depot: DepotDto): WarehouseLocationDto {
    // Extract code from nameEn if available, or generate from ID
    const codeMatch = depot.nameEn.match(/([A-Z]{3}-\d{2})/);
    const code = codeMatch ? codeMatch[1] : `DEP-${depot.id.toString().padStart(2, '0')}`;

    // Determine color based on NEQ or other criteria (default to green)
    let color: 'green' | 'orange' | 'red' = 'green';
    
    // Calculate map position from latitude/longitude if available
    // For now, use fallback positions based on depot ID
    const mapPosition = this.getMapPositionForDepot(depot.id);

    return {
      id: depot.id.toString(),
      name: depot.nameEn,
      code: code,
      location: depot.location || depot.nameEn,
      latitude: depot.latitude || 0,
      longitude: depot.longitude || 0,
      mapPosition: mapPosition,
      color: color,
      isActive: !depot.isDeleted
    };
  }

  /**
   * Get map position for a depot
   * Uses latitude/longitude if available, otherwise calculates from depot ID
   */
  private getMapPositionForDepot(depotId: number): { top: string; left: string } {
    // Default positions for first few depots
    // In production, this should be calculated from actual latitude/longitude
    const defaultPositions: { [key: number]: { top: string; left: string } } = {
      1: { top: '15%', left: '65%' },
      2: { top: '28%', left: '58%' },
      3: { top: '85%', left: '55%' }
    };
    
    return defaultPositions[depotId] || { top: '50%', left: '50%' };
  }

  onBack(): void {
    this.router.navigate(['/warehouse', this.warehouseId, 'inventory', this.itemId]);
  }

  selectWarehouse(warehouseId: string): void {
    this.selectedWarehouse = warehouseId;
  }

  /**
   * Get the currently selected warehouse object
   */
  getSelectedWarehouse(): WarehouseLocationDto | undefined {
    if (!this.selectedWarehouse) return undefined;
    return this.warehouses.find(w => w.id === this.selectedWarehouse);
  }
}


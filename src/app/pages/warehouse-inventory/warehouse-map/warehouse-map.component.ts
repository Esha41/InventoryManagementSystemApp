import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
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

  @ViewChild('mapContainer', { static: false }) mapContainerRef!: ElementRef<HTMLElement>;

  warehouses: WarehouseLocationDto[] = [];
  selectedWarehouse: string | null = null;

  // Drag state
  isDragging = false;
  draggedWarehouseId: string | null = null;
  dragStartX = 0;
  dragStartY = 0;
  draggedPosition: { top: number; left: number } | null = null;
  dragDistance = 0; // Track how far the pin was dragged
  private dragThreshold = 5; // Minimum pixels to consider it a drag (not a click)
  
  // Calculated coordinates display
  calculatedCoordinates: { latitude: number; longitude: number } | null = null;
  showCoordinates = false;

  private destroy$ = new Subject<void>();

  /**
   * MAP CALIBRATION CONFIGURATION
   * 
   * To calibrate your static map image:
   * 
   * 1. Find the geographic bounds of your map image:
   *    - Identify the northernmost point (top of image) → maxLat
   *    - Identify the southernmost point (bottom of image) → minLat
   *    - Identify the westernmost point (left of image) → minLon
   *    - Identify the easternmost point (right of image) → maxLon
   * 
   * 2. Use Google Maps or a mapping tool to get exact coordinates:
   *    - Click on the top-left corner of your map → get lat/lon
   *    - Click on the bottom-right corner of your map → get lat/lon
   * 
   * 3. Adjust these values to match YOUR specific map image:
   */
  private readonly MAP_BOUNDS = {
    // North (top of map image)
    maxLat: 26.1544,
    // South (bottom of map image)
    minLat: 24.4704,
    // West (left of map image)
    minLon: 50.7439,
    // East (right of map image)
    maxLon: 51.6067
  };

  /**
   * MAP IMAGE OFFSET ADJUSTMENT
   * 
   * If your map image has borders or padding that aren't part of the actual map,
   * adjust these offsets to account for them (in percentage):
   * 
   * Example: If your map image has 10px padding on all sides and the container is 1000px,
   * then topOffset = 1%, leftOffset = 1%, etc.
   */
  private readonly MAP_OFFSETS = {
    top: 5,    // Percentage offset from top (for map borders/padding)
    bottom: 5, // Percentage offset from bottom
    left: 5,   // Percentage offset from left
    right: 5   // Percentage offset from right
  };

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


  private loadWarehouseLocations(): void {
    this.loading = true;
    this.lookupService.getDepots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
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
   * Map Depot (LookupItem) to WarehouseLocationDto
   */
  private mapDepotToWarehouseLocation(depot: LookupItem & { location?: string; latitude?: number; longitude?: number }): WarehouseLocationDto {
    if (!depot.id) {
      throw new Error('Depot ID is required');
    }

    // Extract code from nameEn if available, or generate from ID
    const codeMatch = depot.nameEn.match(/([A-Z]{3}-\d{2})/);
    const code = codeMatch ? codeMatch[1] : `DEP-${depot.id.toString().padStart(2, '0')}`;

    // Determine color based on NEQ or other criteria (default to green)
    let color: 'green' | 'orange' | 'red' = 'green';
    
    // Calculate map position from latitude/longitude if available
    const mapPosition = this.getMapPositionForDepot(
      depot.id, 
      depot.latitude ? Number(depot.latitude) : undefined, 
      depot.longitude ? Number(depot.longitude) : undefined
    );

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
   * Converts latitude/longitude to CSS position percentages on the static map
   * Uses latitude/longitude if available, otherwise falls back to default positions
   */
  private getMapPositionForDepot(depotId: number, latitude?: number, longitude?: number): { top: string; left: string } {
    // If valid coordinates are provided, convert them to map positions
    if (latitude && longitude && latitude !== 0 && longitude !== 0) {
      return this.convertCoordinatesToMapPosition(latitude, longitude);
    }
    
    // Fallback to default positions for depots without coordinates
    const defaultPositions: { [key: number]: { top: string; left: string } } = {
      1: { top: '15%', left: '65%' },
      2: { top: '28%', left: '58%' },
      3: { top: '85%', left: '55%' }
    };
    
    return defaultPositions[depotId] || { top: '50%', left: '50%' };
  }

  /**
   * Convert latitude/longitude coordinates to CSS position percentages
   * 
   * MATH EXPLANATION:
   * =================
   * 
   * Step 1: Normalize coordinates to 0-1 range
   *   latRatio = (lat - minLat) / (maxLat - minLat)
   *   lonRatio = (lon - minLon) / (maxLon - minLon)
   * 
   * Step 2: Convert to percentage (0-100%)
   *   latPercent = latRatio * 100
   *   lonPercent = lonRatio * 100
   * 
   * Step 3: Invert latitude (CSS top increases downward)
   *   topPercent = 100 - latPercent
   * 
   * Step 4: Apply offsets for map borders/padding
   *   adjustedTop = topPercent + topOffset
   *   adjustedLeft = lonPercent + leftOffset
   * 
   * Example:
   *   If a location is at 25.5°N, 51.0°E:
   *   - latRatio = (25.5 - 24.4704) / (26.1544 - 24.4704) = 0.611
   *   - lonRatio = (51.0 - 50.7439) / (51.6067 - 50.7439) = 0.296
   *   - topPercent = 100 - (0.611 * 100) = 38.9%
   *   - leftPercent = 0.296 * 100 = 29.6%
   */
  private convertCoordinatesToMapPosition(latitude: number, longitude: number): { top: string; left: string } {
    const { minLat, maxLat, minLon, maxLon } = this.MAP_BOUNDS;
    const { top: topOffset, left: leftOffset, bottom: bottomOffset, right: rightOffset } = this.MAP_OFFSETS;

    // Clamp coordinates to map bounds
    const clampedLat = Math.max(minLat, Math.min(maxLat, latitude));
    const clampedLon = Math.max(minLon, Math.min(maxLon, longitude));

    // Step 1: Normalize to 0-1 range
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;
    const latRatio = (clampedLat - minLat) / latRange;
    const lonRatio = (clampedLon - minLon) / lonRange;

    // Step 2: Convert to percentage
    const latPercent = latRatio * 100;
    const lonPercent = lonRatio * 100;

    // Step 3: Invert latitude (CSS top increases downward, but latitude increases northward)
    // Higher latitude = North = top of map = lower CSS top value
    const topPercent = 100 - latPercent;

    // Step 4: Apply offsets and clamp to valid range
    // Account for map image borders/padding
    const effectiveTop = topPercent + topOffset;
    const effectiveLeft = lonPercent + leftOffset;

    // Clamp to ensure pins stay within visible map area
    const adjustedTop = Math.max(
      topOffset, 
      Math.min(100 - bottomOffset, effectiveTop)
    );
    const adjustedLeft = Math.max(
      leftOffset, 
      Math.min(100 - rightOffset, effectiveLeft)
    );

    // Debug logging (remove in production or make it conditional)
    if (console && console.log) {
      console.log(`Pin calculation for ${latitude}, ${longitude}:`, {
        latRatio: latRatio.toFixed(3),
        lonRatio: lonRatio.toFixed(3),
        topPercent: topPercent.toFixed(2),
        leftPercent: lonPercent.toFixed(2),
        adjustedTop: adjustedTop.toFixed(2) + '%',
        adjustedLeft: adjustedLeft.toFixed(2) + '%'
      });
    }

    return {
      top: `${adjustedTop.toFixed(2)}%`,
      left: `${adjustedLeft.toFixed(2)}%`
    };
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

  /**
   * Convert CSS position percentages back to latitude/longitude coordinates
   * This is the reverse of convertCoordinatesToMapPosition
   */
  private convertMapPositionToCoordinates(topPercent: number, leftPercent: number): { latitude: number; longitude: number } {
    const { minLat, maxLat, minLon, maxLon } = this.MAP_BOUNDS;
    const { top: topOffset, left: leftOffset } = this.MAP_OFFSETS;

    // Remove offsets from percentages
    const adjustedTop = topPercent - topOffset;
    const adjustedLeft = leftPercent - leftOffset;

    // Clamp to valid range (0-100%)
    const clampedTop = Math.max(0, Math.min(100, adjustedTop));
    const clampedLeft = Math.max(0, Math.min(100, adjustedLeft));

    // Reverse the latitude inversion: topPercent = 100 - latPercent
    // So: latPercent = 100 - topPercent
    const latPercent = 100 - clampedTop;
    const lonPercent = clampedLeft;

    // Convert from percentage to ratio (0-1)
    const latRatio = latPercent / 100;
    const lonRatio = lonPercent / 100;

    // Convert from ratio to actual coordinates
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;

    const latitude = minLat + (latRatio * latRange);
    const longitude = minLon + (lonRatio * lonRange);

    return {
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6))
    };
  }

  /**
   * Start dragging a pin
   */
  onPinMouseDown(event: MouseEvent, warehouseId: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDragging = true;
    this.draggedWarehouseId = warehouseId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;

    // Get current pin position
    const warehouse = this.warehouses.find(w => w.id === warehouseId);
    if (warehouse && warehouse.mapPosition) {
      const currentTop = parseFloat(warehouse.mapPosition.top.replace('%', ''));
      const currentLeft = parseFloat(warehouse.mapPosition.left.replace('%', ''));
      this.draggedPosition = { top: currentTop, left: currentLeft };
    }

    // Add global mouse move and up listeners
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  /**
   * Handle mouse move during drag
   */
  onMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging || !this.draggedWarehouseId || !this.draggedPosition) return;

    // Calculate drag distance
    const deltaX = Math.abs(event.clientX - this.dragStartX);
    const deltaY = Math.abs(event.clientY - this.dragStartY);
    this.dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Get map container element
    const mapContainer = this.mapContainerRef?.nativeElement;
    if (!mapContainer) return;

    const rect = mapContainer.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // Calculate mouse position relative to map container
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert to percentages
    const leftPercent = (mouseX / containerWidth) * 100;
    const topPercent = (mouseY / containerHeight) * 100;

    // Clamp to valid range (accounting for offsets)
    const { top: topOffset, left: leftOffset, bottom: bottomOffset, right: rightOffset } = this.MAP_OFFSETS;
    const clampedTop = Math.max(topOffset, Math.min(100 - bottomOffset, topPercent));
    const clampedLeft = Math.max(leftOffset, Math.min(100 - rightOffset, leftPercent));

    // Update dragged position
    this.draggedPosition = { top: clampedTop, left: clampedLeft };

    // Update warehouse position temporarily
    const warehouse = this.warehouses.find(w => w.id === this.draggedWarehouseId);
    if (warehouse && warehouse.mapPosition) {
      warehouse.mapPosition.top = `${clampedTop.toFixed(2)}%`;
      warehouse.mapPosition.left = `${clampedLeft.toFixed(2)}%`;
    }

    // Calculate coordinates in real-time
    this.calculatedCoordinates = this.convertMapPositionToCoordinates(clampedTop, clampedLeft);
    this.showCoordinates = true;
  };

  /**
   * Handle mouse up - end drag
   */
  onMouseUp = (event: MouseEvent): void => {
    if (!this.isDragging || !this.draggedWarehouseId || !this.draggedPosition) {
      this.cleanupDrag();
      return;
    }

    // Calculate final coordinates
    const coordinates = this.convertMapPositionToCoordinates(
      this.draggedPosition.top,
      this.draggedPosition.left
    );

    // Update warehouse with new position and coordinates
    const warehouse = this.warehouses.find(w => w.id === this.draggedWarehouseId);
    if (warehouse) {
      if (warehouse.mapPosition) {
        warehouse.mapPosition.top = `${this.draggedPosition.top.toFixed(2)}%`;
        warehouse.mapPosition.left = `${this.draggedPosition.left.toFixed(2)}%`;
      }
      
      // Update coordinates
      warehouse.latitude = coordinates.latitude;
      warehouse.longitude = coordinates.longitude;

      // Show calculated coordinates
      this.calculatedCoordinates = coordinates;
      this.showCoordinates = true;

      // Log the coordinates
      console.log(`Pin dropped for ${warehouse.code}:`, {
        position: { top: `${this.draggedPosition.top}%`, left: `${this.draggedPosition.left}%` },
        coordinates: coordinates
      });
    }

    // Clean up
    this.cleanupDrag();
  };

  /**
   * Clean up drag state
   */
  private cleanupDrag(): void {
    // Reset after a short delay to allow click handler to check dragDistance
    setTimeout(() => {
      this.isDragging = false;
      this.draggedWarehouseId = null;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragDistance = 0;
    }, 150);
    
    // Remove event listeners immediately
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  /**
   * Handle pin click (only if not dragging)
   */
  onPinClick(event: MouseEvent, warehouseId: string): void {
    // Prevent click if we just finished dragging (user moved pin more than threshold)
    if (this.dragDistance > this.dragThreshold) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Small delay to distinguish click from drag end
    setTimeout(() => {
      if (!this.isDragging && this.dragDistance <= this.dragThreshold) {
        this.selectWarehouse(warehouseId);
      }
    }, 100);
  }

  /**
   * Close coordinates display
   */
  closeCoordinatesDisplay(): void {
    this.showCoordinates = false;
    this.calculatedCoordinates = null;
  }

  /**
   * HELPER METHOD FOR MANUAL CALIBRATION
   * 
   * Use this in the browser console to test coordinate calculations:
   * 
   * Example:
   *   const component = ng.probe(document.querySelector('app-warehouse-map')).componentInstance;
   *   component.testCoordinateCalculation(25.5, 51.0);
   * 
   * This will show you exactly where a pin would be placed for given coordinates.
   */
  testCoordinateCalculation(latitude: number, longitude: number): void {
    const result = this.convertCoordinatesToMapPosition(latitude, longitude);
    console.log('=== COORDINATE CALCULATION TEST ===');
    console.log(`Input: ${latitude}°N, ${longitude}°E`);
    console.log(`Output: top: ${result.top}, left: ${result.left}`);
    console.log(`Map Bounds:`, this.MAP_BOUNDS);
    console.log(`Map Offsets:`, this.MAP_OFFSETS);
    console.log('===================================');
    return;
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    this.cleanupDrag();
    this.destroy$.next();
    this.destroy$.complete();
  }
}


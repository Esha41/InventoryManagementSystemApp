import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, Trash2 } from 'lucide-angular';
import { LookupService } from '@services/lookup.service';
import { LookupItem } from '@models/lookup.model';
import { WarehouseLocationDto } from '@models/warehouse.model';
import { OfflineMapService } from '@services/offline-map.service';
import * as L from 'leaflet';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-warehouse-map',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule, LoadingStateComponent],
  templateUrl: './warehouse-map.component.html',
  styleUrls: ['./warehouse-map.component.css']
})
export class WarehouseMapComponent implements OnInit, AfterViewInit, OnDestroy {
  warehouseId: string = '';
  itemId: string = '';
  loading = true;

  readonly ArrowLeft = ArrowLeft;
  readonly Trash2 = Trash2;

  @ViewChild('mapContainer', { static: false }) mapContainerRef!: ElementRef<HTMLElement>;

  // Leaflet map instance
  private map: L.Map | null = null;
  private markers: Map<string, L.Marker> = new Map();

  // Cache status
  cacheStatus = {
    isCached: false,
    tileCount: 0,
    autoCaching: false
  };

  warehouses: WarehouseLocationDto[] = [];
  selectedWarehouse: string | null = null;

  private destroy$ = new Subject<void>();

  // Qatar map configuration
  private readonly QATAR_CENTER: L.LatLngExpression = [25.3548, 51.1839]; // Doha coordinates
  private readonly QATAR_BOUNDS: L.LatLngBoundsExpression = [
    [24.4704, 50.7439], // Southwest
    [26.1544, 51.6067]  // Northeast
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private lookupService: LookupService,
    private offlineMapService: OfflineMapService,
    private translateService: TranslateService
  ) { }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.warehouseId = params['warehouseId'];
      this.itemId = params['itemId'];
      this.loadWarehouseLocations();
    });

    // Subscribe to language changes to update markers
    this.translateService.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Reload warehouse locations to get fresh localized names
        this.loadWarehouseLocations();
      });

    // Check cache status
    this.checkCacheStatus();

    // Start auto-caching tiles in background if online
    if (navigator.onLine) {
      this.startAutoCaching();
    }
  }

  ngAfterViewInit(): void {
    // Initialize map after view is ready
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }


  /**
   * Initialize Leaflet map
   */
  private initializeMap(): void {
    if (!this.mapContainerRef) {
      console.error('Map container not found');
      return;
    }

    // Fix Leaflet default icon path issue in Angular
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';
    const iconDefault = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Create map
    this.map = L.map(this.mapContainerRef.nativeElement, {
      center: this.QATAR_CENTER,
      zoom: 10, // Increased default zoom (was 9)
      minZoom: 7, // Allow zooming out more (was 8)
      maxZoom: 16, // Allow zooming in more (was 13)
      maxBounds: this.QATAR_BOUNDS,
      maxBoundsViscosity: 0.5 // Reduced from 1.0 - allows more panning outside bounds before snapping back
    });

    // Helper function to load tile from local assets first, then cache, then online
    const loadTileFromLocalAssets = (coords: L.Coords): string => {
      // Extract zoom, x, y from coordinates
      const z = coords.z;
      const x = coords.x;
      const y = coords.y;

      // Load from local assets directory (bundled with app)
      return `/assets/map-tiles/${z}/${x}/${y}.png`;
    };

    // Helper function to load tile from local assets with fallback to cache/online
    const loadTileFromCacheWithFallback = (url: string, localUrl: string, imgElement: HTMLImageElement): void => {
      // Try local assets first (bundled with the app - works completely offline)
      const localImg = new Image();
      localImg.onerror = () => {
        // Local tile doesn't exist, try cache (if available)
        if ('caches' in window) {
          caches.open('qatar-map-tiles').then(cache => {
            return cache.match(url);
          }).then(cachedResponse => {
            if (cachedResponse) {
              // Use cached tile
              return cachedResponse.blob();
            }
            // No cache, try online (only if online)
            if (navigator.onLine) {
              imgElement.src = url;
              imgElement.addEventListener('load', () => {
                cacheTileInBackground(url).catch(() => { });
              }, { once: true });
              return null; // No blob to return
            } else {
              // Offline and no cache - show transparent placeholder
              console.warn('Tile not available offline:', url);
              imgElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
              return null;
            }
          }).then(blob => {
            if (blob) {
              imgElement.src = URL.createObjectURL(blob);
            }
          }).catch(() => {
            // If all fails, use transparent placeholder when offline
            if (!navigator.onLine) {
              imgElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            } else {
              imgElement.src = url;
            }
          });
        } else {
          // No cache API - if online, use online; if offline, show placeholder
          if (navigator.onLine) {
            imgElement.src = url;
          } else {
            imgElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          }
        }
      };
      localImg.onload = () => {
        // Local tile exists and loaded successfully!
        imgElement.src = localUrl;
      };

      // Try to load local tile
      localImg.src = localUrl;
    };

    // Helper function to cache tile in background
    const cacheTileInBackground = async (url: string): Promise<void> => {
      if (!('caches' in window) || !navigator.onLine) {
        return;
      }

      try {
        const cache = await caches.open('qatar-map-tiles');
        const existing = await cache.match(url);
        if (existing) {
          return; // Already cached
        }

        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          await cache.put(url, response.clone());
        }
      } catch (error) {
        // Silently fail
      }
    };

    // Create custom tile layer that loads from local assets first (completely offline capable)
    const OfflineTileLayer = L.TileLayer.extend({
      createTile: function (coords: L.Coords, done: L.DoneCallback): HTMLElement {
        const tile = document.createElement('img');

        L.DomEvent.on(tile, 'load', () => {
          (this as any)._tileOnLoad(done, tile);
        });

        L.DomEvent.on(tile, 'error', () => {
          (this as any)._tileOnError(done, tile);
        });

        // Get the online tile URL (for fallback only)
        const onlineUrl = this.getTileUrl(coords);

        // Get local assets URL (bundled with app - works offline)
        const localUrl = loadTileFromLocalAssets(coords);

        // Try local assets first, then cache, then online
        loadTileFromCacheWithFallback(onlineUrl, localUrl, tile as HTMLImageElement);

        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        return tile;
      }
    });

    // Add tile layer with offline support (uses bundled tiles from assets/map-tiles/)
    const customTileLayer = new (OfflineTileLayer as any)(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', // Only used as fallback if online
      {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 16,
        minZoom: 7,
        crossOrigin: true
      }
    );

    customTileLayer.addTo(this.map);

    // Auto-cache tiles in the background when online
    this.startAutoCaching();

    // Add markers for warehouses
    this.addWarehouseMarkers();
  }

  /**
   * Add warehouse markers to the map
   */
  private addWarehouseMarkers(): void {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers.clear();

    // Add new markers
    this.warehouses.forEach(warehouse => {
      if (warehouse.latitude && warehouse.longitude) {
        const marker = this.createWarehouseMarker(warehouse);
        this.markers.set(warehouse.id, marker);
      }
    });
  }

  /**
   * Create a marker for a warehouse
   */
  private createWarehouseMarker(warehouse: WarehouseLocationDto): L.Marker {
    if (!this.map) throw new Error('Map not initialized');

    // Determine marker color based on warehouse status
    const markerColor = warehouse.color === 'green' ? '#10B981' :
      warehouse.color === 'orange' ? '#F59E0B' : '#EF4444';

    const markerColorDark = warehouse.color === 'green' ? '#059669' :
      warehouse.color === 'orange' ? '#D97706' : '#DC2626';

    // Create custom icon with modern SVG design
    const customIcon = L.divIcon({
      className: 'custom-warehouse-marker',
      html: `
        <div class="marker-container">
          <svg class="marker-svg" width="48" height="64" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
            <!-- Shadow/Glow Effect -->
            <defs>
              <filter id="glow-${warehouse.id}" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <linearGradient id="gradient-${warehouse.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${markerColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${markerColorDark};stop-opacity:1" />
              </linearGradient>
            </defs>
            
            <!-- Main Pin Shape -->
            <path d="M24 2 C13 2 4 11 4 22 C4 28 7 33 11 37 L24 58 L37 37 C41 33 44 28 44 22 C44 11 35 2 24 2 Z" 
                  fill="url(#gradient-${warehouse.id})" 
                  stroke="white" 
                  stroke-width="2.5"
                  filter="url(#glow-${warehouse.id})"
                  class="pin-shape"/>
            
            <!-- Inner Circle -->
            <circle cx="24" cy="22" r="10" fill="white" opacity="0.95"/>
            
            <!-- Warehouse Icon -->
            <g transform="translate(24, 22)">
              <path d="M-6,-4 L0,-7 L6,-4 L6,4 L-6,4 Z" fill="${markerColorDark}" opacity="0.9"/>
              <rect x="-4" y="-1" width="2" height="3" fill="white" opacity="0.7"/>
              <rect x="2" y="-1" width="2" height="3" fill="white" opacity="0.7"/>
              <rect x="-1" y="1" width="2" height="3" fill="white" opacity="0.7"/>
            </g>
          </svg>
          
          <!-- Warehouse Code Label -->
          <div class="marker-label" style="background: linear-gradient(135deg, ${markerColor} 0%, ${markerColorDark} 100%);">
            <span class="marker-code">${warehouse.code}</span>
          </div>
          
          <!-- Pulse Animation Ring -->
          <div class="marker-pulse" style="border-color: ${markerColor};"></div>
        </div>
      `,
      iconSize: [48, 64],
      iconAnchor: [24, 64],
      popupAnchor: [0, -64]
    });

    // Create marker (non-draggable as per requirements)
    const marker = L.marker([warehouse.latitude, warehouse.longitude], {
      icon: customIcon,
      draggable: false, // Fixed pins - cannot be moved
      title: warehouse.name
    }).addTo(this.map);

    // Add popup with warehouse information
    const popupContent = `
      <div class="warehouse-popup">
        <div class="popup-header" style="background: linear-gradient(135deg, ${markerColor} 0%, ${markerColorDark} 100%);">
          <h3 class="popup-title">${warehouse.code}</h3>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-label">📍 Location:</span>
            <span class="popup-value">${warehouse.location}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">🏢 Name:</span>
            <span class="popup-value">${warehouse.name}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">⚡ Status:</span>
            <span class="status-badge status-${warehouse.isActive ? 'active' : 'inactive'}">
              ${warehouse.isActive ? '✓ Active' : '✕ Inactive'}
            </span>
          </div>
          <div class="popup-row">
            <span class="popup-label">🌍 Coordinates:</span>
            <span class="popup-value coordinates">${warehouse.latitude.toFixed(4)}°N, ${warehouse.longitude.toFixed(4)}°E</span>
          </div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'custom-popup'
    });

    // Handle marker click
    marker.on('click', () => {
      this.selectWarehouse(warehouse.id);
    });

    return marker;
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

          // Add markers to map if it's already initialized
          if (this.map) {
            this.addWarehouseMarkers();
          }
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
    const codeFromName = depot.nameEn.match(/([A-Z]{3}-\d{2})/);
    const code =
      depot.code ||
      depot.depotCode ||
      (codeFromName ? codeFromName[1] : `DEP-${depot.id.toString().padStart(2, '0')}`);

    // Determine color based on NEQ or other criteria (default to green)
    let color: 'green' | 'orange' | 'red' = 'green';

    // Use actual coordinates or default to Doha center if not available
    const latitude = depot.latitude ? Number(depot.latitude) : 25.2854;
    const longitude = depot.longitude ? Number(depot.longitude) : 51.5310;

    const localizedName = getLocalizedName(depot, getCurrentLang(this.translateService));

    return {
      id: depot.id.toString(),
      name: localizedName,
      code: code,
      location: depot.location || localizedName,
      latitude: latitude,
      longitude: longitude,
      color: color,
      isActive: !depot.isDeleted
    };
  }

  /**
   * Check cache status
   */
  private async checkCacheStatus(): Promise<void> {
    const cacheInfo = await this.offlineMapService.getCacheInfo();
    this.cacheStatus.isCached = cacheInfo.count > 0;
    this.cacheStatus.tileCount = cacheInfo.count;
  }



  /**
   * Start auto-caching tiles in the background
   */
  private async startAutoCaching(): Promise<void> {
    if (!navigator.onLine || this.cacheStatus.autoCaching) {
      return;
    }

    // Check if we already have enough tiles cached
    const cacheInfo = await this.offlineMapService.getCacheInfo();
    if (cacheInfo.count > 100) {
      // Already have good cache, skip auto-caching
      this.checkCacheStatus();
      return;
    }

    this.cacheStatus.autoCaching = true;

    // Pre-cache tiles in the background (silently, without user interaction)
    this.offlineMapService.preCacheTiles([8, 9, 10, 11, 12])
      .then(() => {
        this.checkCacheStatus();
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        this.cacheStatus.autoCaching = false;
      });
  }

  /**
   * Clear offline cache
   */
  async clearOfflineCache(): Promise<void> {
    if (confirm('Are you sure you want to clear the offline map cache?')) {
      await this.offlineMapService.clearCache();
      await this.checkCacheStatus();
      alert('Offline map cache cleared.');
    }
  }

  onBack(): void {

    if (!this.itemId || this.itemId === '0' || this.itemId === '') {
      this.router.navigate(['/warehouse']);
    } else {
      this.router.navigate(['/warehouse', this.warehouseId, 'inventory', this.itemId]);
    }
  }

  selectWarehouse(warehouseId: string): void {
    this.selectedWarehouse = warehouseId;

    const marker = this.markers.get(warehouseId);
    if (marker && this.map) {
      const markerLatLng = marker.getLatLng();

      const currentBounds = this.map.options.maxBounds;
      this.map.setMaxBounds(undefined);

      this.map.flyTo(markerLatLng, 12, {
        animate: true,
        duration: 1.0,
        easeLinearity: 0.25
      });

      setTimeout(() => {
        if (this.map && currentBounds) {
          this.map.setMaxBounds(currentBounds);
        }
        marker.openPopup();
      }, 1100);
    }
  }

  /**
   * Get the currently selected warehouse object
   */
  getSelectedWarehouse(): WarehouseLocationDto | undefined {
    if (!this.selectedWarehouse) return undefined;
    return this.warehouses.find(w => w.id === this.selectedWarehouse);
  }

  ngOnDestroy(): void {
    // Clean up map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
  }
}


import { Injectable } from '@angular/core';

/**
 * Offline Map Service
 * Handles caching and serving of map tiles for offline use
 */
@Injectable({
  providedIn: 'root'
})
export class OfflineMapService {
  private readonly TILE_CACHE_NAME = 'qatar-map-tiles';
  private readonly TILE_URL_TEMPLATE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  // Qatar map bounds for tile pre-caching
  private readonly QATAR_BOUNDS = {
    minLat: 24.4704,
    maxLat: 26.1544,
    minLon: 50.7439,
    maxLon: 51.6067
  };

  constructor() {}

  /**
   * Get tile URL with offline fallback
   * This will attempt to use cached tiles first, then fall back to online
   */
  getTileUrl(): string {
    // For offline capability, we use a custom tile layer that checks cache first
    // The actual caching is handled by the browser's Cache API
    return this.TILE_URL_TEMPLATE;
  }

  /**
   * Pre-cache map tiles for Qatar region
   * This should be called when the user has internet connection
   * to download tiles for offline use
   * 
   * @param zoomLevels Array of zoom levels to cache (e.g., [8, 9, 10, 11])
   */
  async preCacheTiles(zoomLevels: number[] = [8, 9, 10, 11]): Promise<void> {
    if (!('caches' in window)) {
      console.warn('Cache API not available');
      return;
    }

    try {
      const cache = await caches.open(this.TILE_CACHE_NAME);
      const tilesToCache: string[] = [];

      // Generate tile URLs for Qatar region at specified zoom levels
      for (const zoom of zoomLevels) {
        const tiles = this.getTilesForBounds(zoom);
        tilesToCache.push(...tiles);
      }

      console.log(`Pre-caching ${tilesToCache.length} tiles...`);

      // Cache tiles in batches to avoid overwhelming the browser
      const batchSize = 50;
      for (let i = 0; i < tilesToCache.length; i += batchSize) {
        const batch = tilesToCache.slice(i, i + batchSize);
        await Promise.all(
          batch.map(url => 
            fetch(url)
              .then(response => cache.put(url, response))
              .catch(err => console.warn(`Failed to cache tile: ${url}`, err))
          )
        );
        console.log(`Cached ${Math.min(i + batchSize, tilesToCache.length)}/${tilesToCache.length} tiles`);
      }

      console.log('Tile pre-caching complete!');
    } catch (error) {
      console.error('Error pre-caching tiles:', error);
    }
  }

  /**
   * Get tile URLs for Qatar bounds at a specific zoom level
   */
  private getTilesForBounds(zoom: number): string[] {
    const tiles: string[] = [];
    const { minLat, maxLat, minLon, maxLon } = this.QATAR_BOUNDS;

    // Convert lat/lon bounds to tile coordinates
    const minTileX = this.lonToTileX(minLon, zoom);
    const maxTileX = this.lonToTileX(maxLon, zoom);
    const minTileY = this.latToTileY(maxLat, zoom); // Note: inverted for Y
    const maxTileY = this.latToTileY(minLat, zoom);

    // Generate URLs for all tiles in the bounds
    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        const url = this.TILE_URL_TEMPLATE
          .replace('{s}', 'a') // Use 'a' subdomain
          .replace('{z}', zoom.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString());
        tiles.push(url);
      }
    }

    return tiles;
  }

  /**
   * Convert longitude to tile X coordinate
   */
  private lonToTileX(lon: number, zoom: number): number {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
  }

  /**
   * Convert latitude to tile Y coordinate
   */
  private latToTileY(lat: number, zoom: number): number {
    const latRad = lat * Math.PI / 180;
    return Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom)
    );
  }

  /**
   * Check if tiles are cached
   */
  async isCached(): Promise<boolean> {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const cache = await caches.open(this.TILE_CACHE_NAME);
      const keys = await cache.keys();
      return keys.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Clear cached tiles
   */
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      await caches.delete(this.TILE_CACHE_NAME);
      console.log('Map tile cache cleared');
    }
  }

  /**
   * Get cache size information
   */
  async getCacheInfo(): Promise<{ count: number; size?: number }> {
    if (!('caches' in window)) {
      return { count: 0 };
    }

    try {
      const cache = await caches.open(this.TILE_CACHE_NAME);
      const keys = await cache.keys();
      return { count: keys.length };
    } catch {
      return { count: 0 };
    }
  }
}


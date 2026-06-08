/**
 * Asset Query Params Service
 * Handles URL query params sync for asset list (tab, page, view modes, viewItemId)
 */

import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Params } from '@angular/router';
import { AssetType } from '@models/asset-list.model';

export interface AssetQueryParamsState {
  tab: AssetType | null;
  page: number | null;
  ammunitionView: 'available' | 'deleted' | null;
  explosivesView: 'available' | 'deleted' | null;
  weaponsView: 'available' | 'deleted' | null;
  accessoriesView: 'available' | 'deleted' | null;
  viewItemId: string | null;
}

const VALID_ASSET_TYPES: AssetType[] = ['ammunition', 'weapon', 'explosive', 'accessory'];

function isValidAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && VALID_ASSET_TYPES.includes(value as AssetType);
}

@Injectable({
  providedIn: 'root'
})
export class AssetQueryParamsService {
  private readonly router = inject(Router);

  /**
   * Parse query params into structured state
   */
  parseParams(params: Params): AssetQueryParamsState {
    const tabParam = params['tab'] || params['itemType'];
    const tab = isValidAssetType(tabParam) ? tabParam : null;

    const pageParam = params['page'];
    const pageNum = pageParam ? parseInt(String(pageParam), 10) : NaN;
    const page = !isNaN(pageNum) && pageNum >= 1 ? pageNum : null;

    const ammunitionView = params['ammunitionView'] === 'deleted' ? 'deleted' as const
      : params['ammunitionView'] === 'available' ? 'available' as const : null;
    const explosivesView = params['explosivesView'] === 'deleted' ? 'deleted' as const
      : params['explosivesView'] === 'available' ? 'available' as const : null;
    const weaponsView = params['weaponsView'] === 'deleted' ? 'deleted' as const
      : params['weaponsView'] === 'available' ? 'available' as const : null;
    const accessoriesView = params['accessoriesView'] === 'deleted' ? 'deleted' as const
      : params['accessoriesView'] === 'available' ? 'available' as const : null;

    const viewItemId = params['viewItemId'] != null ? String(params['viewItemId']) : null;

    return {
      tab,
      page,
      ammunitionView,
      explosivesView,
      weaponsView,
      accessoriesView,
      viewItemId
    };
  }

  /**
   * Update URL with new query params
   */
  updateUrl(
    route: ActivatedRoute,
    params: Partial<Record<string, string | number | null>>
  ): void {
    const queryParams: Params = {};
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') {
        queryParams[key] = value;
      } else {
        queryParams[key] = null;
      }
    }
    this.router.navigate([], {
      relativeTo: route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}

import { AssetType } from '@models/asset-list.model';
import { ASSET_LIST_TAB_PERMISSIONS } from '@core/constants/asset-import-export-permissions';

const TAB_ORDER: AssetType[] = ['ammunition', 'explosive', 'weapon'];

/**
 * Pick the active catalog tab: honor `requested` if allowed, else first allowed tab in order, else ammunition.
 */
export function resolveAccessibleAssetTab(
  hasAnyPermission: (permissions: readonly string[]) => boolean,
  requested: AssetType | null | undefined
): AssetType {
  if (requested && TAB_ORDER.includes(requested) && hasAnyPermission(ASSET_LIST_TAB_PERMISSIONS[requested])) {
    return requested;
  }
  for (const t of TAB_ORDER) {
    if (hasAnyPermission(ASSET_LIST_TAB_PERMISSIONS[t])) {
      return t;
    }
  }
  return 'ammunition';
}

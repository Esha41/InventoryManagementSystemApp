import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { CartridgeState, ReserveDetailsState, UserContextState, ReviewFormData } from '@pages/new-issue-request/new-issue-request.state';
import { BackendUserDto } from '@models/backend-user.model';
import { AuthenticatedUser } from '@models/auth.model';
import { resolveUserDisplayName } from '@utils/index';

/**
 * Issue Request Utilities
 * Mapping and formatting functions for new-issue-request component
 * Extracted to follow single responsibility principle
 */

/**
 * Maps selected entries to Cartridge objects with quantities
 * @param selectedEntries - Array of selected entries with id, quantity, and optional itemType
 * @param allCartridges - Array of all available cartridges
 * @param selectedCartridgesCache - Cache map of selected cartridges to preserve full data across item type changes
 * @returns Array of Cartridge objects with quantities
 */
export function mapSelectedEntriesToCartridges(
  selectedEntries: Array<{ id: number; quantity: number; itemType?: string }>,
  allCartridges: Cartridge[],
  selectedCartridgesCache?: Map<number, Cartridge>
): Cartridge[] {
  return selectedEntries.map(entry => {
    // First try to find in current allCartridges (for currently loaded item type)
    let cartridge = allCartridges.find(c => c.id === entry.id);
    
    // If not found and cache exists, try cache (for items from other item types)
    if (!cartridge && selectedCartridgesCache) {
      cartridge = selectedCartridgesCache.get(entry.id);
    }
    
    if (cartridge) {
      return { 
        ...cartridge, 
        quantity: entry.quantity,
        itemType: entry.itemType || cartridge.itemType
      };
    }
    
    // Fallback: create minimal cartridge object
    return {
      id: entry.id,
      name: `#${entry.id}`,
      selected: true,
      quantity: entry.quantity,
      itemType: entry.itemType
    } as Cartridge;
  });
}

/**
 * Filters reserve details by selected item IDs
 * @param reserveDetailsByItem - Array of reserve details by item
 * @param selectedItemIds - Array of selected item IDs
 * @returns Filtered array of reserve details
 */
export function filterReserveDetailsBySelectedItems(
  reserveDetailsByItem: any[],
  selectedItemIds: number[]
): any[] {
  if (selectedItemIds.length === 0) {
    return reserveDetailsByItem;
  }
  return reserveDetailsByItem.filter(item => selectedItemIds.includes(item.itemId));
}

/**
 * Computes total reserve from reserve details
 * @param reserveDetails - Array of reserve details
 * @returns Total reserve quantity
 */
export function computeTotalReserve(reserveDetails: any[]): number {
  return reserveDetails.reduce((sum, item) => sum + (item.totalReserve || 0), 0);
}

/**
 * Computes available reserve from reserve details
 * @param reserveDetails - Array of reserve details
 * @returns Available reserve quantity
 */
export function computeAvailableReserve(reserveDetails: any[]): number {
  return reserveDetails.reduce((sum, item) => sum + (item.availableReserve || 0), 0);
}

/**
 * Computes ordered quantity from reserve details
 * @param reserveDetails - Array of reserve details
 * @returns Ordered quantity
 */
export function computeOrderedQuantity(reserveDetails: any[]): number {
  return reserveDetails.reduce((sum, item) => sum + (item.orderedQuantity || 0), 0);
}

/**
 * Computes used quantity from reserve details
 * @param reserveDetails - Array of reserve details
 * @returns Used quantity
 */
export function computeUsedQuantity(reserveDetails: any[]): number {
  return reserveDetails.reduce((sum, item) => sum + (item.usedQuantity || 0), 0);
}

/**
 * Resolves current requester name with fallbacks
 * @param currentUserDetails - Current user details
 * @param fallbackRequesterName - Fallback requester name
 * @param reviewFormRequesterName - Requester name from review form
 * @returns Resolved requester name
 */
export function resolveCurrentRequesterName(
  currentUserDetails: BackendUserDto | null,
  fallbackRequesterName: string,
  reviewFormRequesterName: string
): string {
  return resolveUserDisplayName(
    currentUserDetails?.nameEn,
    currentUserDetails?.nameAr,
    currentUserDetails?.userName
  ) || fallbackRequesterName || reviewFormRequesterName || '';
}

/**
 * Syncs requester name from user details
 * @param currentUserDetails - Current user details
 * @returns Resolved requester name
 */
export function syncRequesterNameFromUserDetails(
  currentUserDetails: BackendUserDto | null
): string {
  return resolveUserDisplayName(
    currentUserDetails?.nameEn,
    currentUserDetails?.nameAr,
    currentUserDetails?.userName
  ) || '';
}

/**
 * Applies user context data
 * @param context - User context data
 * @param userContextState - User context state to update
 */
export function applyUserContext(
  context: { nameEn?: string; nameAr?: string; userName?: string; departmentId?: number },
  userContextState: UserContextState
): void {
  if (context.departmentId) {
    userContextState.currentUserDepartmentId = context.departmentId;
  }
}

/**
 * Applies authenticated user context
 * @param user - Authenticated user
 * @param userContextState - User context state to update
 * @returns User context data to apply
 */
export function applyAuthenticatedUserContext(
  user: AuthenticatedUser | null,
  userContextState: UserContextState
): { nameEn?: string; nameAr?: string; userName?: string; departmentId?: number } | null {
  if (!user) {
    return null;
  }

  return {
    nameEn: user.nameEn,
    nameAr: user.nameAr,
    userName: user.userName,
    departmentId: user.departmentId
  };
}

/**
 * Gets department ID for request with fallback
 * @param currentUserDepartmentId - Current user department ID
 * @param defaultDepartmentId - Default department ID fallback
 * @returns Department ID to use
 */
export function getDepartmentIdForRequest(
  currentUserDepartmentId: number | null,
  defaultDepartmentId: number
): number {
  return currentUserDepartmentId || defaultDepartmentId;
}


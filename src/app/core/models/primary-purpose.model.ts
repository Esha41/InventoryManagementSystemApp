import { LookupDto } from './ammunition.model';
import { LookupItem } from './lookup.model';

/**
 * Primary purpose lookup navigation returned by the API.
 *
 * Wire-format DTOs use `primaryPurpos` / `primaryPurposId` (missing trailing "e")
 * because of a backend naming typo. Keep those JSON property names on request and
 * response models until the API is corrected; use the helpers below in app code.
 */
export type PrimaryPurposeLookup =
  | LookupItem
  | LookupDto
  | {
      id?: number;
      nameAr?: string;
      nameEn?: string;
    };

export interface WithPrimaryPurposeNav {
  /** Backend typo for `primaryPurpose` navigation — prefer {@link getPrimaryPurposeNav}. */
  primaryPurpos?: PrimaryPurposeLookup | null;
  primaryPurposes?: PrimaryPurposeLookup[] | null;
}

export interface WithPrimaryPurposeId {
  /** Backend typo for `primaryPurposeId` — prefer {@link getPrimaryPurposeId}. */
  primaryPurposId?: number | null;
}

/** Reads the legacy `primaryPurpos` navigation property from a DTO. */
export function getPrimaryPurposeNav(
  entity: WithPrimaryPurposeNav | null | undefined
): PrimaryPurposeLookup | undefined {
  const nav = entity?.primaryPurpos;
  return nav == null ? undefined : nav;
}

/** Reads the legacy `primaryPurposId` foreign key from a DTO. */
export function getPrimaryPurposeId(
  entity: WithPrimaryPurposeId | null | undefined
): number | undefined {
  const id = entity?.primaryPurposId;
  return id == null ? undefined : id;
}

/**
 * Resolves primary purpose navigation from a lot/detail DTO:
 * direct navigation first, then match by id against `item.primaryPurposes`.
 */
export function resolveInventoryDetailPrimaryPurpose(
  detail: (WithPrimaryPurposeNav & WithPrimaryPurposeId & {
    item?: { primaryPurposes?: PrimaryPurposeLookup[] | null } | null;
  }) | null | undefined
): PrimaryPurposeLookup | undefined {
  const nav = getPrimaryPurposeNav(detail ?? undefined);
  if (nav) {
    return nav;
  }
  const id = getPrimaryPurposeId(detail ?? undefined);
  const purposes = detail?.item?.primaryPurposes;
  if (id != null && purposes?.length) {
    return purposes.find(p => p.id === id);
  }
  return undefined;
}

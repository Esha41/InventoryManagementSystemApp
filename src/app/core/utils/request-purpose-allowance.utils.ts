import { RequestPurposeAllowanceContext } from '@models/lookup.model';

/** PascalCase names from backend JsonStringEnumConverter. */
const ALLOWANCE_CONTEXT_BY_NAME: Record<string, RequestPurposeAllowanceContext> = {
  FromAllowance: RequestPurposeAllowanceContext.FromAllowance,
  OutsideAllowance: RequestPurposeAllowanceContext.OutsideAllowance,
  Both: RequestPurposeAllowanceContext.Both
};

/**
 * Maps API allowance context (number or JsonStringEnumConverter string) to numeric enum.
 * Call only from RequestPurposeService.toLookupItem.
 */
export function normalizeRequestPurposeAllowanceContext(
  value: unknown
): RequestPurposeAllowanceContext | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    if (value >= RequestPurposeAllowanceContext.FromAllowance
      && value <= RequestPurposeAllowanceContext.Both) {
      return value as RequestPurposeAllowanceContext;
    }
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const byName = ALLOWANCE_CONTEXT_BY_NAME[trimmed];
    if (byName != null) {
      return byName;
    }
    const asNum = Number(trimmed);
    if (!Number.isNaN(asNum)
      && asNum >= RequestPurposeAllowanceContext.FromAllowance
      && asNum <= RequestPurposeAllowanceContext.Both) {
      return asNum as RequestPurposeAllowanceContext;
    }
  }

  return undefined;
}

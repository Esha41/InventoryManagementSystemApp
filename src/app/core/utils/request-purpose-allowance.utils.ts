import { RequestPurposeAllowanceContext } from '@models/backend-enums';

/**
 * Maps API allowance context to numeric enum.
 * Call only from RequestPurposeService.toLookupItem.
 */
export function normalizeRequestPurposeAllowanceContext(
  value: unknown
): RequestPurposeAllowanceContext | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) {
    return undefined;
  }
  if (n >= RequestPurposeAllowanceContext.FromAllowance
    && n <= RequestPurposeAllowanceContext.Both) {
    return n as RequestPurposeAllowanceContext;
  }
  return undefined;
}

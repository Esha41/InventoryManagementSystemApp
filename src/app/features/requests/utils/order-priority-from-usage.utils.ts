/**
 * Matches backend OrderPriorityFromUsageCalculator: usage start vs local today,
 * whole calendar days (UTC midnight math to avoid DST issues).
 */

/** Backend RequestPriority: Normal = 1, Urgent = 2, VeryUrgent = 3 */
export type RequestPriorityEnum = 1 | 2 | 3;

const YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

export function normalizeUsageDateYmd(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const m = raw.trim().match(YMD_REGEX);
  return m ? m[0] : null;
}

/**
 * Whole days from today (local) to usage start date (inclusive boundary same as backend .Date diffs).
 * @returns `null` if date cannot be parsed as YYYY-MM-DD
 */
export function calendarDaysFromTodayToUsageStart(usageDateRaw: string | null | undefined): number | null {
  const ymd = normalizeUsageDateYmd(usageDateRaw);
  if (!ymd) {
    return null;
  }
  const [y, mo, d] = ymd.split('-').map(Number);
  const now = new Date();
  const usageUtc = Date.UTC(y, mo - 1, d);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return (usageUtc - todayUtc) / 86400000;
}

export function requestPriorityEnumFromUsageStartDays(days: number): RequestPriorityEnum {
  if (days < 0) {
    return 1;
  }
  if (days <= 7) {
    return 3;
  }
  if (days <= 14) {
    return 2;
  }
  return 1;
}

export function getOrderPriorityEnumFromUsageDateYmd(usageDateRaw: string | null | undefined): RequestPriorityEnum {
  const days = calendarDaysFromTodayToUsageStart(usageDateRaw);
  if (days === null) {
    return 1;
  }
  return requestPriorityEnumFromUsageStartDays(days);
}

/** i18n keys under newIssueRequest.* */
export function getOrderPriorityTranslationKeyFromUsageDateYmd(usageDateRaw: string | null | undefined): string {
  const p = getOrderPriorityEnumFromUsageDateYmd(usageDateRaw);
  if (p === 3) {
    return 'newIssueRequest.veryUrgentPriority';
  }
  if (p === 2) {
    return 'newIssueRequest.urgentPriority';
  }
  return 'newIssueRequest.normalPriority';
}

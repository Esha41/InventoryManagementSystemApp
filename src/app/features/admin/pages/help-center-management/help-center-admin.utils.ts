import { APP_CONSTANTS } from '@constants/app.constants';

export function adminBadgePositive(isPositive: boolean): string {
  const base = 'inline-block rounded px-2 py-0.5 text-xs font-semibold';
  return isPositive
    ? `${base} bg-[color-mix(in_srgb,var(--color-success,#16a34a)_15%,transparent)] text-[var(--color-success,#16a34a)]`
    : `${base} bg-[var(--color-background-soft)] text-[var(--color-text-muted)]`;
}

export function adminTotalPages(count: number): number {
  return Math.max(1, Math.ceil(count / APP_CONSTANTS.DEFAULT_PAGE_SIZE));
}

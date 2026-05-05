/**
 * Dashboard route ↔ URL helpers (query params, path normalization).
 * Pure functions — no Angular DI; safe for unit tests.
 */

export type DashboardViewMode = 'grid' | 'table';

/** Query key used in `/dashboard?view=` */
export const DASHBOARD_VIEW_QUERY_PARAM = 'view' as const;

export function parseDashboardViewMode(raw: string | null | undefined): DashboardViewMode {
  const v = (raw ?? '').toLowerCase().trim();
  if (v === 'list' || v === 'table') {
    return 'table';
  }
  return 'grid';
}

/** Normalized path without query or hash; trailing slash stripped (except root). */
export function pathWithoutQuery(url: string): string {
  let path = url.split(/[?#]/)[0];
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path || '/';
}

export function isDashboardRoutePath(path: string): boolean {
  return path === '/dashboard' || path.endsWith('/dashboard');
}

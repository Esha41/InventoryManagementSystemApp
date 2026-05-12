/**
 * Resolves caliber FK from catalog DTOs where the API may use camelCase, PascalCase,
 * or only a nested caliber object ({ id } or { Id }).
 */

export function resolveCatalogItemCaliberId(item: unknown): number | null {
  if (item == null || typeof item !== 'object') return null;
  const d = item as Record<string, unknown>;
  for (const key of ['caliberId', 'CaliberId'] as const) {
    const s = d[key];
    if (s != null && s !== '') {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }
  }
  const c = d['caliber'] ?? d['Caliber'];
  if (c != null && typeof c === 'object') {
    const o = c as Record<string, unknown>;
    const raw = o['id'] ?? o['Id'];
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Treat as deleted only when explicitly true (handles PascalCase from some payloads). */
export function isCatalogItemExplicitlyDeleted(item: unknown): boolean {
  if (item == null || typeof item !== 'object') return false;
  const d = item as Record<string, unknown>;
  return d['isDeleted'] === true || d['IsDeleted'] === true;
}

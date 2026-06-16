/**
 * Resolves caliber FK from catalog DTOs where the API may use camelCase, PascalCase,
 * or only a nested caliber object ({ id } or { Id }).
 */

export function normalizeCaliberName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Collects normalized caliber name keys (English, Arabic, display fallbacks) from a catalog row. */
export function collectCatalogItemCaliberNameKeys(item: unknown): Set<string> {
  const keys = new Set<string>();
  if (item == null || typeof item !== 'object') {
    return keys;
  }

  const d = item as Record<string, unknown>;
  const nested = d['caliber'] ?? d['Caliber'];

  if (nested != null && typeof nested === 'object') {
    const o = nested as Record<string, unknown>;
    for (const raw of [o['nameEn'], o['nameEN'], o['nameAr'], o['nameAR']]) {
      const key = normalizeCaliberName(String(raw ?? ''));
      if (key) keys.add(key);
    }
  } else if (typeof nested === 'string') {
    const key = normalizeCaliberName(nested);
    if (key) keys.add(key);
  }

  for (const raw of [d['caliberNameEn'], d['caliberNameAr']]) {
    const key = normalizeCaliberName(String(raw ?? ''));
    if (key) keys.add(key);
  }

  if (typeof d['caliber'] === 'string') {
    const key = normalizeCaliberName(d['caliber']);
    if (key) keys.add(key);
  }

  return keys;
}

/**
 * True when ammunition and weapon calibers match (same lookup id or same caliber name).
 * Ammunition and weapon calibers use separate lookup rows; names are compared case-insensitively.
 */
export function areCatalogItemCalibersCompatible(ammo: unknown, weapon: unknown): boolean {
  const ammoCalId = resolveCatalogItemCaliberId(ammo);
  const weaponCalId = resolveCatalogItemCaliberId(weapon);
  if (ammoCalId == null || weaponCalId == null) {
    return false;
  }
  if (ammoCalId === weaponCalId) {
    return true;
  }

  const ammoKeys = collectCatalogItemCaliberNameKeys(ammo);
  const weaponKeys = collectCatalogItemCaliberNameKeys(weapon);
  if (ammoKeys.size === 0 || weaponKeys.size === 0) {
    return false;
  }

  for (const key of ammoKeys) {
    if (weaponKeys.has(key)) {
      return true;
    }
  }
  return false;
}

/** True when the catalog row has a caliber id or at least one caliber name. */
export function hasCatalogItemCaliber(item: unknown): boolean {
  const id = resolveCatalogItemCaliberId(item);
  if (id != null && id > 0) {
    return true;
  }
  return collectCatalogItemCaliberNameKeys(item).size > 0;
}

/** True when any catalog weapon association has a caliber that does not match the ammo line. */
export function hasIncompatibleCatalogWeaponSelections(
  ammunitionItems: readonly unknown[],
  associationsByAmmoId: ReadonlyMap<number, ReadonlyArray<{ type?: string; weaponItemId?: number | null }>>,
  allWeapons: readonly unknown[]
): boolean {
  for (const ammo of ammunitionItems) {
    const ammoId = (ammo as { id?: number }).id;
    if (ammoId == null) continue;

    const ammoCalId = resolveCatalogItemCaliberId(ammo);
    if (ammoCalId == null || ammoCalId <= 0) continue;

    const associations = associationsByAmmoId.get(ammoId) ?? [];
    for (const assoc of associations) {
      if (assoc.type !== 'catalog' || assoc.weaponItemId == null || assoc.weaponItemId <= 0) {
        continue;
      }
      const weapon = allWeapons.find(
        w => (w as { id?: number }).id === assoc.weaponItemId
      );
      if (!weapon || !hasCatalogItemCaliber(weapon)) {
        continue;
      }
      if (!areCatalogItemCalibersCompatible(ammo, weapon)) {
        return true;
      }
    }
  }
  return false;
}

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

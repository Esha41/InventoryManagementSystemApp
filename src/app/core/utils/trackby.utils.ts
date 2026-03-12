/**
 * TrackBy utility functions for *ngFor performance optimization
 * Use these to prevent unnecessary DOM re-renders when list items change
 *
 * @see https://angular.dev/best-practices/runtime-performance#use-trackby-for-ngfor
 */

/** Item with numeric id - common for API entities */
export interface Identifiable {
  id: number;
}

/** Item with string id */
export interface IdentifiableString {
  id: string;
}

/**
 * Track by numeric id - use for entities with id: number
 * @example *ngFor="let item of items; trackBy: trackById"
 */
export function trackById<T extends Identifiable>(_: number, item: T): number {
  return item.id;
}

/**
 * Track by string id - use for entities with id: string
 */
export function trackByStringId<T extends IdentifiableString>(_: number, item: T): string {
  return item.id;
}

/**
 * Track by index - use for FormArray controls or when index is the only stable key
 * Use sparingly; prefer trackById when items have stable ids
 * @example *ngFor="let ctrl of formArray.controls; trackBy: trackByIndex"
 */
export function trackByIndex(_: number, __: unknown): number {
  return _;
}

/**
 * Track by key property - use for items with custom key
 * @example trackByKey('itemId') for allowance items
 */
export function trackByKey<K extends keyof T, T extends Record<K, string | number>>(
  key: K
): (index: number, item: T) => string | number {
  return (_, item) => item[key];
}

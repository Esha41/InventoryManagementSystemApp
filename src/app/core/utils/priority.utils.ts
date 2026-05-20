/**
 * Priority utility functions.
 * Priority values are ALWAYS calculated by the backend (OrderPriorityService).
 * The frontend is display-only — no date arithmetic here.
 */

/** Mirrors backend RequestPriority enum (Normal=1, Urgent=2, VeryUrgent=3). */
export enum Priority {
  Normal    = 1,
  Urgent    = 2,
  VeryUrgent = 3
}

const PRIORITY_TEXT_MAP: Readonly<Record<Priority, string>> = {
  [Priority.Normal]:     'Normal',
  [Priority.Urgent]:     'Urgent',
  [Priority.VeryUrgent]: 'Very Urgent'
};

const PRIORITY_CLASS_MAP: Readonly<Record<Priority, string>> = {
  [Priority.Normal]:     'text-green-600',
  [Priority.Urgent]:     'text-orange-600',
  [Priority.VeryUrgent]: 'text-red-600'
};

/** Normalise API priority to {@link Priority}. */
function toPriority(value: number | null | undefined): Priority {
  if (value == null) return Priority.Normal;
  return (value in Priority) ? (value as Priority) : Priority.Normal;
}

/** Human-readable label for a priority value (e.g. "Very Urgent"). */
export function getPriorityText(priority: number | null | undefined): string {
  return PRIORITY_TEXT_MAP[toPriority(priority)];
}

/**
 * Enum key name for a priority value — safe for i18n keys and CSS class suffixes.
 * Returns 'Normal' | 'Urgent' | 'VeryUrgent'.
 * Example: `common.priorityLevels.${getPriorityKey(p)}`
 */
export function getPriorityKey(priority: number | null | undefined): string {
  return Priority[toPriority(priority)]; // 'Normal' | 'Urgent' | 'VeryUrgent'
}

/** Tailwind CSS class for a priority badge. */
export function getPriorityClass(priority: number | null | undefined): string {
  return PRIORITY_CLASS_MAP[toPriority(priority)] ?? 'text-gray-600';
}

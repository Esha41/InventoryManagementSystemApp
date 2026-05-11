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

/**
 * Normalise a backend priority value (number or enum string) to a {@link Priority}.
 * Falls back to {@link Priority.Normal} for null / unknown values.
 */
function toPriority(value: number | string | null | undefined): Priority {
  if (value == null) return Priority.Normal;

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'veryurgent' || lower === 'very urgent' || lower === '3') return Priority.VeryUrgent;
    if (lower === 'urgent'     || lower === '2')                             return Priority.Urgent;
    if (lower === 'normal'     || lower === '1')                             return Priority.Normal;
    const parsed = parseInt(lower, 10);
    return (parsed in Priority) ? (parsed as Priority) : Priority.Normal;
  }

  return (value in Priority) ? (value as Priority) : Priority.Normal;
}

/** Human-readable label for a priority value (e.g. "Very Urgent"). */
export function getPriorityText(priority: number | string | null | undefined): string {
  return PRIORITY_TEXT_MAP[toPriority(priority)];
}

/**
 * Enum key name for a priority value — safe for i18n keys and CSS class suffixes.
 * Returns 'Normal' | 'Urgent' | 'VeryUrgent'.
 * Example: `common.priorityLevels.${getPriorityKey(p)}`
 */
export function getPriorityKey(priority: number | string | null | undefined): string {
  return Priority[toPriority(priority)]; // 'Normal' | 'Urgent' | 'VeryUrgent'
}

/** Tailwind CSS class for a priority badge. */
export function getPriorityClass(priority: number | string | null | undefined): string {
  return PRIORITY_CLASS_MAP[toPriority(priority)] ?? 'text-gray-600';
}

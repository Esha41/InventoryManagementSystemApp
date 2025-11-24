// Converts a value to a number, returning null if conversion is not possible
export const toNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Parses an optional integer value from string or number
export const parseOptionalInteger = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;

  const numeric = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(numeric) ? null : numeric;
}


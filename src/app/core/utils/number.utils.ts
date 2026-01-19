// Converts a value to a number, returning null if conversion is not possible
// Utility to safely convert values to numbers
export const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
};

// Parses an optional integer value from string or number
export const parseOptionalInteger = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;

  const numeric = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(numeric) ? null : numeric;
}


/**
 * Dropdown Component Utilities
 * Shared utilities for working with dropdown options
 */

import { DropdownOption } from '@components/dropdown/dropdown.component';

/**
 * Unwraps a dropdown option to extract the underlying value.
 * Handles both DropdownOption<T> wrapper and plain T values.
 * 
 * @param option - The option which can be either a DropdownOption wrapper or the value itself
 * @returns The unwrapped value, or null if option is null/undefined
 * 
 * @example
 * ```typescript
 * const item = unwrapDropdownOption<AmmunitionReadDto>(option);
 * if (item) {
 *   return item.name;
 * }
 * ```
 */
export function unwrapDropdownOption<T>(
  option: DropdownOption<T> | T | null | undefined
): T | null {
  if (option === null || option === undefined) {
    return null;
  }
  
  if (typeof option === 'object' && 'value' in option) {
    return (option as DropdownOption<T>).value;
  }
  
  return option as T;
}


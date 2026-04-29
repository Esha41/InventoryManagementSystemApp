/**
 * Builds nested HttpParams that match the ASP.NET Core query-string
 * model binding format used by the backend filter pipeline:
 *
 *   Filter.Field, Filter.Operator, Filter.Value, Filter.Logic,
 *   Filter.Filters[0].Field, Filter.Filters[0].Operator, ...
 */

import { HttpParams } from '@angular/common/http';
import { FilterData } from '@models/api-response.model';

export function appendFilterParams(
  params: HttpParams,
  prefix: string,
  filter?: FilterData
): HttpParams {
  if (!filter) return params;

  let next = params;

  const setIf = (key: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    const str = String(value).trim();
    if (str.length === 0) return;
    next = next.set(key, str);
  };

  setIf(`${prefix}.Field`, filter.field);
  setIf(`${prefix}.Operator`, filter.operator);
  setIf(`${prefix}.Value`, filter.value);
  setIf(`${prefix}.Logic`, filter.logic);

  if (Array.isArray(filter.filters) && filter.filters.length > 0) {
    filter.filters.forEach((child, idx) => {
      next = appendFilterParams(next, `${prefix}.Filters[${idx}]`, child);
    });
  }

  return next;
}

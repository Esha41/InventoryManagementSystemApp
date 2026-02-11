import { APIOperationResponse } from '@models/api-response.model';

// Normalizes API response to extract array data from various response formats
export const normalizeArrayResponse = <T>(
  response: APIOperationResponse<T[]> | T[] | null | undefined
): T[] => {
  if (!response) return [];

  if (Array.isArray(response)) return response;

  const payload = response as APIOperationResponse<T[]>;
  if (Array.isArray(payload?.data)) return payload.data;

  const nested = (payload as any)?.data?.items;
  if (Array.isArray(nested)) return nested as T[];

  return [];
}


/**
 * Generic API response types for flexible API responses
 * Note: These complement the stricter ApiResponse types in api-response.model.ts
 */

/**
 * Flexible API response wrapper for endpoints that may return data directly or wrapped
 */
export interface FlexibleApiResponse<T> {
    data?: T;
    success?: boolean;
    message?: string;
    errors?: string[];
}

/**
 * Flexible API response with array data
 */
export interface FlexibleApiListResponse<T> extends FlexibleApiResponse<T[]> {
    totalCount?: number;
    pageIndex?: number;
    pageSize?: number;
}

/**
 * Detail API response that may contain nested data and request items
 */
export interface DetailApiResponse extends Record<string, unknown> {
    data?: RequestDetailData;
    requestItems?: unknown[];
}

/**
 * Request detail data that may contain requestItems
 */
export interface RequestDetailData extends Record<string, unknown> {
    requestItems?: unknown[];
}

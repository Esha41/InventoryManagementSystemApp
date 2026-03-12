/**
 * Backend API Response Models
 * These models match the C# backend response structure
 */

/**
 * Standard API Response wrapper from backend
 */


// Standard API Response wrapper from backend
export interface ApiResponse<T = unknown> {
  succeeded: boolean;
  message: string;
  data: T;
  errors?: string[];
  statusCode?: number;
}

// Backend APIOperationResponse structure
export interface APIOperationResponse<T> {
  succeeded: boolean;
  data: T;
  message: string;
  messageType: ResponseType;
  errorCode: string | null;
  errors: string[] | null;
}

export enum ResponseType {
  Success = 0,
  NotFound = 1,
  BadRequest = 2,
  Unauthorized = 3,
  Forbidden = 4,
  InternalServerError = 5,
  ValidationError = 6
}

// Re-export strict types from pagination.model.ts
export { FilterData, PagedListRequest as PagedRequest, PaginatedList } from './pagination.model';



/**
 * Paginated response wrapper (Legacy)
 */
export interface PagedResponse<T> {
  succeeded: boolean;
  message: string;
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
  errors?: string[];
}

/**
 * Error response from backend
 */
export interface ApiError {
  message: string;
  errors?: string[];
  statusCode?: number;
}


/**
 * Backend API Response Models
 * These models match the C# backend response structure
 */

/**
 * Standard API Response wrapper from backend
 */
export interface ApiResponse<T = any> {
  succeeded: boolean;
  message: string;
  data: T;
  errors?: string[];
  statusCode?: number;
}

/**
 * Backend APIOperationResponse structure (matches C# backend exactly)
 */
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

/**
 * Paginated response wrapper
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
 * Backend PaginatedList structure
 */
export interface PaginatedList<T> {
  items: T[];
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Pagination request parameters
 */
export interface PagedRequest {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
  orderBy?: string;
  isAscending?: boolean;
}

/**
 * Error response from backend
 */
export interface ApiError {
  message: string;
  errors?: string[];
  statusCode?: number;
}


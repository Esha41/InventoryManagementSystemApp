import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { LoggingService } from './logging.service';
import { APIOperationResponse } from '@models/api-response.model';

/**
 * Enhanced API Service - Protocol Wrapper
 * 
 * Responsibilities:
 * 1. Standardizes all HTTP requests (GET, POST, PUT, DELETE, PATCH)
 * 2. Unwraps generic APIOperationResponse envelopes automatically
 * 3. Provides typed responses
 * 
 * Note: Authentication is handled automatically by AuthInterceptor
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private loggingService: LoggingService
  ) { }

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  // ==============================================================================================
  // 1. UNWRAPPED METHODS (Preferred)
  // These methods automatically check `succeeded` and return `data`.
  // Use these for new code to avoid "if (res.succeeded)" boilerplate in services.
  // ==============================================================================================

  /**
   * GET execution that returns the raw data `T` from inside the API envelope.
   * Throws an error if `succeeded` is false.
   */
  /**
   * GET execution that returns the raw data `T` from inside the API envelope.
   * Throws an error if `succeeded` is false.
   */
  get<T>(endpoint: string, params?: HttpParams, options?: any): Observable<T> {
    return this.executeRequest<T>('GET', endpoint, null, params, options);
  }

  /**
   * POST execution that returns the raw data `T`
   */
  post<T>(endpoint: string, data: any, options?: any): Observable<T> {
    return this.executeRequest<T>('POST', endpoint, data, options?.params, options);
  }

  /**
   * PUT execution that returns the raw data `T`
   */
  put<T>(endpoint: string, data: any, options?: any): Observable<T> {
    return this.executeRequest<T>('PUT', endpoint, data, options?.params, options);
  }

  /**
   * DELETE execution that returns the raw data `T`
   */
  delete<T>(endpoint: string, body?: any, options?: any): Observable<T> {
    return this.executeRequest<T>('DELETE', endpoint, body, options?.params, options);
  }

  /**
   * PATCH execution that returns the raw data `T`
   */
  patch<T>(endpoint: string, data: any, options?: any): Observable<T> {
    return this.executeRequest<T>('PATCH', endpoint, data, options?.params, options);
  }

  // ==============================================================================================
  // 2. RAW METHODS (Legacy / Special Cases)
  // These return the full APIOperationResponse envelope.
  // Use these if you need access to 'message', 'errorCode', or strictly need to handle 'succeeded' manually.
  // ==============================================================================================

  getRaw<T>(endpoint: string, params?: HttpParams, options?: any): Observable<APIOperationResponse<T>> {
    return this.http.get<APIOperationResponse<T>>(`${this.baseUrl}${endpoint}`, { ...options, params, observe: 'body' })
      .pipe(catchError(e => this.handleError(e))) as unknown as Observable<APIOperationResponse<T>>;
  }

  postRaw<T>(endpoint: string, data: any, options?: any): Observable<APIOperationResponse<T>> {
    return this.http.post<APIOperationResponse<T>>(`${this.baseUrl}${endpoint}`, data, { ...options, observe: 'body' })
      .pipe(catchError(e => this.handleError(e))) as unknown as Observable<APIOperationResponse<T>>;
  }

  putRaw<T>(endpoint: string, data: any, options?: any): Observable<APIOperationResponse<T>> {
    return this.http.put<APIOperationResponse<T>>(`${this.baseUrl}${endpoint}`, data, { ...options, observe: 'body' })
      .pipe(catchError(e => this.handleError(e))) as unknown as Observable<APIOperationResponse<T>>;
  }

  deleteRaw<T>(endpoint: string, body?: any, options?: any): Observable<APIOperationResponse<T>> {
    return this.http.request<APIOperationResponse<T>>('delete', `${this.baseUrl}${endpoint}`, { ...options, body, observe: 'body' })
      .pipe(catchError(e => this.handleError(e))) as unknown as Observable<APIOperationResponse<T>>;
  }

  // ==============================================================================================
  // 3. LEGACY & COMPATIBILITY LAYER
  // These map 'getWithAuth' to the raw `http` calls to maintain current app behavior.
  // Ideally, migrate these to use `get<T>` (unwrapped) over time.
  // ==============================================================================================

  /** @deprecated Use apiService.get<T>() instead for automatic unwrapping, or apiService.getRaw<T>() if you need the envelope. */
  getWithAuth<T>(endpoint: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params })
      .pipe(catchError(e => this.handleError(e)));
  }

  /** @deprecated Use apiService.post<T>() instead */
  postWithAuth<T, D = unknown>(endpoint: string, data: D, options?: any): Observable<T> {
    const httpOptions = { ...(options || {}), observe: 'body' as const };
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, httpOptions)
      .pipe(catchError(e => this.handleError(e))) as Observable<T>;
  }

  /** @deprecated Use apiService.put<T>() instead */
  putWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, data)
      .pipe(catchError(e => this.handleError(e)));
  }

  /** @deprecated Use apiService.delete<T>() instead */
  deleteWithAuth<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`)
      .pipe(catchError(e => this.handleError(e)));
  }

  /** @deprecated Use apiService.patch<T>() instead */
  patchWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, data)
      .pipe(catchError(e => this.handleError(e)));
  }


  // ==============================================================================================
  // INTERNAL HELPERS
  // ==============================================================================================

  /**
   * The core execution logic.
   * It expects the backend to return `APIOperationResponse<T>`.
   * It unwraps `data` if `succeeded` is true, otherwise it throws an error.
   */
  private executeRequest<T>(method: string, endpoint: string, body?: any, params?: HttpParams, extraOptions?: any): Observable<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let req$: Observable<APIOperationResponse<T>>;

    const options = { ...extraOptions, params, observe: 'body' };

    if (method === 'GET') {
      req$ = this.http.get<APIOperationResponse<T>>(url, options) as unknown as Observable<APIOperationResponse<T>>;
    } else if (method === 'POST') {
      req$ = this.http.post<APIOperationResponse<T>>(url, body, options) as unknown as Observable<APIOperationResponse<T>>;
    } else if (method === 'PUT') {
      req$ = this.http.put<APIOperationResponse<T>>(url, body, options) as unknown as Observable<APIOperationResponse<T>>;
    } else if (method === 'DELETE') {
      // Use request method to correctly handle body in DELETE and type inference
      req$ = this.http.request<APIOperationResponse<T>>('delete', url, { ...options, body }) as unknown as Observable<APIOperationResponse<T>>;
    } else if (method === 'PATCH') {
      req$ = this.http.patch<APIOperationResponse<T>>(url, body, options) as unknown as Observable<APIOperationResponse<T>>;
    } else {
      return throwError(() => new Error(`Method ${method} not implemented`));
    }

    return req$.pipe(
      map(response => {
        // Validation: Verify it matches our expected envelope
        if (this.isValidEnvelope(response)) {
          if (response.succeeded) {
            return response.data;
          } else {
            // Business Logic Error (e.g. Validation Failed)
            throw new Error(response.message || 'Operation failed');
          }
        }
        // Fallback: If backend didn't return standard envelope (e.g. legacy endpoint), return as is
        return response as unknown as T;
      }),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Type Guard to check if response is APIOperationResponse
   */
  private isValidEnvelope(response: any): response is APIOperationResponse<any> {
    return response && typeof response === 'object' && 'succeeded' in response;
  }

  private handleError(error: unknown): Observable<never> {
    // Rely on your ErrorInterceptor for logging and formatting
    // This just ensures the chain breaks correctly
    return throwError(() => error);
  }
}


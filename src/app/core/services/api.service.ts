import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ConfigService } from './config.service';

/**
 * Base API service for making HTTP requests
 * All API services should extend or use this service
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) { }

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * POST request
   */
  post<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data)
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * PUT request
   */
  put<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, data)
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * PATCH request
   */
  patch<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, data)
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`)
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * GET request with authentication headers
   */
  getWithAuth<T>(endpoint: string, params?: HttpParams): Observable<T> {
    const headers = this.getAuthHeaders();
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params, headers })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * POST request with authentication headers
   */
  postWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    let headers = this.getAuthHeaders();

    // If data is FormData, don't set Content-Type header (browser will set it with boundary)
    if (data instanceof FormData) {
      headers = headers.delete('Content-Type');
    }

    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, { headers })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * PUT request with authentication headers
   */
  putWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    const headers = this.getAuthHeaders();
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, data, { headers })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * PATCH request with authentication headers
   */
  patchWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    const headers = this.getAuthHeaders();
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, data, { headers })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * DELETE request with authentication headers
   */
  deleteWithAuth<T>(endpoint: string): Observable<T> {
    const headers = this.getAuthHeaders();
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, { headers })
      .pipe(catchError(error => this.handleError(error)));
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    headers = headers.set('Content-Type', 'application/json');
    return headers;
  }

  /**
   * Error handler with better error processing
   */
  private handleError(error: unknown): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    // Check if error has userMessage from error interceptor
    if (error && typeof error === 'object' && 'userMessage' in error) {
      errorMessage = (error as any).userMessage;
    } else if (error instanceof HttpErrorResponse) {
      // Type guard for HttpErrorResponse
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client Error: ${error.error.message}`;
      } else if (error.status === 0) {
        // Connection refused or CORS error
        const backendUrl = this.getBackendOrigin();
        errorMessage = `Cannot connect to server. Please ensure the backend is running on ${backendUrl}`;
      } else {
        // Server-side error
        if (error.status === 401) {
          errorMessage = 'Unauthorized. Please login again.';
          localStorage.removeItem('auth_token');
          localStorage.removeItem('current_user');
        } else if (error.status === 403) {
          errorMessage = 'Forbidden. You do not have permission to perform this action.';
        } else if (error.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (error.status === 500) {
          errorMessage = 'Internal server error. Please try again later.';
        } else {
          // Try to extract error message from various possible response formats
          const errorData = error.error;
          if (errorData) {
            if (typeof errorData === 'string') {
              errorMessage = errorData;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            } else if (errorData.title) {
              errorMessage = errorData.title;
            } else {
              errorMessage = `Server Error: ${error.status} - ${error.statusText || 'Unknown error'}`;
            }
          } else {
            errorMessage = `Server Error: ${error.status} - ${error.statusText || 'Unknown error'}`;
          }
        }
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    this.configService.logError('API Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Extract backend origin for error messaging
   */
  private getBackendOrigin(): string {
    const baseUrl = this.baseUrl;

    try {
      const url = new URL(baseUrl);
      return url.origin;
    } catch {
      // If baseUrl is relative, fallback to window origin + baseUrl
      if (typeof window !== 'undefined' && window.location) {
        return `${window.location.origin}${baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`}`;
      }
      return baseUrl;
    }
  }
}


import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ConfigService } from './config.service';
import { LoggingService } from './logging.service';

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
    private configService: ConfigService,
    private loggingService: LoggingService
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
  post<T, D = unknown>(endpoint: string, data: D, options?: { withCredentials?: boolean }): Observable<T> {
    let headers = new HttpHeaders();

    // Add client information headers
    const clientHeaders = this.getClientInfoHeaders();
    if (Object.keys(clientHeaders).length > 0) {
      Object.keys(clientHeaders).forEach(key => {
        headers = headers.set(key, clientHeaders[key]);
      });
    }

    const httpOptions: {
      headers: HttpHeaders;
      withCredentials?: boolean;
      observe: 'body';
    } = {
      headers: headers,
      observe: 'body' as const
    };

    if (options?.withCredentials) {
      httpOptions.withCredentials = true;
    }

    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, httpOptions)
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
    return this.makeAuthenticatedRequest<T>(
      (url, headers) => this.http.get<T>(url, { params, headers })
      , endpoint);
  }

  /**
   * POST request with authentication headers
   */
  postWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.makeAuthenticatedRequest<T>(
      (url, headers) => {
        // If data is FormData, don't set Content-Type header (browser will set it with boundary)
        const finalHeaders = data instanceof FormData ? headers.delete('Content-Type') : headers;
        return this.http.post<T>(url, data, { headers: finalHeaders });
      },
      endpoint
    );
  }

  /**
   * PUT request with authentication headers
   */
  putWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.makeAuthenticatedRequest<T>(
      (url, headers) => this.http.put<T>(url, data, { headers })
      , endpoint);
  }

  /**
   * PATCH request with authentication headers
   */
  patchWithAuth<T, D = unknown>(endpoint: string, data: D): Observable<T> {
    return this.makeAuthenticatedRequest<T>(
      (url, headers) => this.http.patch<T>(url, data, { headers })
      , endpoint);
  }

  /**
   * DELETE request with authentication headers
   */
  deleteWithAuth<T>(endpoint: string): Observable<T> {
    return this.makeAuthenticatedRequest<T>(
      (url, headers) => this.http.delete<T>(url, { headers })
      , endpoint);
  }

  /**
   * Helper method to make authenticated requests with consistent error handling
   */
  private makeAuthenticatedRequest<T>(
    requestFn: (url: string, headers: HttpHeaders) => Observable<T>,
    endpoint: string
  ): Observable<T> {
    const headers = this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    return requestFn(url, headers).pipe(catchError(error => this.handleError(error)));
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
   * Get client information headers
   */
  private getClientInfoHeaders(): Record<string, string> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {};
    }

    const userAgent = navigator.userAgent || '';
    const headers: Record<string, string> = {};

    // Browser info
    if (userAgent.includes('Firefox')) {
      headers['X-Client-Browser'] = 'Firefox';
      const match = userAgent.match(/Firefox\/([\d.]+)/);
      if (match) headers['X-Client-BrowserVersion'] = match[1];
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      headers['X-Client-Browser'] = 'Chrome';
      const match = userAgent.match(/Chrome\/([\d.]+)/);
      if (match) headers['X-Client-BrowserVersion'] = match[1];
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      headers['X-Client-Browser'] = 'Safari';
      const match = userAgent.match(/Version\/([\d.]+)/);
      if (match) headers['X-Client-BrowserVersion'] = match[1];
    } else if (userAgent.includes('Edg')) {
      headers['X-Client-Browser'] = 'Edge';
      const match = userAgent.match(/Edg\/([\d.]+)/);
      if (match) headers['X-Client-BrowserVersion'] = match[1];
    }

    // OS info
    if (userAgent.includes('Windows')) {
      headers['X-Client-OS'] = 'Windows';
      if (userAgent.includes('Windows NT 10.0')) headers['X-Client-OSVersion'] = '10';
      else if (userAgent.includes('Windows NT 6.3')) headers['X-Client-OSVersion'] = '8.1';
      else if (userAgent.includes('Windows NT 6.2')) headers['X-Client-OSVersion'] = '8';
      else if (userAgent.includes('Windows NT 6.1')) headers['X-Client-OSVersion'] = '7';
    } else if (userAgent.includes('Mac OS')) {
      headers['X-Client-OS'] = 'macOS';
      const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
      if (match) headers['X-Client-OSVersion'] = match[1].replace('_', '.');
    } else if (userAgent.includes('Linux')) {
      headers['X-Client-OS'] = 'Linux';
    } else if (userAgent.includes('Android')) {
      headers['X-Client-OS'] = 'Android';
      const match = userAgent.match(/Android ([\d.]+)/);
      if (match) headers['X-Client-OSVersion'] = match[1];
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      headers['X-Client-OS'] = 'iOS';
      const match = userAgent.match(/OS (\d+[._]\d+)/);
      if (match) headers['X-Client-OSVersion'] = match[1].replace('_', '.');
    }

    // Device type
    if (userAgent.includes('Mobile') || (userAgent.includes('Android') && !userAgent.includes('Tablet'))) {
      headers['X-Client-Device'] = 'Mobile';
    } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
      headers['X-Client-Device'] = 'Tablet';
    } else {
      headers['X-Client-Device'] = 'Desktop';
    }

    // Additional info
    if (userAgent) headers['X-Client-UserAgent'] = userAgent;
    if (window.screen?.width) headers['X-Client-ScreenWidth'] = window.screen.width.toString();
    if (window.screen?.height) headers['X-Client-ScreenHeight'] = window.screen.height.toString();
    if (navigator.language) headers['X-Client-Language'] = navigator.language;
    if (navigator.platform) headers['X-Client-Platform'] = navigator.platform;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) headers['X-Client-Timezone'] = timezone;
    } catch (e) {
      // Ignore timezone errors
    }

    // Note: Windows user cannot be accessed from browser JavaScript due to security restrictions
    // The backend will extract it from HttpContext.User.Identity.Name when Windows Authentication is enabled

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

    this.loggingService.error('API Error', error);
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


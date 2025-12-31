import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';

export interface LowStockNotificationSettingsDto {
  roles: string[],
  users: string[],
};

export interface LowStockNotificationScheduleDto {
  scheduleTime: string,
};

@Injectable({
  providedIn: 'root'
})
export class StockNotificationService {
  private get baseUrl(): string {
    return `${this.config.apiUrl}${API_ENDPOINTS.STOCK_NOTIFICATION.BASE}`;
  }
  constructor(    
    private http: HttpClient,
    private config: ConfigService
  ) {}

  private handleError(err: any) {
    console.error(err);
    return throwError(() => err);
  }

  updateSchedule<T>(data: LowStockNotificationScheduleDto): Observable<APIOperationResponse<T>> {
    const endpoint = `${this.config.apiUrl}${API_ENDPOINTS.STOCK_NOTIFICATION.SCHEDULE}`;
    return this.http.put<APIOperationResponse<T>>(endpoint, data).pipe(
      catchError(this.handleError)
    );
  }

  getSchedule<T = LowStockNotificationScheduleDto>(): Observable<APIOperationResponse<T>> {
    const endpoint = `${this.config.apiUrl}${API_ENDPOINTS.STOCK_NOTIFICATION.SCHEDULE}`;
    return this.http.get<APIOperationResponse<T>>(endpoint).pipe(
      catchError(this.handleError)
    );
  }

  updateSettings<T>(data: LowStockNotificationSettingsDto): Observable<APIOperationResponse<T>> {
    const endpoint = `${this.config.apiUrl}${API_ENDPOINTS.STOCK_NOTIFICATION.SETTINGS}`;
    return this.http.put<APIOperationResponse<T>>(endpoint, data).pipe(
      catchError(this.handleError)
    );
  }

  getSettings<T = LowStockNotificationSettingsDto>(): Observable<APIOperationResponse<T>> {
    const endpoint = `${this.config.apiUrl}${API_ENDPOINTS.STOCK_NOTIFICATION.SETTINGS}`;
    return this.http.get<APIOperationResponse<T>>(endpoint).pipe(
      catchError(this.handleError)
    );
  }
}
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';

export interface LowStockNotificationSettingsDto {
  roles: string[];
  users: string[];
}

export interface LowStockNotificationScheduleDto {
  scheduleTime: string | Date;
}

@Injectable({
  providedIn: 'root'
})
export class StockNotificationService {
  constructor(private apiService: ApiService) { }

  updateSchedule<T>(data: LowStockNotificationScheduleDto): Observable<T> {
    return this.apiService.put<T>(API_ENDPOINTS.STOCK_NOTIFICATION.SCHEDULE, data);
  }

  getSchedule<T = Date | null>(): Observable<T> {
    return this.apiService.get<T>(API_ENDPOINTS.STOCK_NOTIFICATION.SCHEDULE);
  }

  updateSettings<T>(data: LowStockNotificationSettingsDto): Observable<T> {
    return this.apiService.put<T>(API_ENDPOINTS.STOCK_NOTIFICATION.SETTINGS, data);
  }

  getSettings<T = LowStockNotificationSettingsDto>(): Observable<T> {
    return this.apiService.get<T>(API_ENDPOINTS.STOCK_NOTIFICATION.SETTINGS);
  }
}

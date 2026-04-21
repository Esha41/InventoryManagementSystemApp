import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';

export interface RoleRefDto {
  id: string;
  name: string | null;
}

export interface OrderAutoRejectSettingsDto {
  triggerRoleId: string | null;
  triggerRoleName: string | null;
  thresholdDays: number;
  scanCron: string;
  isEnabled: boolean;
  notifyRequester: boolean;
  reminderLeadDays: number[];
  notifyRoles: RoleRefDto[];
}

export interface UpdateOrderAutoRejectSettingsDto {
  triggerRoleId: string;
  thresholdDays: number;
  scanCron: string;
  isEnabled: boolean;
  notifyRequester: boolean;
  reminderLeadDays: number[];
  notifyRoleIds: string[];
}

@Injectable({ providedIn: 'root' })
export class OrderAutoRejectSettingsService {
  constructor(private apiService: ApiService) {}

  getSettings(): Observable<OrderAutoRejectSettingsDto> {
    return this.apiService.get<OrderAutoRejectSettingsDto>(API_ENDPOINTS.ORDER_AUTO_REJECT.SETTINGS);
  }

  updateSettings(data: UpdateOrderAutoRejectSettingsDto): Observable<void> {
    return this.apiService.put<void>(API_ENDPOINTS.ORDER_AUTO_REJECT.SETTINGS, data);
  }
}

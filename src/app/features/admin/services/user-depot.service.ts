import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { DepotUserDto } from '@models/depot.model';

/**
 * Service for managing user-depot assignments.
 */
@Injectable({
  providedIn: 'root'
})
export class UserDepotService {
  constructor(private apiService: ApiService) {}

  /**
   * Get users assigned to a depot.
   */
  getDepotUsers(depotId: number): Observable<DepotUserDto[]> {
    return this.apiService.get<DepotUserDto[]>(API_ENDPOINTS.DEPOT.USERS(depotId));
  }

  /**
   * Update user assignments for a depot. Replaces existing assignments.
   */
  updateDepotUsers(depotId: number, userIds: string[]): Observable<boolean> {
    return this.apiService.put<boolean>(API_ENDPOINTS.DEPOT.USERS_UPDATE(depotId), { userIds });
  }
}

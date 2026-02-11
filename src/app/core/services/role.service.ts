import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { RoleDto } from '@models/backend-user.model';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private readonly endpoint = '/Roles';

  constructor(private apiService: ApiService) { }

  /**
   * Get all roles
   */
  getAllRoles(): Observable<RoleDto[]> {
    return this.apiService.get<RoleDto[]>(this.endpoint);
  }
}

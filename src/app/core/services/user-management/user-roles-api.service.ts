import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from '../api.service';
import { ConfigService } from '../config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { RoleDto, UpdateUserRolesDto } from '@models/backend-user.model';

import { normalizeRole } from './user-normalizer.util';

@Injectable({
  providedIn: 'root'
})
export class UserRolesApiService {
  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  getUserRoles(userId: string): Observable<RoleDto[]> {
    this.configService.log('Fetching user roles', { userId });

    return this.apiService.get<RoleDto[]>(API_ENDPOINTS.USERS.ROLES(userId)).pipe(
      map(roles => (roles || []).map(normalizeRole)),
      catchError(error => {
        this.configService.logError('Failed to fetch user roles', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch user roles'));
      })
    );
  }

  updateUserRoles(userId: string, roleIds: string[]): Observable<boolean> {
    this.configService.log('Updating user roles', { userId, roleIds });

    const dto: UpdateUserRolesDto = { userId, roleIds };

    return this.apiService.put<unknown>(API_ENDPOINTS.USERS.UPDATE_ROLES(userId), dto).pipe(
      map(response => {
        if (typeof response === 'boolean' && !response) {
          throw new Error('Failed to update user roles');
        }
        return true;
      }),
      tap(() => this.configService.log('User roles updated successfully', { userId })),
      catchError(error => {
        this.configService.logError('Failed to update user roles', error);
        return throwError(() => new Error(error.userMessage || 'Failed to update user roles'));
      })
    );
  }
}

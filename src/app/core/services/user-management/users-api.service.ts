import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ApiService } from '../api.service';
import { ConfigService } from '../config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { ErrorHandler } from '@utils/error-handler.utils';
import {
  BackendUserDto,
  CreateUserDto,
  UpdateUserDto,
  RawUserApiResponse
} from '@models/backend-user.model';
import { PagedRequest, PaginatedList } from '@models/api-response.model';

import { normalizeUser } from './user-normalizer.util';
import { appendFilterParams } from './http-filter-params.util';

export interface UserSummaryDto {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
}

@Injectable({
  providedIn: 'root'
})
export class UsersApiService {
  private readonly usersSubject = new BehaviorSubject<BackendUserDto[]>([]);
  readonly users$ = this.usersSubject.asObservable();

  constructor(
    private readonly apiService: ApiService,
    private readonly configService: ConfigService
  ) {}

  /** Snapshot of the currently cached users list (last fetched page). */
  get currentUsers(): BackendUserDto[] {
    return this.usersSubject.value;
  }

  getUsers(request?: PagedRequest): Observable<PaginatedList<BackendUserDto>> {
    this.configService.log('Fetching users', request);

    let params = new HttpParams()
      .set('Page', (request?.page ?? 1).toString())
      .set('PageSize', (request?.pageSize ?? 10).toString());

    params = appendFilterParams(params, 'Filter', request?.filter);

    return this.apiService.get<PaginatedList<BackendUserDto>>(
      API_ENDPOINTS.USERS.BASE,
      params
    ).pipe(
      map(response => ({
        ...response,
        items: (response.items || []).map((u: RawUserApiResponse) => normalizeUser(u))
      })),
      tap(paginatedList => {
        this.usersSubject.next(paginatedList.items);
        this.configService.log(
          `Fetched ${paginatedList.items.length} users (Page ${paginatedList.pageIndex})`
        );
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch users', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch users'));
      })
    );
  }

  getUsersSummary(): Observable<UserSummaryDto> {
    return this.apiService.get<UserSummaryDto>(API_ENDPOINTS.USERS.BASE + '/Summary').pipe(
      map(data => data || { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 }),
      catchError(error => {
        this.configService.logError('Failed to fetch users summary', error);
        return throwError(() => new Error('Failed to fetch users summary'));
      })
    );
  }

  getUserById(id: string): Observable<BackendUserDto> {
    this.configService.log('Fetching user', { id });

    return this.apiService.get<BackendUserDto>(API_ENDPOINTS.USERS.BY_ID(id)).pipe(
      // NOTE: Intentionally returns the raw payload to match legacy behavior.
      // The original BackendUserService.getUserById did NOT normalize (its
      // condition was `if (X && !X)`, always false). Normalize here only as
      // part of a separate, focused PR after auditing all callers.
      map((userData: RawUserApiResponse & BackendUserDto) => {
        if (!userData) {
          throw new Error('Failed to fetch user');
        }
        return userData as BackendUserDto;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch user', error);
        return throwError(() => new Error(error.userMessage || 'Failed to fetch user'));
      })
    );
  }

  createUser(user: CreateUserDto): Observable<BackendUserDto> {
    this.configService.log('Creating user', { userName: user.userName });

    return this.apiService.post<BackendUserDto>(API_ENDPOINTS.USERS.BASE, user).pipe(
      map(newUser => {
        if (!newUser) {
          throw new Error('Failed to create user');
        }
        return newUser;
      }),
      tap(newUser => {
        this.usersSubject.next([...this.usersSubject.value, newUser]);
        this.configService.log('User created successfully', { id: newUser.id });
      }),
      catchError(error => {
        this.configService.logError('Failed to create user', error);
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to create user');
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  updateUser(id: string, user: UpdateUserDto): Observable<BackendUserDto> {
    this.configService.log('Updating user', { id });

    return this.apiService.put<BackendUserDto>(
      API_ENDPOINTS.USERS.BY_ID(id),
      { ...user, id }
    ).pipe(
      // NOTE: Returns raw payload to match legacy behavior — see getUserById above.
      map((userData: RawUserApiResponse & BackendUserDto) => {
        if (!userData) {
          throw new Error('Failed to update user');
        }
        return userData as BackendUserDto;
      }),
      tap(updatedUser => {
        // Matches legacy in-place mutation + spread emission pattern.
        const currentUsers = this.usersSubject.value;
        const index = currentUsers.findIndex(u => u.id === id);
        if (index !== -1) {
          currentUsers[index] = updatedUser;
          this.usersSubject.next([...currentUsers]);
        }
        this.configService.log('User updated successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to update user', error);
        const errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to update user');
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  toggleUserStatus(id: string): Observable<boolean> {
    this.configService.log('Toggling user status', { id });

    return this.apiService.put<boolean>(API_ENDPOINTS.USERS.TOGGLE_STATUS(id), {}).pipe(
      map(succeeded => {
        if (!succeeded) {
          throw new Error('Failed to toggle user status');
        }
        return true;
      }),
      tap(() => {
        // Matches legacy behavior: in-place flip on the user object, then emit a new array reference.
        const currentUsers = this.usersSubject.value;
        const index = currentUsers.findIndex(u => u.id === id);
        if (index !== -1) {
          currentUsers[index].isActive = !currentUsers[index].isActive;
          this.usersSubject.next([...currentUsers]);
        }
        this.configService.log('User status toggled successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to toggle user status', error);
        return throwError(() => new Error(error.userMessage || 'Failed to toggle user status'));
      })
    );
  }

  deleteUser(id: string): Observable<boolean> {
    this.configService.log('Deleting user', { id });

    return this.apiService.delete<unknown>(API_ENDPOINTS.USERS.BY_ID(id)).pipe(
      map(() => true),
      tap(() => {
        this.usersSubject.next(this.usersSubject.value.filter(u => u.id !== id));
        this.configService.log('User deleted successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to delete user', error);
        return throwError(() => new Error(error.userMessage || 'Failed to delete user'));
      })
    );
  }

  restoreUser(id: string): Observable<boolean> {
    this.configService.log('Restoring user', { id });

    return this.apiService.putRaw<unknown>(API_ENDPOINTS.USERS.RESTORE(id), {}).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to restore user');
        }
        return true;
      }),
      tap(() => this.configService.log('User restored successfully', { id })),
      catchError(error => {
        this.configService.logError('Failed to restore user', error);
        return throwError(
          () => new Error(error.userMessage || error.message || 'Failed to restore user')
        );
      })
    );
  }

  permanentDeleteUser(id: string): Observable<boolean> {
    this.configService.log('Permanently deleting user', { id });

    return this.apiService.delete<unknown>(API_ENDPOINTS.USERS.PERMANENT_DELETE(id)).pipe(
      map(() => true),
      tap(() => {
        this.usersSubject.next(this.usersSubject.value.filter(u => u.id !== id));
        this.configService.log('User permanently deleted', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to permanently delete user', error);
        return throwError(
          () => new Error(error.userMessage || error.message || 'Failed to permanently delete user')
        );
      })
    );
  }
}

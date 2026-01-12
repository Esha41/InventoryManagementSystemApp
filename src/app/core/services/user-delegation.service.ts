import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/api-response.model';
import { UserDelegation, CreateUserDelegation } from '../models/user-delegation';
import { BackendUserDto } from '../models/backend-user.model';

@Injectable({
    providedIn: 'root'
})
export class UserDelegationService {
    private readonly endpoint = '/UserDelegation'; // Matches controller route

    constructor(private apiService: ApiService) { }

    getAvailableUsers(): Observable<ApiResponse<BackendUserDto[]>> {
        return this.apiService.getWithAuth<ApiResponse<BackendUserDto[]>>(`${this.endpoint}/available-users`);
    }

    create(dto: CreateUserDelegation): Observable<ApiResponse<boolean>> {
        return this.apiService.postWithAuth<ApiResponse<boolean>>(this.endpoint, dto);
    }

    getMyDelegations(): Observable<ApiResponse<UserDelegation[]>> {
        return this.apiService.getWithAuth<ApiResponse<UserDelegation[]>>(`${this.endpoint}/my-delegations`);
    }

    revoke(id: number): Observable<ApiResponse<boolean>> {
        return this.apiService.putWithAuth<ApiResponse<boolean>>(`${this.endpoint}/${id}/revoke`, {});
    }
}

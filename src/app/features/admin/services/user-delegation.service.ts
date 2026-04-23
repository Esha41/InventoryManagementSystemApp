import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { UserDelegation, CreateUserDelegation } from '@models/user-delegation';
import { BackendUserDto } from '@models/backend-user.model';

@Injectable({
    providedIn: 'root'
})
export class UserDelegationService {
    private readonly endpoint = '/UserDelegation'; // Matches controller route

    constructor(private apiService: ApiService) { }

    getAvailableUsers(): Observable<BackendUserDto[]> {
        return this.apiService.get<BackendUserDto[]>(`${this.endpoint}/available-users`);
    }

    create(dto: CreateUserDelegation): Observable<boolean> {
        return this.apiService.post<boolean>(this.endpoint, dto);
    }

    getMyDelegations(): Observable<UserDelegation[]> {
        return this.apiService.get<UserDelegation[]>(`${this.endpoint}/my-delegations`);
    }

    revoke(id: number): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.endpoint}/${id}/revoke`, {});
    }

    approve(id: number): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.endpoint}/${id}/approve`, {});
    }

    reject(id: number): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.endpoint}/${id}/reject`, {});
    }

    getPendingDelegations(): Observable<UserDelegation[]> {
        return this.apiService.get<UserDelegation[]>(`${this.endpoint}/pending-delegations`);
    }

    // Admin methods
    getAllDelegations(): Observable<UserDelegation[]> {
        return this.apiService.get<UserDelegation[]>(`${this.endpoint}/admin/all`);
    }

    getDelegationHistory(): Observable<UserDelegation[]> {
        return this.apiService.get<UserDelegation[]>(`${this.endpoint}/admin/history`);
    }

    getCrossDepartmentSetting(): Observable<boolean> {
        return this.apiService.get<boolean>(`${this.endpoint}/settings/cross-department`);
    }

    updateCrossDepartmentSetting(allow: boolean): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.endpoint}/settings/cross-department`, allow);
    }

    getDelegatorActionSetting(): Observable<boolean> {
        return this.apiService.get<boolean>(`${this.endpoint}/settings/delegator-action`);
    }

    updateDelegatorActionSetting(allow: boolean): Observable<boolean> {
        return this.apiService.put<boolean>(`${this.endpoint}/settings/delegator-action`, allow);
    }

    checkUserRestriction(): Observable<boolean> {
        return this.apiService.get<boolean>(`${this.endpoint}/is-restricted`);
    }
}

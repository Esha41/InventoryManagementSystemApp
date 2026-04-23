import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { LookupService, DepartmentDto } from '@services/lookup.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import type {
  AllowanceItemType,
  AllowanceApiItem,
  AllowanceItemTypeKey
} from '../models/allowance.model';
import type { AmmunitionReadDto } from '@models/ammunition.model';
import type { WeaponDto } from '@models/weapon.model';
import type { ExplosiveDto } from '@models/explosive.model';

export interface AllowanceBulkRequest {
  departmentId: number;
  year: number;
  items: Array<{ itemId: number; itemType: number; quantity: number }>;
}

@Injectable({ providedIn: 'root' })
export class AllowanceService {
  constructor(
    private readonly apiService: ApiService,
    private readonly lookupService: LookupService,
    private readonly ammunitionService: AmmunitionService,
    private readonly weaponService: WeaponService,
    private readonly explosiveService: ExplosiveService
  ) {}

  getDepartments(): Observable<DepartmentDto[]> {
    return this.lookupService.getDepartments();
  }

  getItemsByType(itemType: AllowanceItemTypeKey): Observable<AllowanceItemType[]> {
    if (itemType === 'Weapon') {
      return this.weaponService.getAll<WeaponDto>();
    }
    if (itemType === 'Explosive') {
      return this.explosiveService.getAll<ExplosiveDto>();
    }
    return this.ammunitionService.getAll<AmmunitionReadDto>();
  }

  getExistingAllowance(departmentId: number, year: number): Observable<AllowanceApiItem[]> {
    const endpoint = API_ENDPOINTS.ALLOWANCE.BY_DEPARTMENT_AND_YEAR(departmentId, year);
    type AllowanceResponseData = { items?: AllowanceApiItem[]; Items?: AllowanceApiItem[] };
    return this.apiService.get<AllowanceResponseData>(endpoint).pipe(
      map((data) => {
        return data?.items || data?.Items || [];
      })
    );
  }

  submitBulk(request: AllowanceBulkRequest): Observable<void> {
    return this.apiService.post<unknown>(
      API_ENDPOINTS.ALLOWANCE.BULK,
      request
    ).pipe(map(() => undefined));
  }
}

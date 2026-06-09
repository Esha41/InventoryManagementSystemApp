import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { APIOperationResponse } from '@models/api-response.model';
import {
  BulkReplaceWeaponAccessoriesDto,
  CreateUpdateWeaponAccessoryDto,
  WeaponAccessoryDto
} from '@models/weapon-accessory.model';

@Injectable({ providedIn: 'root' })
export class WeaponAccessoryService {
  private readonly endpoint = '/WeaponAccessory';

  constructor(private apiService: ApiService) { }

  getByWeaponId(weaponId: number): Observable<WeaponAccessoryDto[]> {
    return this.apiService.get<WeaponAccessoryDto[]>(`${this.endpoint}/weapon/${weaponId}`);
  }

  getByAccessoryId(accessoryId: number): Observable<WeaponAccessoryDto[]> {
    return this.apiService.get<WeaponAccessoryDto[]>(`${this.endpoint}/accessory/${accessoryId}`);
  }

  getById(weaponId: number, accessoryId: number): Observable<WeaponAccessoryDto> {
    return this.apiService.get<WeaponAccessoryDto>(`${this.endpoint}/${weaponId}/${accessoryId}`);
  }

  create(dto: CreateUpdateWeaponAccessoryDto): Observable<APIOperationResponse<boolean>> {
    return this.apiService.postRaw<boolean>(this.endpoint, dto);
  }

  update(
    weaponId: number,
    accessoryId: number,
    dto: CreateUpdateWeaponAccessoryDto
  ): Observable<APIOperationResponse<boolean>> {
    return this.apiService.putRaw<boolean>(`${this.endpoint}/${weaponId}/${accessoryId}`, dto);
  }

  delete(weaponId: number, accessoryId: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${weaponId}/${accessoryId}`);
  }

  replaceForWeapon(
    weaponId: number,
    dto: BulkReplaceWeaponAccessoriesDto
  ): Observable<APIOperationResponse<boolean>> {
    return this.apiService.putRaw<boolean>(`${this.endpoint}/weapon/${weaponId}/replace`, dto);
  }
}

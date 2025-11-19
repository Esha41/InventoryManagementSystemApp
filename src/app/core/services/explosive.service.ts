import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ConfigService } from './config.service';
import { BaseItemDto } from '@models/inventory.model';
import { APIOperationResponse } from '@models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ExplosiveService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Explosive`;
  }

  // Fetch list of explosives
  getAll<T = BaseItemDto>(): Observable<T[]> {
    return this.http.get<APIOperationResponse<T[]>>(this.baseUrl).pipe(
      map((res: APIOperationResponse<T[]>) => {
        if (res.succeeded && res.data && Array.isArray(res.data)) {
          return res.data as T[];
        }
        return [] as T[];
      })
    );
  }
}


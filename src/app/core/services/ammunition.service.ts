import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';

interface ApiListResponse<T> {
  succeeded?: boolean;
  data?: T[];
  result?: T[];
}

@Injectable({ providedIn: 'root' })
export class AmmunitionService {
  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Ammunition`;
  }

  // Fetch list of ammunitions (assets) from backend Ammunition API
  getAll<T = any>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);

    return this.http.get<ApiListResponse<T> | T[]>(this.baseUrl, { params }).pipe(
      map((res: any) => {
        if (Array.isArray(res)) return res as T[];
        if (res?.data && Array.isArray(res.data)) return res.data as T[];
        if (res?.result && Array.isArray(res.result)) return res.result as T[];
        return [] as T[];
      })
    );
  }

  // Get ammunition by ID
  getById<T = any>(id: number): Observable<T | null> {
    return this.http.get<ApiListResponse<T> | T>(`${this.baseUrl}/${id}`).pipe(
      map((res: any) => {
        if (res?.data) return res.data as T;
        if (res?.result) return res.result as T;
        return res as T;
      })
    );
  }

  // Update ammunition
  update<T = any>(id: number, data: any): Observable<APIOperationResponse<T>> {
    return this.http.put<APIOperationResponse<T>>(`${this.baseUrl}/${id}`, data);
  }

  // Delete ammunition
  delete(id: number): Observable<APIOperationResponse<any>> {
    return this.http.delete<APIOperationResponse<any>>(`${this.baseUrl}/${id}`);
  }

  // Create ammunition
  create<T = any>(data: any): Observable<APIOperationResponse<T>> {
    return this.http.post<APIOperationResponse<T>>(this.baseUrl, data);
  }
}




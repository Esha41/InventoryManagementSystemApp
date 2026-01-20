import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import { LookupItem, CreateUpdateLookupDto, DepartmentDto, SupplierDto, ManufacturerDto, CountryDto, HccDto, NatureOptionDto } from '@models/lookup.model';
import { DepotDto } from '@models/depot.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ConfigService } from './config.service';

// Export for backward compatibility
export { DepartmentDto, LookupItem, SupplierDto, ManufacturerDto, CountryDto, HccDto, NatureOptionDto, DepotDto };

@Injectable({
  providedIn: 'root'
})
export class LookupService {
  private readonly baseUrl = '/Lookup';

  constructor(
    private apiService: ApiService,
    private http: HttpClient,
    private configService: ConfigService
  ) { }

  /**
   * Get all lookup items for a specific table
   */
  getLookupItems(tableName: string, includeDeleted: boolean = false): Observable<LookupItem[]> {
    const endpoint = `${this.baseUrl}/${tableName}`;
    const params = includeDeleted ? new HttpParams().set('includeDeleted', 'true') : undefined;

    return this.apiService.getWithAuth<APIOperationResponse<LookupItem[]>>(endpoint, params).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to load lookup items');
      })
    );
  }

  /**
   * Get a single lookup item by ID
   */
  getLookupItemById(tableName: string, id: number): Observable<LookupItem> {
    const endpoint = `${this.baseUrl}/${tableName}/${id}`;

    return this.apiService.getWithAuth<APIOperationResponse<LookupItem>>(endpoint).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to load lookup item');
      })
    );
  }

  /**
   * Create a new lookup item
   */
  createLookupItem(tableName: string, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    const endpoint = `${this.baseUrl}/${tableName}`;

    return this.apiService.postWithAuth<APIOperationResponse<LookupItem>>(endpoint, dto).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to create lookup item');
      })
    );
  }

  /**
   * Update an existing lookup item
   */
  updateLookupItem(tableName: string, id: number, dto: CreateUpdateLookupDto): Observable<LookupItem> {
    const endpoint = `${this.baseUrl}/${tableName}/${id}`;

    return this.apiService.putWithAuth<APIOperationResponse<LookupItem>>(endpoint, dto).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to update lookup item');
      })
    );
  }

  /**
   * Soft delete a lookup item
   * Note: Backend DELETE endpoint expects DTO in body, which HttpClient supports
   */
  deleteLookupItem(tableName: string, id: number, dto: CreateUpdateLookupDto): Observable<boolean> {
    const endpoint = `${this.baseUrl}/${tableName}/${id}`;

    // HttpClient supports DELETE with body, though it's not standard HTTP
    // We need to use http directly to send DELETE with body
    const headers = this.getAuthHeaders();
    return this.http.delete<APIOperationResponse<LookupItem>>(`${this.configService.apiUrl}${endpoint}`, {
      headers,
      body: dto
    }).pipe(
      map(response => {
        if (response.succeeded) {
          return true;
        }
        throw new Error(response.message || 'Failed to delete lookup item');
      })
    );
  }

  /**
   * Get auth headers for direct HTTP calls
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    headers = headers.set('Content-Type', 'application/json');
    return headers;
  }

  /**
   * Search lookup items
   */
  searchLookupItems(tableName: string, searchText: string, includeDeleted: boolean = false): Observable<LookupItem[]> {
    const endpoint = `${this.baseUrl}/${tableName}/search`;
    let params = new HttpParams().set('searchText', searchText);
    if (includeDeleted) {
      params = params.set('includeDeleted', 'true');
    }

    return this.apiService.getWithAuth<APIOperationResponse<LookupItem[]>>(endpoint, params).pipe(
      map(response => {
        if (response.succeeded && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Failed to search lookup items');
      })
    );
  }

  // Backward compatibility methods - convenience methods for specific lookup tables
  getDepartments(): Observable<LookupItem[]> {
    return this.getLookupItems('Department');
  }

  getDepots(): Observable<LookupItem[]> {
    return this.getLookupItems('Depot');
  }

  getHccs(): Observable<LookupItem[]> {
    return this.getLookupItems('Hcc');
  }

  getCaseTypes(): Observable<LookupItem[]> {
    return this.getLookupItems('CaseType');
  }

  getHazardDivisions(): Observable<LookupItem[]> {
    return this.getLookupItems('HazardDivision');
  }

  getCompatibilities(): Observable<LookupItem[]> {
    return this.getLookupItems('Compatibility');
  }

  getPropellants(): Observable<LookupItem[]> {
    return this.getLookupItems('Propellant');
  }

  getUnits(): Observable<LookupItem[]> {
    return this.getLookupItems('Unit');
  }

  getNsns(): Observable<LookupItem[]> {
    return this.getLookupItems('Nsn');
  }

  getNatureOptions(): Observable<LookupItem[]> {
    return this.getLookupItems('NatureOption');
  }

  getPrimaryPurposes(): Observable<LookupItem[]> {
    return this.getLookupItems('PrimaryPurpos');
  }

  getColors(): Observable<LookupItem[]> {
    return this.getLookupItems('Color');
  }

  getProjectailMaterials(): Observable<LookupItem[]> {
    return this.getLookupItems('ProjectailMaterial');
  }

  getWorkflowTypes(): Observable<LookupItem[]> {
    return this.getLookupItems('WorkFlowType');
  }

  getSuppliers(): Observable<LookupItem[]> {
    return this.getLookupItems('Supplier');
  }

  getManufacturers(): Observable<LookupItem[]> {
    return this.getLookupItems('Manufacturer');
  }

  getCountries(): Observable<LookupItem[]> {
    return this.getLookupItems('Country');
  }

  getClassifications(): Observable<LookupItem[]> {
    return this.getLookupItems('Classification');
  }

  getItemTypes(): Observable<LookupItem[]> {
    return this.getLookupItems('ItemType');
  }

  /**
   * Clear cache for a specific lookup table (no-op for now, kept for backward compatibility)
   */
  clearCacheFor(tableName: string): void {
    // No caching implemented yet, but method kept for backward compatibility
    // Future implementation can add caching here
  }
}

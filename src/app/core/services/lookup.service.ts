import { Injectable } from '@angular/core';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { DepotDto } from '@models/depot.model';

// Lookup interfaces for all tables
export interface LookupItem {
  id: number;
  nameAr: string;
  nameEn: string;
  isDeleted?: boolean;
}

export interface DepartmentDto extends LookupItem {
  code: string;
}

export interface SupplierDto extends LookupItem {}

export interface CountryDto extends LookupItem {}

export interface ManufacturerDto extends LookupItem {}

export interface HccDto extends LookupItem {}

export interface NatureOptionDto extends LookupItem {}

export interface NsnDto extends LookupItem {}

export interface PrimaryPurposDto extends LookupItem {}

export interface ProjectailMaterialDto extends LookupItem {}

export interface PropellantDto extends LookupItem {}

export interface UnitDto extends LookupItem {}

export interface CaseTypeDto extends LookupItem {}

export interface ColorDto extends LookupItem {}

export interface CompatibilityDto extends LookupItem {}

export interface HazardDivisionDto extends LookupItem {}

/**
 * Centralized service for managing all lookup tables with caching
 */
@Injectable({
  providedIn: 'root'
})
export class LookupService {
  private cache = new Map<string, Observable<any[]>>();

  constructor(private apiService: ApiService) {}

  /**
   * Clear all cached lookups
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific lookup cache
   */
  clearCacheFor(lookupName: string): void {
    this.cache.delete(lookupName);
  }

  /**
   * Generic method to get lookup items with caching
   */
  private getLookup<T>(endpoint: string, cacheKey: string): Observable<T[]> {
    if (!this.cache.has(cacheKey)) {
      const request$ = this.apiService.getWithAuth<APIOperationResponse<T[]>>(endpoint).pipe(
        map(response => {
          if (response.succeeded && response.data) {
            return response.data;
          }
          console.warn(`Failed to load ${cacheKey}:`, response.message);
          return [];
        }),
        catchError(err => {
          // Gracefully handle 401/403 by returning empty list
          if (err?.status === 401 || err?.status === 403) {
            return of([] as T[]);
          }
          return of([] as T[]);
        }),
        shareReplay(1) // Cache the result
      );
      this.cache.set(cacheKey, request$);
    }
    return this.cache.get(cacheKey)!;
  }

  /**
   * Generic method compatible with callers expecting getAll('Type')
   */
  getAll<T = any>(lookupType: string): Observable<T[]> {
    const key = lookupType.toLowerCase();
    return this.getLookup<T>(`/Lookup/${lookupType}`, key);
  }

  /**
   * Get all depots
   */
  getDepots(): Observable<DepotDto[]> {
    return this.getLookup<DepotDto>('/Lookup/Depot', 'depots');
  }

  /**
   * Get all departments
   */
  getDepartments(): Observable<DepartmentDto[]> {
    return this.getLookup<DepartmentDto>('/Lookup/Department', 'departments');
  }

  /**
   * Get all suppliers
   */
  getSuppliers(): Observable<SupplierDto[]> {
    return this.getLookup<SupplierDto>('/Lookup/Supplier', 'suppliers');
  }

  /**
   * Get all countries
   */
  getCountries(): Observable<CountryDto[]> {
    return this.getLookup<CountryDto>('/Lookup/Country', 'countries');
  }

  /**
   * Get all manufacturers
   */
  getManufacturers(): Observable<ManufacturerDto[]> {
    return this.getLookup<ManufacturerDto>('/Lookup/Manufacturer', 'manufacturers');
  }

  /**
   * Get all HCCs
   */
  getHccs(): Observable<HccDto[]> {
    return this.getLookup<HccDto>('/Lookup/Hcc', 'hccs');
  }

  /**
   * Get all nature options
   */
  getNatureOptions(): Observable<NatureOptionDto[]> {
    return this.getLookup<NatureOptionDto>('/Lookup/NatureOption', 'natureOptions');
  }

  /**
   * Get all NSNs
   */
  getNsns(): Observable<NsnDto[]> {
    return this.getLookup<NsnDto>('/Lookup/Nsn', 'nsns');
  }

  /**
   * Get all primary purposes
   */
  getPrimaryPurposes(): Observable<PrimaryPurposDto[]> {
    return this.getLookup<PrimaryPurposDto>('/Lookup/PrimaryPurpos', 'primaryPurposes');
  }

  /**
   * Get all projectile materials
   */
  getProjectailMaterials(): Observable<ProjectailMaterialDto[]> {
    return this.getLookup<ProjectailMaterialDto>('/Lookup/ProjectailMaterial', 'projectailMaterials');
  }

  /**
   * Get all propellants
   */
  getPropellants(): Observable<PropellantDto[]> {
    return this.getLookup<PropellantDto>('/Lookup/Propellant', 'propellants');
  }

  /**
   * Get all units
   */
  getUnits(): Observable<UnitDto[]> {
    return this.getLookup<UnitDto>('/Lookup/Unit', 'units');
  }

  /**
   * Get all case types
   */
  getCaseTypes(): Observable<CaseTypeDto[]> {
    return this.getLookup<CaseTypeDto>('/Lookup/CaseType', 'caseTypes');
  }

  /**
   * Get all colors
   */
  getColors(): Observable<ColorDto[]> {
    return this.getLookup<ColorDto>('/Lookup/Color', 'colors');
  }

  /**
   * Get all compatibilities
   */
  getCompatibilities(): Observable<CompatibilityDto[]> {
    return this.getLookup<CompatibilityDto>('/Lookup/Compatibility', 'compatibilities');
  }

  /**
   * Get all hazard divisions
   */
  getHazardDivisions(): Observable<HazardDivisionDto[]> {
    return this.getLookup<HazardDivisionDto>('/Lookup/HazardDivision', 'hazardDivisions');
  }

  /**
   * Get workflow types
   */
  getWorkflowTypes(): Observable<LookupItem[]> {
    return this.getLookup<LookupItem>('/Lookup/WorkFlowType', 'workflowTypes');
  }
}


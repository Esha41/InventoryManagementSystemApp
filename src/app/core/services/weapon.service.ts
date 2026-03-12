import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, forkJoin, catchError, of, switchMap } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';
import { APIOperationResponse, PagedRequest, PaginatedList } from '@models/api-response.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { FileUploadService, FileUploadDto, FileEntityType } from './file-upload.service';
import { IImportableService } from '../interfaces/importable-service.interface';
import { ImportResult } from '../models/import-result.model';

@Injectable({ providedIn: 'root' })
export class WeaponService implements IImportableService {
  private readonly endpoint = '/Weapon';

  constructor(
    private apiService: ApiService,
    private http: HttpClient, // Kept for Blob operations
    private config: ConfigService,
    private fileUploadService: FileUploadService
  ) { }

  // Fetch list of weapons
  getAll<T = WeaponDto>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);

    return this.apiService.get<T[]>(this.endpoint, params);
  }

  // Get paginated weapons
  // Note: apiService.post automatically unwraps APIOperationResponse, so response is already PaginatedList
  getAllPaginated(request: PagedRequest): Observable<PaginatedList<WeaponDto>> {
    return this.apiService.post<PaginatedList<WeaponDto>>(
      `${this.endpoint}/Paginated`,
      request
    ).pipe(
      map(response => {
        // Response is already unwrapped PaginatedList from apiService
        if (!response || !response.items) {
          throw new Error('Invalid response structure');
        }
        return response;
      }),
      catchError(error => {
        this.config.logError('Error fetching paginated weapons', error);
        throw error;
      })
    );
  }

  // Get weapon by ID
  getById<T = WeaponDto>(id: number, includeDeleted = false): Observable<T> {
    const params = includeDeleted ? new HttpParams().set('includeDeleted', 'true') : undefined;
    return this.apiService.get<T>(`${this.endpoint}/${id}`, params);
  }

  // Update weapon
  update<T = WeaponDto>(id: number, data: CreateUpdateWeaponDto): Observable<APIOperationResponse<T>> {
    return this.apiService.putRaw<T>(`${this.endpoint}/${id}`, data);
  }

  // Delete weapon
  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}`);
  }

  // Restore soft-deleted weapon
  restore(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.postRaw<boolean>(`${this.endpoint}/${id}/restore`, {});
  }

  // Permanently delete soft-deleted weapon (irreversible)
  permanentDelete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}/permanent`);
  }

  // Create weapon
  create<T = WeaponDto>(data: CreateUpdateWeaponDto): Observable<APIOperationResponse<T>> {
    return this.apiService.postRaw<T>(this.endpoint, data);
  }

  // Get file info for a weapon (returns file ID and URL)
  getFileInfo(weaponId: number): Observable<{ id: number; url: string } | null> {
    return this.fileUploadService.getFilesByEntity(FileEntityType.Weapon, weaponId).pipe(
      map((files: FileUploadDto[]) => {
        if (files && files.length > 0) {
          const mainFile = files.find((f) => f.isMain) || files[0];
          if (mainFile?.id) {
            return {
              id: mainFile.id,
              url: this.fileUploadService.getFileDownloadUrl(mainFile.id)
            };
          }
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  // Get image URL for a weapon (backward compatibility)
  getImageUrl(weaponId: number): Observable<string | null> {
    return this.getFileInfo(weaponId).pipe(
      map((fileInfo) => fileInfo?.url || null)
    );
  }

  // Get file as blob
  // Auth interceptor handles Authorization header for all HttpClient requests
  getFileBlob(fileId: number): Observable<Blob> {
    const imageUrl = this.fileUploadService.getFileDownloadUrl(fileId);
    return this.http.get(imageUrl, { responseType: 'blob' });
  }

  // Delete a file
  deleteFile(fileId: number): Observable<boolean> {
    return this.fileUploadService.deleteFile(fileId);
  }

  // Upload a new file
  uploadFile(weaponId: number, file: File, isMain: boolean = true): Observable<number> {
    return this.fileUploadService.uploadFile(file, FileEntityType.Weapon, weaponId, isMain);
  }

  // Update image: delete old file and upload new one
  updateImage(weaponId: number, file: File, existingFileId: number | null): Observable<number> {
    const upload$ = this.uploadFile(weaponId, file, true);

    if (existingFileId) {
      return this.deleteFile(existingFileId).pipe(
        switchMap(() => upload$),
        catchError((deleteErr) => {
          this.config.logWarning('Failed to delete old image, proceeding with upload anyway', deleteErr);
          return upload$;
        })
      );
    } else {
      return upload$;
    }
  }

  // Get image as blob URL (for authenticated requests)
  getImageBlobUrl(weaponId: number): Observable<string | null> {
    return this.getImageUrl(weaponId).pipe(
      map((imageUrl) => imageUrl || null),
      catchError(() => of(null))
    );
  }

  // Load images for multiple weapons
  loadAssetImages(weaponIds: number[]): Observable<Map<number, string | null>> {
    if (weaponIds.length === 0) {
      return of(new Map());
    }

    const imageMap$ = weaponIds.map(id =>
      this.getImageUrl(id).pipe(
        switchMap(url => {
          if (!url) return of({ id, url: null });

          return this.http.get(url, { responseType: 'blob' }).pipe(
            map(blob => {
              if (blob.type && blob.type.startsWith('image/')) {
                return { id, url: URL.createObjectURL(blob) };
              }
              return { id, url: null };
            }),
            catchError((error) => {
              this.config.logError(`Failed to fetch image blob for weapon ${id}`, error);
              return of({ id, url: null });
            })
          );
        }),
        catchError((error) => {
          this.config.logError(`Failed to get image URL for weapon ${id}`, error);
          return of({ id, url: null });
        })
      )
    );

    return forkJoin(imageMap$).pipe(
      map((results) => {
        const map = new Map<number, string | null>();
        results.forEach(({ id, url }) => {
          map.set(id, url);
        });
        return map;
      }),
      catchError((err) => {
        this.config.logError('Failed to load weapon images', err);
        return of(new Map());
      })
    );
  }

  // Import weapons from Excel file
  importData(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    // Use postRaw to get the full response if needed, or post for data only
    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/Import`, formData, params);
  }

  // Preview import data without saving
  importPreview(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/ImportPreview`, formData, params);
  }

  // Download import template with all fields and data validation
  generateImportTemplate(language: string = 'en'): Observable<Blob> {
    const params = new HttpParams().set('language', language);
    // Use http directly for blob response as ApiService doesn't support it yet
    return this.http.get(`${this.config.apiUrl}${this.endpoint}/template`, { params, responseType: 'blob' });
  }
}

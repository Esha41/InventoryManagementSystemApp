import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, map, forkJoin, catchError, of, switchMap } from 'rxjs';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { FileUploadService, FileUploadDto, FileEntityType } from './file-upload.service';

interface ApiListResponse<T> {
  succeeded?: boolean;
  data?: T[];
  result?: T[];
}

@Injectable({ providedIn: 'root' })
export class WeaponService {
  constructor(
    private http: HttpClient,
    private config: ConfigService,
    private fileUploadService: FileUploadService
  ) { }

  private get baseUrl(): string {
    return `${this.config.apiUrl}/Weapon`;
  }

  // Fetch list of weapons
  getAll<T = WeaponDto>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);

    return this.http.get<APIOperationResponse<T[]> | ApiListResponse<T> | T[]>(this.baseUrl, { params }).pipe(
      map((res: APIOperationResponse<T[]> | ApiListResponse<T> | T[] | unknown) => {
        if (res && typeof res === 'object' && 'succeeded' in res && 'data' in res) {
          const apiOpResponse = res as APIOperationResponse<T[]>;
          if (apiOpResponse.succeeded && apiOpResponse.data && Array.isArray(apiOpResponse.data)) {
            return apiOpResponse.data as T[];
          }
        }
        if (Array.isArray(res)) return res as T[];
        const apiResponse = res as ApiListResponse<T>;
        if (apiResponse?.data && Array.isArray(apiResponse.data)) return apiResponse.data as T[];
        if (apiResponse?.result && Array.isArray(apiResponse.result)) return apiResponse.result as T[];
        return [] as T[];
      })
    );
  }

  // Get weapon by ID
  getById<T = WeaponDto>(id: number): Observable<T | null> {
    return this.http.get<ApiListResponse<T> | T>(`${this.baseUrl}/${id}`).pipe(
      map((res: ApiListResponse<T> | T | unknown) => {
        const apiResponse = res as ApiListResponse<T>;
        if (apiResponse?.data) return apiResponse.data as T;
        if (apiResponse?.result) return apiResponse.result as T;
        return res as T;
      })
    );
  }

  // Update weapon
  update<T = WeaponDto>(id: number, data: CreateUpdateWeaponDto): Observable<APIOperationResponse<T>> {
    return this.http.put<APIOperationResponse<T>>(`${this.baseUrl}/${id}`, data);
  }

  // Delete weapon
  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.http.delete<APIOperationResponse<boolean>>(`${this.baseUrl}/${id}`);
  }

  // Create weapon
  create<T = WeaponDto>(data: CreateUpdateWeaponDto): Observable<APIOperationResponse<T>> {
    return this.http.post<APIOperationResponse<T>>(this.baseUrl, data);
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
  getFileBlob(fileId: number): Observable<Blob> {
    const imageUrl = this.fileUploadService.getFileDownloadUrl(fileId);
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return this.http.get(imageUrl, { headers, responseType: 'blob' });
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
          console.warn('Failed to delete old image, proceeding with upload anyway:', deleteErr);
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
              console.error(`Failed to fetch image blob for weapon ${id}`, error);
              return of({ id, url: null });
            })
          );
        }),
        catchError((error) => {
          console.error(`Failed to get image URL for weapon ${id}:`, error);
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
        console.error('Failed to load weapon images:', err);
        return of(new Map());
      })
    );
  }

  // Import weapons from Excel file
  importData(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<any>(`${this.baseUrl}/Import`, formData);
  }

  // Preview import data without saving
  importPreview(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.baseUrl}/ImportPreview`, formData);
  }

  // Download import template with all fields and data validation
  downloadImportTemplate(language: string = 'en'): Observable<Blob> {
    const params = new HttpParams().set('language', language);
    return this.http.get(`${this.baseUrl}/template`, { params, responseType: 'blob' });
  }
}

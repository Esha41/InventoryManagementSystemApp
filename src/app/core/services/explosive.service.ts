import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, map, forkJoin, catchError, of, switchMap } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { FileUploadService, FileUploadDto, FileEntityType } from './file-upload.service';

@Injectable({ providedIn: 'root' })
export class ExplosiveService {
  private readonly endpoint = '/Explosive';

  constructor(
    private apiService: ApiService,
    private http: HttpClient, // Kept for Blob operations
    private config: ConfigService,
    private fileUploadService: FileUploadService
  ) { }

  // Fetch list of explosives
  getAll<T = ExplosiveDto>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);

    return this.apiService.get<T[]>(this.endpoint, params);
  }

  // Get explosive by ID
  getById<T = ExplosiveDto>(id: number): Observable<T> {
    return this.apiService.get<T>(`${this.endpoint}/${id}`);
  }

  // Update explosive
  update<T = ExplosiveDto>(id: number, data: CreateUpdateExplosiveDto): Observable<APIOperationResponse<T>> {
    return this.apiService.putRaw<T>(`${this.endpoint}/${id}`, data);
  }

  // Delete explosive
  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}`);
  }

  // Create explosive
  create<T = ExplosiveDto>(data: CreateUpdateExplosiveDto): Observable<APIOperationResponse<T>> {
    return this.apiService.postRaw<T>(this.endpoint, data);
  }

  // Get file info for an explosive (returns file ID and URL)
  getFileInfo(explosiveId: number): Observable<{ id: number; url: string } | null> {
    return this.fileUploadService.getFilesByEntity(FileEntityType.Explosive, explosiveId).pipe(
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

  // Get image URL for an explosive (backward compatibility)
  getImageUrl(explosiveId: number): Observable<string | null> {
    return this.getFileInfo(explosiveId).pipe(
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
  uploadFile(explosiveId: number, file: File, isMain: boolean = true): Observable<number> {
    return this.fileUploadService.uploadFile(file, FileEntityType.Explosive, explosiveId, isMain);
  }

  // Update image: delete old file and upload new one
  updateImage(explosiveId: number, file: File, existingFileId: number | null): Observable<number> {
    const upload$ = this.uploadFile(explosiveId, file, true);

    if (existingFileId) {
      return this.deleteFile(existingFileId).pipe(
        switchMap(() => upload$),
        catchError(() => {
          // If deletion fails, still try to upload (maybe file doesn't exist)
          return upload$;
        })
      );
    } else {
      return upload$;
    }
  }

  // Get image as blob URL (for authenticated requests)
  getImageBlobUrl(explosiveId: number): Observable<string | null> {
    return this.getImageUrl(explosiveId).pipe(
      map((imageUrl) => imageUrl || null),
      catchError(() => of(null))
    );
  }

  // Load images for multiple explosives
  loadAssetImages(explosiveIds: number[]): Observable<Map<number, string | null>> {
    if (explosiveIds.length === 0) {
      return of(new Map());
    }

    const imageMap$ = explosiveIds.map(id =>
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
            catchError(() => {
              return of({ id, url: null });
            })
          );
        }),
        catchError(() => {
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
      catchError(() => {
        return of(new Map());
      })
    );
  }

  // Import explosives from Excel file
  importData(file: File, language: string = 'en'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    // Use postRaw to get the full response if needed, or post for data only
    return this.apiService.post<any>(`${this.endpoint}/Import`, formData, { params });
  }

  // Preview import data without saving
  importPreview(file: File, language: string = 'en'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.post<any>(`${this.endpoint}/ImportPreview`, formData, { params });
  }

  // Download import template with all fields and data validation
  downloadImportTemplate(language: string = 'en'): Observable<Blob> {
    const params = new HttpParams().set('language', language);
    // Use http directly for blob response as ApiService doesn't support it yet
    return this.http.get(`${this.config.apiUrl}${this.endpoint}/template`, { params, responseType: 'blob' });
  }
}

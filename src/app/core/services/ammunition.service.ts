import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map, forkJoin, catchError, of, switchMap } from 'rxjs';
import { ApiService } from './api.service';
import { APIOperationResponse, PagedRequest, PaginatedList } from '@models/api-response.model';
import { AmmunitionReadDto, AmmunitionCreateDto } from '@models/ammunition.model';
import { FileUploadService, FileUploadDto, FileEntityType } from './file-upload.service';
import { IImportableService } from '../interfaces/importable-service.interface';
import { ImportResult } from '../models/import-result.model';

@Injectable({ providedIn: 'root' })
export class AmmunitionService implements IImportableService {
  private readonly endpoint = '/Ammunition';

  constructor(
    private apiService: ApiService,
    private http: HttpClient, // Kept for Blob operations until ApiService supports them
    private fileUploadService: FileUploadService
  ) { }

  // Fetch list of ammunitions (assets)
  getAll<T = AmmunitionReadDto>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);

    return this.apiService.get<T[]>(this.endpoint, params);
  }

  // Get paginated ammunitions
  // Note: apiService.post automatically unwraps APIOperationResponse, so response is already PaginatedList
  // Backend returns AmmunitionDto, but we use AmmunitionReadDto type for compatibility
  getAllPaginated(request: PagedRequest): Observable<PaginatedList<AmmunitionReadDto>> {
    return this.apiService.post<PaginatedList<AmmunitionReadDto>>(
      `${this.endpoint}/Paginated`,
      request
    ).pipe(
      map(response => {
        // Response is already unwrapped PaginatedList from apiService
        if (!response || !response.items) {
          throw new Error('Invalid response structure');
        }
        // Cast to expected type - backend AmmunitionDto should be compatible with AmmunitionReadDto
        return response as PaginatedList<AmmunitionReadDto>;
      }),
      catchError(error => {
        console.error('Error fetching paginated ammunitions:', error);
        throw error;
      })
    );
  }

  // Get ammunition by ID
  getById<T = AmmunitionReadDto>(id: number): Observable<T> {
    return this.apiService.get<T>(`${this.endpoint}/${id}`);
  }

  // Update ammunition
  update<T = AmmunitionReadDto>(id: number, data: AmmunitionCreateDto): Observable<APIOperationResponse<T>> {
    return this.apiService.putRaw<T>(`${this.endpoint}/${id}`, data);
  }

  // Delete ammunition
  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}`);
  }

  // Create ammunition
  create<T = AmmunitionReadDto>(data: AmmunitionCreateDto): Observable<APIOperationResponse<T>> {
    return this.apiService.postRaw<T>(this.endpoint, data);
  }

  // Get file info for an ammunition item (returns file ID and URL)
  getFileInfo(ammunitionId: number): Observable<{ id: number; url: string } | null> {
    return this.fileUploadService.getFilesByEntity(FileEntityType.Ammunition, ammunitionId).pipe(
      map((files: FileUploadDto[]) => {
        if (files && files.length > 0) {
          // Get the main file or first file
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

  // Get image URL for an ammunition item (backward compatibility)
  getImageUrl(ammunitionId: number): Observable<string | null> {
    return this.getFileInfo(ammunitionId).pipe(
      map((fileInfo) => fileInfo?.url || null)
    );
  }

  // Get file as blob
  // Note: Using HttpClient directly because ApiService doesn't support 'blob' response type yet
  getFileBlob(fileId: number): Observable<Blob> {
    const imageUrl = this.fileUploadService.getFileDownloadUrl(fileId);
    // AuthInterceptor will handle headers
    return this.http.get(imageUrl, { responseType: 'blob' });
  }

  // Delete a file
  deleteFile(fileId: number): Observable<boolean> {
    return this.fileUploadService.deleteFile(fileId);
  }

  // Upload a new file
  uploadFile(ammunitionId: number, file: File, isMain: boolean = true): Observable<number> {
    return this.fileUploadService.uploadFile(file, FileEntityType.Ammunition, ammunitionId, isMain);
  }

  // Update image: delete old file and upload new one
  updateImage(ammunitionId: number, file: File, existingFileId: number | null): Observable<number> {
    const upload$ = this.uploadFile(ammunitionId, file, true);

    if (existingFileId) {
      return this.deleteFile(existingFileId).pipe(
        switchMap(() => upload$),
        catchError(() => upload$) // If deletion fails, still try to upload
      );
    }
    return upload$;
  }

  // Get image as blob URL (for authenticated requests)
  getImageBlobUrl(ammunitionId: number): Observable<string | null> {
    return this.getImageUrl(ammunitionId).pipe(
      map((imageUrl) => imageUrl || null),
      catchError(() => of(null))
    );
  }

  // Load images for multiple ammunition items
  loadAssetImages(ammunitionIds: number[]): Observable<Map<number, string | null>> {
    if (ammunitionIds.length === 0) {
      return of(new Map());
    }

    const imageMap$ = ammunitionIds.map(id =>
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
            catchError(() => of({ id, url: null }))
          );
        }),
        catchError(() => of({ id, url: null }))
      )
    );

    return forkJoin(imageMap$).pipe(
      map((results) => {
        const map = new Map<number, string | null>();
        results.forEach(({ id, url }) => map.set(id, url));
        return map;
      }),
      catchError(() => of(new Map()))
    );
  }

  // Import ammunition data
  importData(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/Import`, formData, params);
  }

  // Preview import data without saving
  importPreview(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/ImportPreview`, formData, params);
  }

  // Download import template
  generateImportTemplate(language: string = 'en'): Observable<Blob> {
    const params = new HttpParams().set('language', language);
    return this.http.get(`${this.apiService['baseUrl']}${this.endpoint}/template`, { params, responseType: 'blob' });
  }
}




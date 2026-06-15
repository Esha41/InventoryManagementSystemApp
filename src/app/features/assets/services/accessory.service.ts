import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, switchMap } from 'rxjs';
import { ConfigService } from '@services/config.service';
import { ApiService } from '@services/api.service';
import { APIOperationResponse, PagedRequest, PaginatedList } from '@models/api-response.model';
import { AccessoryDto, CreateUpdateAccessoryDto } from '@models/accessory.model';
import { FileUploadService, FileUploadDto, FileEntityType } from '@services/file-upload.service';
import { IImportableService } from '@core/interfaces/importable-service.interface';
import { ImportResult } from '@models/import-result.model';

@Injectable({ providedIn: 'root' })
export class AccessoryService implements IImportableService {
  private readonly endpoint = '/Accessory';

  constructor(
    private apiService: ApiService,
    private http: HttpClient,
    private fileUploadService: FileUploadService,
    private config: ConfigService
  ) { }

  getAll<T = AccessoryDto>(query?: { search?: string }): Observable<T[]> {
    let params = new HttpParams();
    if (query?.search) params = params.set('search', query.search);
    return this.apiService.get<T[]>(this.endpoint, params);
  }

  getAllPaginated(request: PagedRequest): Observable<PaginatedList<AccessoryDto>> {
    return this.apiService.post<PaginatedList<AccessoryDto>>(
      `${this.endpoint}/Paginated`,
      request
    ).pipe(
      map(response => {
        if (!response || !response.items) {
          throw new Error('Invalid response structure');
        }
        return response;
      }),
      catchError(error => {
        this.config.logError('Error fetching paginated accessories', error);
        throw error;
      })
    );
  }

  getById<T = AccessoryDto>(id: number, includeDeleted = false): Observable<T> {
    const params = includeDeleted ? new HttpParams().set('includeDeleted', 'true') : undefined;
    return this.apiService.get<T>(`${this.endpoint}/${id}`, params);
  }

  update<T = AccessoryDto>(id: number, data: CreateUpdateAccessoryDto): Observable<T> {
    return this.apiService.put<T>(`${this.endpoint}/${id}`, data);
  }

  delete(id: number): Observable<boolean> {
    return this.apiService.delete<boolean>(`${this.endpoint}/${id}`);
  }

  restore(id: number): Observable<boolean> {
    return this.apiService.post<boolean>(`${this.endpoint}/${id}/restore`, {});
  }

  permanentDelete(id: number): Observable<boolean> {
    return this.apiService.delete<boolean>(`${this.endpoint}/${id}/permanent`);
  }

  create<T = AccessoryDto>(
    data: CreateUpdateAccessoryDto,
    file?: File | null
  ): Observable<T> {
    const formData = this.buildCreateFormData(data, file);
    return this.apiService.post<T>(this.endpoint, formData);
  }

  getFileInfo(accessoryId: number): Observable<{ id: number; url: string } | null> {
    return this.fileUploadService.getFilesByEntity(FileEntityType.Accessory, accessoryId).pipe(
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

  getImageUrl(accessoryId: number): Observable<string | null> {
    return this.getFileInfo(accessoryId).pipe(
      map((fileInfo) => fileInfo?.url || null)
    );
  }

  getFileBlob(fileId: number): Observable<Blob> {
    const imageUrl = this.fileUploadService.getFileDownloadUrl(fileId);
    return this.http.get(imageUrl, { responseType: 'blob' });
  }

  deleteFile(fileId: number): Observable<boolean> {
    return this.fileUploadService.deleteFile(fileId);
  }

  uploadFile(accessoryId: number, file: File, isMain: boolean = true): Observable<number> {
    return this.fileUploadService.uploadFile(file, FileEntityType.Accessory, accessoryId, isMain);
  }

  updateImage(accessoryId: number, file: File, existingFileId: number | null): Observable<number> {
    const upload$ = this.uploadFile(accessoryId, file, true);

    if (existingFileId) {
      return this.deleteFile(existingFileId).pipe(
        switchMap(() => upload$),
        catchError(() => upload$)
      );
    }
    return upload$;
  }

  getImageBlobUrl(accessoryId: number): Observable<string | null> {
    return this.getImageUrl(accessoryId).pipe(
      map((imageUrl) => imageUrl || null),
      catchError(() => of(null))
    );
  }

  importData(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/Import`, formData, params);
  }

  importPreview(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(`${this.endpoint}/ImportPreview`, formData, params);
  }

  generateImportTemplate(language: string = 'en'): Observable<Blob> {
    const params = new HttpParams().set('language', language);
    return this.http.get(`${this.config.apiUrl}${this.endpoint}/template`, { params, responseType: 'blob' });
  }

  private buildCreateFormData(
    data: CreateUpdateAccessoryDto,
    file?: File | null
  ): FormData {
    const formData = new FormData();
    (Object.keys(data) as (keyof CreateUpdateAccessoryDto)[]).forEach(key => {
      const val = data[key];
      if (val === undefined || val === null) return;
      const capKey = key.charAt(0).toUpperCase() + key.slice(1);
      formData.append(capKey, val.toString());
    });

    if (file) {
      formData.append('files', file);
    }

    return formData;
  }
}

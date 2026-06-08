import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError } from 'rxjs';
import { ConfigService } from '@services/config.service';
import { ApiService } from '@services/api.service';
import { APIOperationResponse, PagedRequest, PaginatedList } from '@models/api-response.model';
import { AccessoryDto, CreateUpdateAccessoryDto } from '@models/accessory.model';
import { FileUploadDto } from '@models/file-upload.model';
import { IImportableService } from '@core/interfaces/importable-service.interface';
import { ImportResult } from '@models/import-result.model';

export interface AccessoryUpdateOptions {
  file?: File | null;
  removeImage?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccessoryService implements IImportableService {
  private readonly endpoint = '/Accessory';

  constructor(
    private apiService: ApiService,
    private http: HttpClient,
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

  update<T = AccessoryDto>(
    id: number,
    data: CreateUpdateAccessoryDto,
    options?: AccessoryUpdateOptions
  ): Observable<APIOperationResponse<T>> {
    const formData = this.buildFormData(data, options);
    return this.apiService.putRaw<T>(`${this.endpoint}/${id}`, formData);
  }

  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}`);
  }

  restore(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.postRaw<boolean>(`${this.endpoint}/${id}/restore`, {});
  }

  permanentDelete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}/permanent`);
  }

  create<T = AccessoryDto>(
    data: CreateUpdateAccessoryDto,
    file?: File | null
  ): Observable<APIOperationResponse<T>> {
    const formData = this.buildFormData(data, { file });
    return this.apiService.postRaw<T>(this.endpoint, formData);
  }

  /** Download main accessory image via Accessory API (not FileUpload). */
  getImageBlob(accessoryId: number): Observable<Blob> {
    const url = `${this.config.apiUrl}${this.endpoint}/${accessoryId}/image`;
    return this.http.get(url, { responseType: 'blob' });
  }

  getMainImageFileId(images?: FileUploadDto[] | null): number | null {
    if (!images?.length) return null;
    const mainImages = images.filter(img => img.isMain);
    const pool = mainImages.length > 0 ? mainImages : images;
    const latest = pool.reduce((a, b) => (a.id > b.id ? a : b));
    return latest?.id ?? null;
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

  private buildFormData(
    data: CreateUpdateAccessoryDto,
    options?: AccessoryUpdateOptions
  ): FormData {
    const formData = new FormData();
    (Object.keys(data) as (keyof CreateUpdateAccessoryDto)[]).forEach(key => {
      const val = data[key];
      if (val === undefined || val === null) return;
      const capKey = key.charAt(0).toUpperCase() + key.slice(1);
      formData.append(capKey, val.toString());
    });

    if (options?.file) {
      formData.append('files', options.file);
    }
    if (options?.removeImage) {
      formData.append('removeImage', 'true');
    }

    return formData;
  }
}

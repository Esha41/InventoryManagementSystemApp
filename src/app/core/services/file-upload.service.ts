import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { APIOperationResponse } from '@models/api-response.model';
import { API_ENDPOINTS } from '@constants/app.constants';

/**
 * Enum to identify which domain entity a file belongs to.
 * Maps to backend FileEntityType enum.
 */
export enum FileEntityType {
  Ammunition = 1,
  Order = 2,
  Workflow = 3,
  WorkflowApproval = 4,
  Supply = 5,
  Return = 6,
  Weapon = 7,
  Explosive = 8
}

/**
 * File upload DTO matching backend structure
 */
export interface FileUploadDto {
  id: number;
  fileUrl: string;
  fileName: string;
  originalName: string;
  isMain: boolean;
  entity: number;
  entityId: number;
}

/**
 * File upload service for handling file operations
 * Supports uploading, retrieving, deleting, and managing files
 */
@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  constructor(
    private apiService: ApiService,
    private config: ConfigService
  ) { }

  /**
   * Upload a single file and link it to an entity
   * @param file The file to upload
   * @param entity The entity type (FileEntityType enum value)
   * @param entityId The ID of the entity
   * @param isMain Whether this file should be marked as the main file
   * @returns Observable with the uploaded file master ID
   */
  uploadFile(
    file: File,
    entity: FileEntityType,
    entityId: number,
    isMain: boolean = false
  ): Observable<number> {
    if (!file) {
      return throwError(() => new Error('No file provided'));
    }

    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    params.append('entity', entity.toString());
    params.append('entityId', entityId.toString());
    params.append('isMain', isMain.toString());

    return this.apiService.postWithAuth<APIOperationResponse<number>>(
      `${API_ENDPOINTS.FILE_UPLOAD.UPLOAD}?${params.toString()}`,
      formData
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to upload file');
        }
        return response.data ?? 0;
      }),
      catchError(error => {
        this.config.logError('Failed to upload file', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Upload multiple files and link them to an entity
   * @param files Array of files to upload
   * @param entity The entity type (FileEntityType enum value)
   * @param entityId The ID of the entity
   * @returns Observable with array of uploaded file detail IDs
   */
  uploadFilesForEntity(
    files: File[],
    entity: FileEntityType,
    entityId: number
  ): Observable<number[]> {
    if (!files || files.length === 0) {
      return throwError(() => new Error('No files provided'));
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const params = new URLSearchParams();
    params.append('entity', entity.toString());
    params.append('entityId', entityId.toString());

    return this.apiService.postWithAuth<APIOperationResponse<number[]>>(
      `${API_ENDPOINTS.FILE_UPLOAD.UPLOAD_FOR_ENTITY}?${params.toString()}`,
      formData
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to upload files');
        }
        return response.data ?? [];
      }),
      catchError(error => {
        this.config.logError('Failed to upload files', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all files for a specific entity
   * @param entity The entity type (FileEntityType enum value)
   * @param entityId The ID of the entity
   * @returns Observable with array of file upload DTOs
   */
  getFilesByEntity(
    entity: FileEntityType,
    entityId: number
  ): Observable<FileUploadDto[]> {
    const params = new HttpParams()
      .set('entity', entity.toString())
      .set('entityId', entityId.toString());

    return this.apiService.getWithAuth<APIOperationResponse<FileUploadDto[]>>(
      API_ENDPOINTS.FILE_UPLOAD.BASE,
      params
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to retrieve files');
        }
        return response.data ?? [];
      }),
      catchError(error => {
        this.config.logError('Failed to get files by entity', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a single file by its ID
   * @param id The file master ID
   * @returns Observable with file upload DTO
   */
  getFileById(id: number): Observable<FileUploadDto> {
    return this.apiService.getWithAuth<APIOperationResponse<FileUploadDto>>(
      API_ENDPOINTS.FILE_UPLOAD.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to retrieve file');
        }
        if (!response.data) {
          throw new Error('File not found');
        }
        return response.data;
      }),
      catchError(error => {
        this.config.logError(`Failed to get file ${id}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a file by its ID
   * @param id The file master ID
   * @returns Observable with boolean indicating success
   */
  deleteFile(id: number): Observable<boolean> {
    return this.apiService.deleteWithAuth<APIOperationResponse<boolean>>(
      API_ENDPOINTS.FILE_UPLOAD.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete file');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to delete file ${id}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Set a file as the main file for its entity
   * @param id The file master ID
   * @returns Observable with boolean indicating success
   */
  setMainFile(id: number): Observable<boolean> {
    return this.apiService.putWithAuth<APIOperationResponse<boolean>>(
      API_ENDPOINTS.FILE_UPLOAD.SET_MAIN(id),
      {}
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to set main file');
        }
        return response.data ?? false;
      }),
      catchError(error => {
        this.config.logError(`Failed to set main file ${id}`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the download URL for a file
   * @param id The file master ID
   * @returns The URL to download/serve the file
   */
  getFileDownloadUrl(id: number): string {
    const baseUrl = this.config.apiUrl;
    return `${baseUrl}${API_ENDPOINTS.FILE_UPLOAD.SERVE(id)}`;
  }

  /**
   * Get the download URL for a file by path
   * @param path The relative file path
   * @returns The URL to download/serve the file
   */
  getFileDownloadUrlByPath(path: string): string {
    const baseUrl = this.config.apiUrl;
    const params = new URLSearchParams();
    params.append('path', path);
    return `${baseUrl}${API_ENDPOINTS.FILE_UPLOAD.SERVE_BY_PATH}?${params.toString()}`;
  }
}


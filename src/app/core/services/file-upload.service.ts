import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { FileUploadDto, FileEntityType } from '@models/file-upload.model';
import { ErrorHandler } from '@utils/error-handler.utils';

// Re-export for backward compatibility
export { FileUploadDto, FileEntityType };

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

    return this.apiService.post<number>(
      `${API_ENDPOINTS.FILE_UPLOAD.UPLOAD}?${params.toString()}`,
      formData
    ).pipe(
      catchError(error => {
        this.config.logError('Failed to upload file', error);
        // Extract error message from HTTP error response
        const errorMessage = this.extractErrorMessage(error);
        return throwError(() => new Error(errorMessage));
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

    return this.apiService.post<number[]>(
      `${API_ENDPOINTS.FILE_UPLOAD.UPLOAD_FOR_ENTITY}?${params.toString()}`,
      formData
    ).pipe(
      catchError(error => {
        this.config.logError('Failed to upload files', error);
        // Extract error message from HTTP error response
        const errorMessage = this.extractErrorMessage(error);
        return throwError(() => new Error(errorMessage));
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

    return this.apiService.get<FileUploadDto[]>(API_ENDPOINTS.FILE_UPLOAD.BASE, params).pipe(
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
    return this.apiService.get<FileUploadDto>(API_ENDPOINTS.FILE_UPLOAD.BY_ID(id)).pipe(
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
    return this.apiService.delete<boolean>(API_ENDPOINTS.FILE_UPLOAD.BY_ID(id)).pipe(
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
    return this.apiService.put<boolean>(API_ENDPOINTS.FILE_UPLOAD.SET_MAIN(id), {}).pipe(
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

  /**
   * Extract error message from HTTP error response
   * Handles various error response formats from the backend
   */
  private extractErrorMessage(error: unknown): string {
    return ErrorHandler.extractErrorMessage(error, 'Failed to upload file. Please try again.');
  }
}


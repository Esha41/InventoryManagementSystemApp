import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '@services/api.service';
import { ConfigService } from '@services/config.service';
import { EmployeeDto } from '@core/models/asset.model';
import { CreateUpdateEmployeeDto } from '@core/models/employee.model';
import { APIOperationResponse } from '@models/api-response.model';
import { ImportResult } from '@models/import-result.model';
import { IImportableService } from '@core/interfaces/importable-service.interface';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService implements IImportableService {
  private readonly baseEndpoint = '/Employee';

  constructor(
    private apiService: ApiService,
    private config: ConfigService,
    private http: HttpClient
  ) { }

  /**
   * Get all employees for assignment dropdowns
   */
  getEmployees(): Observable<EmployeeDto[]> {
    this.config.log('Fetching employees for weapon supply review');

    return this.apiService.get<EmployeeDto[]>(this.baseEndpoint).pipe(
      map(response => Array.isArray(response) ? response : []),
      catchError(error => {
        this.config.logError('Failed to fetch employees', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create a new employee
   */
  createEmployee(dto: CreateUpdateEmployeeDto): Observable<number> {
    this.config.log('Creating employee', dto);

    return this.apiService.post<number>(this.baseEndpoint, dto).pipe(
      map(id => id),
      catchError(error => {
        this.config.logError('Failed to create employee', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get a single employee by ID
   */
  getEmployeeById(id: number): Observable<EmployeeDto> {
    this.config.log('Fetching employee by id', id);

    return this.apiService.get<EmployeeDto>(`${this.baseEndpoint}/${id}`).pipe(
      catchError(error => {
        this.config.logError('Failed to fetch employee', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing employee
   */
  updateEmployee(id: number, dto: CreateUpdateEmployeeDto): Observable<void> {
    this.config.log('Updating employee', { id, dto });

    return this.apiService.put<void>(`${this.baseEndpoint}/${id}`, dto).pipe(
      catchError(error => {
        this.config.logError('Failed to update employee', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete an employee
   */
  deleteEmployee(id: number): Observable<boolean> {
    this.config.log('Deleting employee', id);

    return this.apiService.delete<boolean>(`${this.baseEndpoint}/${id}`).pipe(
      map(response => (typeof response === 'boolean' ? response : true)),
      catchError(error => {
        this.config.logError('Failed to delete employee', error);
        return throwError(() => error);
      })
    );
  }

  generateImportTemplate(language: string = 'en'): Observable<Blob> {
    const url = `${this.config.apiUrl}${this.baseEndpoint}/template`;
    const params = new HttpParams().set('language', language);
    return this.http.get(url, { params, responseType: 'blob' });
  }

  importPreview(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(
      `${this.baseEndpoint}/import-preview`,
      formData,
      { params }
    );
  }

  importData(file: File, language: string = 'en'): Observable<APIOperationResponse<ImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new HttpParams().set('language', language);
    return this.apiService.postRaw<ImportResult>(
      `${this.baseEndpoint}/import`,
      formData,
      { params }
    );
  }

  exportEmployees(language: string = 'en'): Observable<Blob> {
    const url = `${this.config.apiUrl}${this.baseEndpoint}/export`;
    const params = new HttpParams().set('language', language);
    return this.http.get(url, { params, responseType: 'blob' });
  }
}


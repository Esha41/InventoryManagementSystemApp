import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { EmployeeDto } from '@core/models/asset.model';
import { CreateUpdateEmployeeDto } from '@core/models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private readonly baseEndpoint = '/Employee';

  constructor(
    private apiService: ApiService,
    private config: ConfigService
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
}


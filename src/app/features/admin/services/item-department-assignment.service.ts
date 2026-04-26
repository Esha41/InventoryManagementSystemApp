import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { ItemDepartmentAssignmentDto, CreateUpdateItemDepartmentAssignmentDto, DepartmentAssignmentSummaryDto } from '@models/item-department-assignment.model';
import { API_ENDPOINTS } from '@constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class ItemDepartmentAssignmentService {
  constructor(private apiService: ApiService) { }

  getAll(): Observable<ItemDepartmentAssignmentDto[]> {
    return this.apiService.get<ItemDepartmentAssignmentDto[]>(API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE);
  }

  getDepartmentSummaries(): Observable<DepartmentAssignmentSummaryDto[]> {
    return this.apiService.get<DepartmentAssignmentSummaryDto[]>(API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.SUMMARY);
  }

  getById(id: number): Observable<ItemDepartmentAssignmentDto> {
    return this.apiService.get<ItemDepartmentAssignmentDto>(`${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/${id}`);
  }

  getByDepartmentId(departmentId: number): Observable<ItemDepartmentAssignmentDto[]> {
    return this.apiService.get<ItemDepartmentAssignmentDto[]>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/department/${departmentId}`
    );
  }

  getByItemId(itemId: number): Observable<ItemDepartmentAssignmentDto[]> {
    return this.apiService.get<ItemDepartmentAssignmentDto[]>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/item/${itemId}`
    );
  }

  create(dto: CreateUpdateItemDepartmentAssignmentDto): Observable<number> {
    return this.apiService.post<number>(API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE, dto);
  }

  update(id: number, dto: CreateUpdateItemDepartmentAssignmentDto): Observable<boolean> {
    return this.apiService.put<boolean>(`${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/${id}`, dto);
  }

  delete(id: number): Observable<boolean> {
    return this.apiService.delete<boolean>(`${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/${id}`);
  }

  bulkAssign(assignments: CreateUpdateItemDepartmentAssignmentDto[]): Observable<boolean> {
    return this.apiService.post<boolean>(`${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/bulk`, assignments);
  }
}

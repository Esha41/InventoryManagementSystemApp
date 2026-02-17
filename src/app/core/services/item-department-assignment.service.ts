import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { APIOperationResponse } from '@models/api-response.model';
import { ItemDepartmentAssignmentDto, CreateUpdateItemDepartmentAssignmentDto, DepartmentAssignmentSummaryDto } from '@models/item-department-assignment.model';
import { API_ENDPOINTS } from '@constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class ItemDepartmentAssignmentService {
  constructor(private apiService: ApiService) { }

  getAll(): Observable<APIOperationResponse<ItemDepartmentAssignmentDto[]>> {
    return this.apiService.getWithAuth<APIOperationResponse<ItemDepartmentAssignmentDto[]>>(
      API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE
    );
  }

  getDepartmentSummaries(): Observable<APIOperationResponse<DepartmentAssignmentSummaryDto[]>> {
    return this.apiService.getWithAuth<APIOperationResponse<DepartmentAssignmentSummaryDto[]>>(
      API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.SUMMARY
    );
  }

  getById(id: number): Observable<APIOperationResponse<ItemDepartmentAssignmentDto>> {
    return this.apiService.getWithAuth<APIOperationResponse<ItemDepartmentAssignmentDto>>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/${id}`
    );
  }

  getByDepartmentId(departmentId: number): Observable<APIOperationResponse<ItemDepartmentAssignmentDto[]>> {
    return this.apiService.getWithAuth<APIOperationResponse<ItemDepartmentAssignmentDto[]>>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/department/${departmentId}`
    );
  }

  getByItemId(itemId: number): Observable<APIOperationResponse<ItemDepartmentAssignmentDto[]>> {
    return this.apiService.getWithAuth<APIOperationResponse<ItemDepartmentAssignmentDto[]>>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/item/${itemId}`
    );
  }

  create(dto: CreateUpdateItemDepartmentAssignmentDto): Observable<APIOperationResponse<number>> {
    return this.apiService.postWithAuth<APIOperationResponse<number>>(
      API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE,
      dto
    );
  }

  update(id: number, dto: CreateUpdateItemDepartmentAssignmentDto): Observable<APIOperationResponse<boolean>> {
    return this.apiService.putWithAuth<APIOperationResponse<boolean>>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/${id}`,
      dto
    );
  }

  delete(id: number): Observable<APIOperationResponse<boolean>> {
    return this.apiService.deleteWithAuth<APIOperationResponse<boolean>>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/${id}`
    );
  }

  bulkAssign(assignments: CreateUpdateItemDepartmentAssignmentDto[]): Observable<APIOperationResponse<boolean>> {
    return this.apiService.postWithAuth<APIOperationResponse<boolean>>(
      `${API_ENDPOINTS.ITEM_DEPARTMENT_ASSIGNMENT.BASE}/bulk`,
      assignments
    );
  }
}

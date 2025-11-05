import { Injectable } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { 
  WorkflowDto, 
  CreateWorkflowDto, 
  UpdateWorkflowDto,
  BackendWorkflowDto,
  BackendCreateWorkflowDto,
  BackendUpdateWorkflowDto
} from '@models/workflow.model';
import { ApiResponse } from '@models/api-response.model';

/**
 * Workflow Service
 * Handles all workflow management operations with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private workflowsSubject = new BehaviorSubject<WorkflowDto[]>([]);
  public workflows$ = this.workflowsSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) {}

  /**
   * Get all workflows
   */
  getWorkflows(): Observable<WorkflowDto[]> {
    this.configService.log('Fetching all workflows');

    return this.apiService.getWithAuth<ApiResponse<BackendWorkflowDto[]>>(
      API_ENDPOINTS.WORKFLOWS.ALL_LIST
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch workflows');
        }
        const rawItems = response.data || [];
        console.log('Raw workflows from API:', rawItems);
        console.log('Number of workflows:', rawItems.length);
        
        // Map backend fields to UI model expected by components
        const mapped: WorkflowDto[] = rawItems.map(w => {
          const status = w.isActive ? 'Active' : 'Inactive';
          console.log(`Workflow ${w.id} (${w.workflowName}): isActive=${w.isActive}, status=${status}`);
          return {
            id: w.id,
            name: w.workflowName,
            approvalStages: Array.isArray(w.workflowSteps) ? w.workflowSteps.length : 0,
            status: status,
            workflowType: w.workflowType,
            workflowTypeName: (w as any).workflowTypeName || undefined
          };
        });
        
        const activeCount = mapped.filter(w => w.status === 'Active').length;
        console.log(`Total workflows: ${mapped.length}, Active: ${activeCount}, Inactive: ${mapped.length - activeCount}`);
        
        return mapped;
      }),
      tap(workflows => {
        this.workflowsSubject.next(workflows);
        this.configService.log(`Fetched ${workflows.length} workflows`);
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch workflows', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch workflows'
        ));
      })
    );
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(id: number): Observable<WorkflowDto> {
    this.configService.log('Fetching workflow', { id });

    return this.apiService.getWithAuth<ApiResponse<WorkflowDto>>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to fetch workflow');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch workflow', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch workflow'
        ));
      })
    );
  }

  /**
   * Get workflow (backend shape) by id for view page
   */
  getWorkflowDetailById(id: number): Observable<any> {
    this.configService.log('Fetching workflow detail', { id });

    return this.apiService.getWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to fetch workflow');
        }
        return response.data;
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch workflow detail', error);
        return throwError(() => new Error(error.message || 'Failed to fetch workflow'));
      })
    );
  }

  /**
   * Create new workflow
   */
  createWorkflow(workflow: CreateWorkflowDto): Observable<WorkflowDto> {
    this.configService.log('Creating workflow', { name: workflow.name });

    return this.apiService.postWithAuth<ApiResponse<WorkflowDto>>(
      API_ENDPOINTS.WORKFLOWS.BASE,
      workflow
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to create workflow');
        }
        return response.data;
      }),
      tap(newWorkflow => {
        // Update local workflows list
        const currentWorkflows = this.workflowsSubject.value;
        this.workflowsSubject.next([...currentWorkflows, newWorkflow]);
        this.configService.log('Workflow created successfully', { id: newWorkflow.id });
      }),
      catchError(error => {
        this.configService.logError('Failed to create workflow', error);
        return throwError(() => new Error(
          error.message || 'Failed to create workflow'
        ));
      })
    );
  }

  /**
   * Create workflow via backend contract (Swagger model)
   */
  createBackendWorkflow(payload: BackendCreateWorkflowDto): Observable<boolean> {
    this.configService.log('Creating backend workflow', { name: payload.workflowName });

    return this.apiService.postWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.WORKFLOWS.BASE,
      payload
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to create workflow');
        }
        return true;
      }),
      tap(() => this.configService.log('Backend workflow created successfully')),
      catchError(error => {
        this.configService.logError('Failed to create backend workflow', error);
        return throwError(() => new Error(error.message || 'Failed to create workflow'));
      })
    );
  }

  /**
   * Update workflow via backend contract (Swagger model)
   */
  updateBackendWorkflow(payload: BackendUpdateWorkflowDto): Observable<boolean> {
    this.configService.log('Updating backend workflow', { id: payload.id });

    return this.apiService.putWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.WORKFLOWS.BASE,
      payload
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to update workflow');
        }
        return true;
      }),
      tap(() => this.configService.log('Backend workflow updated successfully')),
      catchError(error => {
        this.configService.logError('Failed to update backend workflow', error);
        return throwError(() => new Error(error.message || 'Failed to update workflow'));
      })
    );
  }

  /**
   * Update existing workflow
   */
  updateWorkflow(id: number, workflow: UpdateWorkflowDto): Observable<WorkflowDto> {
    this.configService.log('Updating workflow', { id });

    return this.apiService.putWithAuth<ApiResponse<WorkflowDto>>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id),
      { ...workflow, id }
    ).pipe(
      map(response => {
        if (!response.succeeded || !response.data) {
          throw new Error(response.message || 'Failed to update workflow');
        }
        return response.data;
      }),
      tap(updatedWorkflow => {
        // Update local workflows list
        const currentWorkflows = this.workflowsSubject.value;
        const index = currentWorkflows.findIndex(w => w.id === id);
        if (index !== -1) {
          currentWorkflows[index] = updatedWorkflow;
          this.workflowsSubject.next([...currentWorkflows]);
        }
        this.configService.log('Workflow updated successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to update workflow', error);
        return throwError(() => new Error(
          error.message || 'Failed to update workflow'
        ));
      })
    );
  }

  /**
   * Delete workflow
   */
  deleteWorkflow(id: number): Observable<boolean> {
    this.configService.log('Deleting workflow', { id });

    return this.apiService.deleteWithAuth<ApiResponse<any>>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id)
    ).pipe(
      map(response => {
        if (!response.succeeded) {
          throw new Error(response.message || 'Failed to delete workflow');
        }
        return true;
      }),
      tap(() => {
        // Remove from local workflows list
        const currentWorkflows = this.workflowsSubject.value;
        this.workflowsSubject.next(currentWorkflows.filter(w => w.id !== id));
        this.configService.log('Workflow deleted successfully', { id });
      }),
      catchError(error => {
        this.configService.logError('Failed to delete workflow', error);
        return throwError(() => new Error(
          error.message || 'Failed to delete workflow'
        ));
      })
    );
  }
}


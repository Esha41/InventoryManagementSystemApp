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
  BackendUpdateWorkflowDto,
  WorkflowType,
  WORKFLOW_TYPE_NAMES,
  WorkflowTypeItem,
  WorkflowStepNotifierDto,
  UpdateWorkflowStepNotifiersDto,
  CreateWorkflowStepNotifierDto,
  WorkflowStepDto
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
  ) { }

  getWorkflowTypeItems(lang: 'en' | 'ar'): WorkflowTypeItem[] {
    return Object.values(WorkflowType)
      .filter(v => typeof v === 'number')
      .map(id => ({
        id: id as number,
        name: WORKFLOW_TYPE_NAMES[id as WorkflowType][lang]
      }));
  }

  /**
   * Convert string enum value (from backend) to numeric ID
   */
  private convertWorkflowTypeToId(workflowType: any): number {
    if (typeof workflowType === 'number') {
      return workflowType;
    }

    // Handle string enum values from backend
    const stringValue = String(workflowType);
    switch (stringValue) {
      case 'NormalOrder': return WorkflowType.NormalOrder;
      case 'OrderFromAllowance': return WorkflowType.OrderFromAllowance;
      case 'Return': return WorkflowType.Return;
      case 'Discard': return WorkflowType.Discard;
      case 'NormalOrderForTrainingPurpose': return WorkflowType.NormalOrderForTrainingPurpose;
      case 'NormalOrder_Weapon': return WorkflowType.NormalOrder_Weapon;
      case 'OrderFromAllowance_Weapon': return WorkflowType.OrderFromAllowance_Weapon;
      case 'NormalOrderForTrainingPurpose_Weapon': return WorkflowType.NormalOrderForTrainingPurpose_Weapon;
      case 'Return_Weapon': return WorkflowType.Return_Weapon;
      default:
        return 0;
    }
  }

  getWorkflowTypeNameById(id: number | string, lang: 'en' | 'ar'): string {
    // Convert to numeric ID if string
    const numericId = this.convertWorkflowTypeToId(id);
    const workflow = WORKFLOW_TYPE_NAMES[numericId as WorkflowType];
    return workflow ? workflow[lang] : 'Unknown';
  }

  /**
   * Get all workflows
   */
  getWorkflows(): Observable<WorkflowDto[]> {
    this.configService.log('Fetching all workflows');

    return this.apiService.get<BackendWorkflowDto[]>(
      API_ENDPOINTS.WORKFLOWS.ALL_LIST
    ).pipe(
      map(rawItems => {

        // Map backend fields to UI model expected by components
        const mapped: WorkflowDto[] = rawItems.map(w => {
          const status = w.isActive ? 'Active' : 'Inactive';
          const numericWorkflowType = this.convertWorkflowTypeToId(w.workflowType);
          return {
            id: w.id,
            name: w.workflowName,
            approvalStages: Array.isArray(w.workflowSteps) ? w.workflowSteps.length : 0,
            status: status,
            workflowType: numericWorkflowType,
            workflowTypeName: (w as any).workflowTypeName || undefined
          };
        });

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

    return this.apiService.get<WorkflowDto>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id)
    ).pipe(
      map(data => {
        if (!data) {
          throw new Error('Failed to fetch workflow');
        }
        return data;
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

    return this.apiService.get<any>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id)
    ).pipe(
      map(data => {
        if (!data) {
          throw new Error('Failed to fetch workflow');
        }
        const steps = data.workflowSteps as WorkflowStepDto[] | undefined;
        if (steps?.length) {
          return {
            ...data,
            workflowSteps: [...steps].sort(
              (a, b) => (a.stepOrder || 0) - (b.stepOrder || 0)
            )
          };
        }
        return data;
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

    return this.apiService.post<WorkflowDto>(
      API_ENDPOINTS.WORKFLOWS.BASE,
      workflow
    ).pipe(
      map(data => {
        if (!data) {
          throw new Error('Failed to create workflow');
        }
        return data;
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

    return this.apiService.post<any>(
      API_ENDPOINTS.WORKFLOWS.BASE,
      payload
    ).pipe(
      map(() => {
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

    return this.apiService.put<any>(
      API_ENDPOINTS.WORKFLOWS.BASE,
      payload
    ).pipe(
      map(() => {
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

    return this.apiService.put<WorkflowDto>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id),
      { ...workflow, id }
    ).pipe(
      map(data => {
        if (!data) {
          throw new Error('Failed to update workflow');
        }
        return data;
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

    return this.apiService.delete<any>(
      API_ENDPOINTS.WORKFLOWS.BY_ID(id)
    ).pipe(
      map(() => {
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

  /**
   * Get notifiers for a workflow step
   */
  getStepNotifiers(stepId: number): Observable<WorkflowStepNotifierDto[]> {
    this.configService.log('Fetching step notifiers', { stepId });

    return this.apiService.get<WorkflowStepNotifierDto[]>(
      API_ENDPOINTS.WORKFLOW_STEP_NOTIFIERS.BY_STEP_ID(stepId)
    ).pipe(
      map(data => {
        return data || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch step notifiers', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch step notifiers'
        ));
      })
    );
  }

  /**
   * Update notifiers for a workflow step
   */
  updateStepNotifiers(stepId: number, roleIds: string[], userIds?: string[]): Observable<boolean> {
    this.configService.log('Updating step notifiers', { stepId, roleIds, userIds });

    const payload = {
      workflowStepId: stepId,
      roleIds: roleIds || [],
      userIds: userIds || []
    };

    return this.apiService.put<boolean>(
      API_ENDPOINTS.WORKFLOW_STEP_NOTIFIERS.UPDATE_STEP(stepId),
      payload
    ).pipe(
      map(() => {
        return true;
      }),
      catchError(error => {
        this.configService.logError('Failed to update step notifiers', error);
        return throwError(() => new Error(
          error.message || 'Failed to update step notifiers'
        ));
      })
    );
  }

  /**
   * Get next steps for a workflow step
   */
  getNextStepsForWorkflowStep(stepId: number): Observable<WorkflowStepDto[]> {
    this.configService.log('Fetching next steps for workflow step', { stepId });

    return this.apiService.get<WorkflowStepDto[]>(
      `/Workflows/step/${stepId}/next-steps`
    ).pipe(
      map(data => {
        return data || [];
      }),
      catchError(error => {
        this.configService.logError('Failed to fetch next steps', error);
        return throwError(() => new Error(
          error.message || 'Failed to fetch next steps'
        ));
      })
    );
  }

  /**
   * Set step transitions (skip-to steps)
   */
  setStepTransitions(stepId: number, targetStepIds: number[]): Observable<boolean> {
    this.configService.log('Setting step transitions', { stepId, targetStepIds });

    const payload = {
      sourceStepId: stepId,
      targetStepIds: targetStepIds || []
    };

    return this.apiService.put<boolean>(
      '/Workflows/step-transition',
      payload
    ).pipe(
      map(() => {
        return true;
      }),
      catchError(error => {
        this.configService.logError('Failed to set step transitions', error);
        return throwError(() => new Error(
          error.message || 'Failed to set step transitions'
        ));
      })
    );
  }
}



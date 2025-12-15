import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, Observable, forkJoin, throwError, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight } from 'lucide-angular';
import { WorkflowService } from '@services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto } from '@models/backend-user.model';
import { WorkflowStepDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-edit-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent, HasPermissionDirective],
  templateUrl: './edit-workflow.component.html',
  styleUrls: ['./edit-workflow.component.css']
})
export class EditWorkflowComponent implements OnInit, OnDestroy {
  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  workflowId: number | null = null;
  editForm: { id: number; name: string; status: 'Active' | 'Inactive'; workflowType?: number } | null = null;
  editWorkflowType: number = 1;
  editSteps: Array<{ 
    order: number; 
    roleId: string | null; 
    applicationEntityId: number | null; 
    requireHigherApproval?: boolean; 
    higherApprovalRoleId?: string | null; 
    higherApplicationEntityId?: number | null;
    notifyingRoleIds?: string[];
    notifyingUserIds?: string[];
    workflowStepId?: number;
    usersInNotifyingRoles?: Array<{ roleId: string; users: any[] }>;
    availableUsers?: Array<{ id: string; userName: string; roles?: string[] }>;
    skipToStepIds?: number[];
    availableNextSteps?: WorkflowStepDto[];
    canSkip?: boolean; // Preserve canSkip to maintain normal sequential flow
  }> = [];
  
  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string }> = [];
  workflowTypes: Array<{ id: number; name: string }> = [];
  readonly workflowStatusOptions = [
    { label: 'Active', value: 'Active' as const },
    { label: 'Inactive', value: 'Inactive' as const }
  ];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  allUsers: Array<{ id: string; userName: string; roles?: string[] }> = [];

  hasOpenDropdown = false;
  private mutationObserver?: MutationObserver;
  private positioningInterval?: any;
  private boundRepositionDropdowns?: () => void;
  private boundHandleDocumentClick?: () => void;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workflowService: WorkflowService,
    private translationService: TranslationService,
    private backendUserService: BackendUserService,
    private translate: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/workflow']);
      return;
    }
    this.workflowId = Number(id);
    this.loadWorkflow();
    
    this.backendUserService.getAllRolesSimple().subscribe({
      next: roles => this.roles = roles,
      error: () => this.roles = []
    });
    this.loadApplicationEntities();
    
    const lang = this.translationService.getCurrentLanguage();
    this.workflowTypes = this.workflowService.getWorkflowTypeItems(lang);
    
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadApplicationEntities();
    });

    setTimeout(() => {
      this.initializeDropdowns();
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupDropdownPositioning();
  }

  private loadApplicationEntities(): void {
    this.backendUserService.getApplicationEntities().subscribe({
      next: (entities: any[]) => {
        const currentLang = getCurrentLang(this.translate);
        this.allApplicationEntities = (entities || []).map((e: any) => {
          const id = e?.id ?? e?.applicationEntityId ?? e;
          const localizedName = getLocalizedName(e, currentLang);
          return { id, name: localizedName || String(id), entity: e };
        });
      },
      error: () => { this.allApplicationEntities = []; }
    });
  }

  private loadWorkflow(): void {
    if (!this.workflowId) return;
    
    this.loading = true;
    this.workflowService.getWorkflowDetailById(this.workflowId).subscribe({
      next: wf => {
        const status = wf?.isActive ? 'Active' : 'Inactive';
        this.editForm = { 
          id: wf?.id || this.workflowId!, 
          name: wf?.workflowName || '', 
          status: status as 'Active' | 'Inactive',
          workflowType: wf?.workflowType || 1
        };
        this.editWorkflowType = wf?.workflowType || 1;
        const steps = (wf?.workflowSteps || []) as any[];
        
        // Sort steps by stepOrder to ensure correct order, then load workflow steps exactly as they are
        // Each step maintains its own identity - skip steps don't affect other steps
        const sortedSteps = [...steps].sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        
        // Load workflow steps exactly as they are - no modification
        // Only extract transition step IDs to display in dropdown
        this.editSteps = sortedSteps.map((s, idx) => {
          // Extract transition step IDs (skip-to steps) - only for display in dropdown
          // These are read-only for display purposes, workflow data remains unchanged
          let skipToStepIds: number[] = [];
          if (Array.isArray((s as any).transitions) && (s as any).transitions.length > 0) {
            skipToStepIds = (s as any).transitions
              .map((t: any) => t.targetWorkflowStepId)
              .filter((id: any) => id != null && id !== undefined);
          } else if (Array.isArray((s as any).allowedSkipTargetIds)) {
            // Fallback to allowedSkipTargetIds if transitions not available
            skipToStepIds = [...(s as any).allowedSkipTargetIds];
          }
          
          // Load step data as-is from backend - no modification
          // Each step maintains its own identity and order, independent of skip steps
          // Preserve canSkip to ensure normal sequential flow (skip steps are optional, not default)
          return {
            order: s.stepOrder || (idx + 1), // Always use stepOrder from backend, preserve step's own order
            roleId: s.applicationRoleId || null, 
            applicationEntityId: s.applicationEntityId || null,
            requireHigherApproval: !!s.requireHigherApproval,
            higherApprovalRoleId: s.higherApprovalRoleId || null,
            higherApplicationEntityId: (s as any).higherApplicationEntityId || null,
            notifyingRoleIds: [],
            notifyingUserIds: [],
            workflowStepId: s.id, // Keep step ID as-is from backend - each step has unique ID
            usersInNotifyingRoles: [],
            availableUsers: [],
            skipToStepIds: skipToStepIds, // Transition steps - only for dropdown display, doesn't affect step identity
            availableNextSteps: [], // Will be populated for dropdown options
            canSkip: (s as any).canSkip === true // Preserve canSkip - false by default to maintain normal sequential flow
          };
        });
        
        this.loadNotifiersForSteps(() => {
          this.loadAllUsers(() => {
            this.loadAllUsersForSteps();
            this.loadNextStepsForAllSteps();
          });
        });
        
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load workflow';
        this.loading = false;
      }
    });
  }

  private initializeDropdowns(): void {
    const stepsContainer = document.querySelector('.edit-steps-table-wrapper');
    if (!stepsContainer) return;

    this.mutationObserver = new MutationObserver(() => {
      this.checkAndPositionDropdowns();
    });

    this.mutationObserver.observe(stepsContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    this.boundHandleDocumentClick = () => {
      setTimeout(() => this.checkAndPositionDropdowns(), 0);
    };
    document.addEventListener('click', this.boundHandleDocumentClick);
    
    this.checkAndPositionDropdowns();
  }

  private cleanupDropdownPositioning(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }
    if (this.positioningInterval) {
      clearInterval(this.positioningInterval);
      this.positioningInterval = undefined;
    }
    if (this.boundRepositionDropdowns) {
      document.removeEventListener('scroll', this.boundRepositionDropdowns, true);
    }
    if (this.boundHandleDocumentClick) {
      document.removeEventListener('click', this.boundHandleDocumentClick);
      this.boundHandleDocumentClick = undefined;
    }
    this.resetDropdownPanels();
  }

  private resetDropdownPanels(): void {
    document.querySelectorAll('.app-dropdown-panel').forEach((panel: any) => {
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
      panel.style.width = '';
      panel.style.maxWidth = '';
    });
  }

  private checkAndPositionDropdowns(): void {
    const openDropdowns = document.querySelectorAll('.app-dropdown-open');
    this.hasOpenDropdown = openDropdowns.length > 0;
    
    if (this.hasOpenDropdown) {
      this.repositionDropdowns();
      if (!this.positioningInterval) {
        if (!this.boundRepositionDropdowns) {
          this.boundRepositionDropdowns = this.repositionDropdowns.bind(this);
        }
        document.addEventListener('scroll', this.boundRepositionDropdowns, true);
        this.positioningInterval = setInterval(() => {
          if (this.hasOpenDropdown) {
            this.repositionDropdowns();
          } else {
            this.stopPositioningInterval();
          }
        }, 100);
      }
    } else {
      this.stopPositioningInterval();
      this.resetDropdownPanels();
    }
  }

  private stopPositioningInterval(): void {
    if (this.positioningInterval) {
      clearInterval(this.positioningInterval);
      this.positioningInterval = undefined;
      if (this.boundRepositionDropdowns) {
        document.removeEventListener('scroll', this.boundRepositionDropdowns, true);
      }
    }
  }

  private repositionDropdowns(): void {
    const scrollContainer = document.querySelector('.edit-steps-table-scroll-container');
    if (!scrollContainer) return;

    document.querySelectorAll('.app-dropdown-open').forEach((trigger: any) => {
      const dropdown = trigger.closest('.app-dropdown');
      const panel = dropdown?.querySelector('.app-dropdown-panel') as HTMLElement;
      
      if (!panel || !scrollContainer.contains(dropdown)) return;

      const rect = trigger.getBoundingClientRect();
      Object.assign(panel.style, {
        position: 'fixed',
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        minWidth: `${rect.width}px`,
        maxWidth: `${rect.width}px`,
        zIndex: '10000',
        right: 'auto'
      });
    });
  }

  addEditStep(): void { 
    const newStep = { 
      order: this.editSteps.length + 1, 
      roleId: null, 
      applicationEntityId: null, 
      requireHigherApproval: false, 
      higherApprovalRoleId: null, 
      higherApplicationEntityId: null,
      notifyingRoleIds: [],
      notifyingUserIds: [],
      usersInNotifyingRoles: [],
      availableUsers: [],
      skipToStepIds: [],
      availableNextSteps: [],
      canSkip: false // New steps default to normal sequential flow
    };
    this.editSteps.push(newStep);
    setTimeout(() => {
      // If users haven't been loaded yet, load them first
      if (this.allUsers.length === 0) {
        this.loadAllUsers(() => {
          this.loadUsersForNotifyingRoles(newStep, this.editSteps.length - 1);
          // Recalculate next steps for all steps after adding new step
          this.loadNextStepsForAllSteps();
        });
      } else {
        this.loadUsersForNotifyingRoles(newStep, this.editSteps.length - 1);
        // Recalculate next steps for all steps after adding new step
        this.loadNextStepsForAllSteps();
      }
    }, 0);
  }

  removeEditStep(index: number): void { 
    this.editSteps.splice(index, 1); 
    this.editSteps = this.editSteps.map((s, i) => ({ ...s, order: i + 1 })); 
    // Recalculate next steps for all steps after removal
    this.loadNextStepsForAllSteps();
  }

  onCancel(): void {
    this.router.navigate(['/workflow']);
  }

  saveEdit(): void {
    if (!this.editForm) return;
    const editId = this.editForm.id;
    
    // Capture notifier data directly from editSteps at save time
    // Ensure arrays are properly initialized
    const notifierData = this.editSteps.map((s, idx) => {
      // Ensure arrays exist and are properly formatted
      const roleIds = Array.isArray(s.notifyingRoleIds) ? [...s.notifyingRoleIds] : [];
      const userIds = Array.isArray(s.notifyingUserIds) ? [...s.notifyingUserIds] : [];
      
      console.log(`Step ${idx} notifiers:`, {
        workflowStepId: s.workflowStepId,
        roleIds,
        userIds,
        rawRoleIds: s.notifyingRoleIds,
        rawUserIds: s.notifyingUserIds
      });
      
      return {
        originalIndex: idx,
        workflowStepId: s.workflowStepId,
        notifyingRoleIds: roleIds,
        notifyingUserIds: userIds
      };
    });

    // Capture transition data (skip-to steps) only - create a snapshot to preserve original values
    // This ensures we only update transitions and don't accidentally modify workflow steps
    const transitionData = this.editSteps.map((s, idx) => ({
      originalIndex: idx,
      workflowStepId: s.workflowStepId,
      skipToStepIds: Array.isArray(s.skipToStepIds) ? [...s.skipToStepIds] : []
    }));
    
    const backendPayload = {
      id: editId,
      workflowName: this.editForm.name,
      workflowType: this.editWorkflowType,
      isActive: this.editForm.status === 'Active',
      isSpecialOrReserved: false,
      workflowSteps: (this.editSteps || []).map((s, idx) => ({
        id: s.workflowStepId,
        stepOrder: idx + 1,
        applicationRoleId: s.roleId as any,
        applicationEntityId: s.applicationEntityId as any,
        mustApprove: false,
        requireHigherApproval: !!s.requireHigherApproval,
        higherApprovalRoleId: s.requireHigherApproval ? (s.higherApprovalRoleId || null) : null,
        higherApplicationEntityId: s.requireHigherApproval ? (s.higherApplicationEntityId || null) : null,
        reserveQty: false,
        canSkip: s.canSkip === true, // Preserve canSkip - ensures normal sequential flow (skip steps are optional)
        notifyingRoleIds: s.notifyingRoleIds || [],
        notifyingUserIds: s.notifyingUserIds || []
      }))
    } as any;

    const updateNotifiers = (workflowSteps?: any[]): Observable<boolean> => {
      const notifierSaveObservables: Observable<boolean>[] = [];
      
      // If workflowSteps is provided (after reload), use it to map step IDs by order
      // Otherwise use the existing workflowStepId from editSteps
      this.editSteps.forEach((step, idx) => {
        // Use current values from editSteps, not the captured snapshot
        // This ensures we have the latest values even if they changed
        const currentStep = this.editSteps[idx];
        if (!currentStep) return;
        
        // For new steps, try to find the step ID from the reloaded workflow
        // Match by stepOrder (idx + 1) since steps are saved in order
        let stepId = currentStep.workflowStepId;
        if (!stepId && workflowSteps && workflowSteps.length > 0) {
          // Find step by order (stepOrder should match idx + 1)
          const matchingStep = workflowSteps.find((ws: any) => ws.stepOrder === (idx + 1));
          if (matchingStep) {
            stepId = matchingStep.id;
            console.log(`Found step ID ${stepId} for new step at index ${idx} (order ${idx + 1})`);
          }
        }
        
        if (stepId) {
          // Get current values directly from the step object
          const roleIds = Array.isArray(currentStep.notifyingRoleIds) 
            ? [...currentStep.notifyingRoleIds].filter(id => id != null && id !== '')
            : [];
          const userIds = Array.isArray(currentStep.notifyingUserIds) 
            ? [...currentStep.notifyingUserIds].filter(id => id != null && id !== '')
            : [];
          
          console.log(`Saving notifiers for step ${stepId} (index ${idx}):`, { 
            roleIds, 
            userIds,
            stepOrder: idx + 1
          });
          
          // Always call updateStepNotifiers, even if arrays are empty (to clear existing notifiers)
          notifierSaveObservables.push(
            this.workflowService.updateStepNotifiers(
              stepId,
              roleIds,
              userIds
            ).pipe(
              tap(() => {
                console.log(`Successfully saved notifiers for step ${stepId}`);
              }),
              catchError(err => {
                console.error('Failed to update notifiers for step', stepId, err);
                return new Observable<boolean>(observer => {
                  observer.next(true);
                  observer.complete();
                });
              })
            )
          );
        } else {
          console.warn(`Skipping notifiers for step at index ${idx} - no stepId found`, {
            hasWorkflowStepId: !!currentStep.workflowStepId,
            workflowStepsCount: workflowSteps?.length || 0
          });
        }
      });
      
      if (notifierSaveObservables.length === 0) {
        return of(true);
      }
      
      return forkJoin(notifierSaveObservables).pipe(
        map(() => true)
      );
    };

    const updateTransitions = (): Observable<boolean> => {
      const transitionSaveObservables: Observable<boolean>[] = [];
      
      // IMPORTANT: Only update transitions (skip-to steps) - do NOT update workflow steps
      // This function uses the captured transitionData to ensure we only save transitions
      // and preserve all original step properties (role, entity, higher approval, etc.)
      transitionData.forEach((transitionInfo) => {
        const stepId = transitionInfo.workflowStepId;
        
        // Only update transitions for existing steps (skip new steps without IDs)
        if (stepId) {
          // Use captured transition data - ensures we only update skip-to steps
          const targetStepIds = Array.isArray(transitionInfo.skipToStepIds) 
            ? [...transitionInfo.skipToStepIds].filter(id => id != null && id !== undefined)
            : [];
          
          console.log(`Updating transitions only for step ${stepId}:`, { targetStepIds });
          
          // Call API that ONLY updates transitions, does NOT touch workflow step properties
          transitionSaveObservables.push(
            this.workflowService.setStepTransitions(
              stepId,
              targetStepIds
            ).pipe(
              tap(() => {
                console.log(`Successfully updated transitions for step ${stepId} (workflow step unchanged)`);
              }),
              catchError(err => {
                console.error('Failed to update transitions for step', stepId, err);
                return new Observable<boolean>(observer => {
                  observer.next(true);
                  observer.complete();
                });
              })
            )
          );
        }
      });
      
      if (transitionSaveObservables.length === 0) {
        return of(true);
      }
      
      return forkJoin(transitionSaveObservables).pipe(
        map(() => true)
      );
    };

    this.submitting = true;
    
    // Step 1: Save the workflow (name, type, status, steps) using workflow update API
    // Step 2: Then update skip steps (transitions) using separate transitions API
    // Keep step IDs the same - no need to reload
    this.workflowService.updateBackendWorkflow(backendPayload).pipe(
      switchMap(() => {
        // After workflow is saved, update transitions (skip steps) using separate API
        // Step IDs remain the same, no reload needed
        return updateTransitions();
      }),
      catchError(err => {
        console.error('Failed to save workflow or transitions', err);
        return throwError(() => err);
      })
    ).subscribe({
      next: () => {
        this.submitting = false;
        this.translate.get(['toast.success', 'toast.workflowUpdated']).subscribe((translations: any) => {
          this.toastService.success(translations['toast.workflowUpdated'], translations['toast.success']);
        });
        
        setTimeout(() => {
          this.router.navigate(['/workflow']);
        }, 500);
      },
      error: err => {
        this.submitting = false;
        this.errorMessage = err.message || 'Failed to update workflow';
        
        this.translate.get(['toast.error', 'toast.failedToUpdateWorkflow']).subscribe((translations: any) => {
          const errorMsg = err.message || translations['toast.failedToUpdateWorkflow'] || 'Failed to update workflow';
          this.toastService.error(errorMsg, translations['toast.error']);
        });
      }
    });
  }

  private loadNotifiersForSteps(callback?: () => void): void {
    const stepsWithIds = this.editSteps.filter(step => step.workflowStepId);
    
    if (stepsWithIds.length === 0) {
      if (callback) callback();
      return;
    }
    
    const notifierObservables = stepsWithIds.map(step => 
      this.workflowService.getStepNotifiers(step.workflowStepId!).pipe(
        map(notifiers => ({ step, notifiers })),
        catchError(err => {
          return new Observable<{ step: any; notifiers: any[] }>(observer => {
            observer.next({ step, notifiers: [] });
            observer.complete();
          });
        })
      )
    );
    
    forkJoin(notifierObservables).subscribe({
      next: (results) => {
        results.forEach(({ step, notifiers }) => {
          const roleIds: string[] = [];
          const userIds: string[] = [];
          
          notifiers.forEach(notifier => {
            if (notifier.roleId) {
              roleIds.push(notifier.roleId);
            }
            if (notifier.userId) {
              userIds.push(String(notifier.userId));
            }
          });
          
          step.notifyingRoleIds = roleIds;
          step.notifyingUserIds = userIds;
        });
        
        this.cdr.detectChanges();
        
        if (callback) {
          setTimeout(() => callback(), 100);
        }
      },
      error: (err) => {
        this.editSteps.forEach(step => {
          step.notifyingRoleIds = step.notifyingRoleIds || [];
          step.notifyingUserIds = step.notifyingUserIds || [];
        });
        
        if (callback) {
          setTimeout(() => callback(), 100);
        }
      }
    });
  }

  private loadAllUsers(callback?: () => void): void {
    // Load users only once and cache them
    this.backendUserService.getUsers().subscribe({
      next: (users) => {
        this.allUsers = (users || []).map((user: any) => ({
          id: String(user.id),
          userName: user.userName || '',
          roles: user.roleIds || []
        })).sort((a: any, b: any) => 
          (a.userName || '').localeCompare(b.userName || '')
        );
        
        if (callback) {
          callback();
        }
      },
      error: (err) => {
        this.allUsers = [];
        if (callback) {
          callback();
        }
      }
    });
  }

  private loadAllUsersForSteps(): void {
    this.editSteps.forEach((step, index) => {
      step.notifyingRoleIds = step.notifyingRoleIds || [];
      step.notifyingUserIds = step.notifyingUserIds || [];
      step.availableUsers = step.availableUsers || [];
      
      setTimeout(() => {
        this.loadUsersForNotifyingRoles(step, index);
      }, 100);
    });
  }

  private loadUsersForNotifyingRoles(step: any, stepIndex: number): void {
    if (!step.usersInNotifyingRoles) {
      step.usersInNotifyingRoles = [];
    }
    if (!step.availableUsers) {
      step.availableUsers = [];
    }

    const preservedUserIds = step.notifyingUserIds 
      ? [...step.notifyingUserIds].map((id: any) => String(id))
      : [];

    // Use cached users instead of making API call
    step.availableUsers = [...this.allUsers];
    
    if (preservedUserIds.length > 0) {
      const validUserIds = preservedUserIds.filter((userId: string) => 
        step.availableUsers.some((u: any) => String(u.id) === String(userId))
      );
      step.notifyingUserIds = validUserIds.length > 0 ? [...validUserIds] : [];
    }
    
    step.availableUsers = [...step.availableUsers];
    if (step.notifyingUserIds && step.notifyingUserIds.length > 0) {
      step.notifyingUserIds = [...step.notifyingUserIds];
    } else {
      step.notifyingUserIds = [];
    }
    if (step.notifyingRoleIds && step.notifyingRoleIds.length > 0) {
      step.notifyingRoleIds = [...step.notifyingRoleIds];
    } else {
      step.notifyingRoleIds = [];
    }
    
    this.cdr.detectChanges();
  }

  onNotifyingRolesChange(stepIndex: number): void {
    const step = this.editSteps[stepIndex];
    if (!step) return;
    
    if (!step.notifyingRoleIds) {
      step.notifyingRoleIds = [];
    }
    
    if (!step.notifyingUserIds) {
      step.notifyingUserIds = [];
    }
    
    // If users haven't been loaded yet, load them first
    if (this.allUsers.length === 0) {
      this.loadAllUsers(() => {
        this.loadUsersForNotifyingRoles(step, stepIndex);
      });
    } else {
      this.loadUsersForNotifyingRoles(step, stepIndex);
    }
  }

  private loadNextStepsForAllSteps(): void {
    // Populate dropdown options for skip-to steps - only for display, no workflow modification
    this.editSteps.forEach((step, index) => {
      this.loadNextStepsForStep(step, index);
    });
  }

  private loadNextStepsForStep(step: any, stepIndex: number): void {
    // Show ALL steps in dropdown - no filtering based on order
    // This populates the dropdown options - does not modify workflow data
    // Each step maintains its own identity - skip steps don't affect step properties
    const allSteps: WorkflowStepDto[] = this.editSteps
      .map((s, idx) => {
        // Use the step's own order from backend, not array index
        // This ensures each step keeps its own identity regardless of skip configurations
        const sOrder = s.order || (idx + 1);
        return {
          id: s.workflowStepId || 0, // Each step has unique ID
          workflowId: this.workflowId || 0,
          stepOrder: sOrder, // Preserve each step's own order
          applicationRoleId: s.roleId || '', // Each step has its own role
          applicationEntityId: s.applicationEntityId || 0, // Each step has its own entity
          applicationRoleName: this.getRoleNameById(s.roleId),
          mustApprove: false,
          requireHigherApproval: !!s.requireHigherApproval, // Each step has its own higher approval settings
          higherApprovalRoleId: s.higherApprovalRoleId || null,
          higherApplicationEntityId: s.higherApplicationEntityId || null
        } as WorkflowStepDto;
      });

    // Set dropdown options - all steps are shown here for selection
    // Skip steps are just options, they don't change the step's own properties
    step.availableNextSteps = allSteps.map((ns: WorkflowStepDto) => ({
      ...ns,
      displayName: this.getStepDisplayName(ns)
    }));
    
    this.cdr.detectChanges();
  }

  getStepDisplayName(step: WorkflowStepDto): string {
    const roleName = step.applicationRoleName || this.getRoleNameById(step.applicationRoleId);
    const entityName = this.getEntityNameById(step.applicationEntityId);
    const orderLabel = this.orderLabel(step.stepOrder);
    return `${orderLabel} - ${roleName}${entityName ? ` (${entityName})` : ''}`;
  }

  onSkipToStepChange(stepIndex: number): void {
    const step = this.editSteps[stepIndex];
    if (!step) return;
    
    // Recalculate next steps when step order changes
    this.loadNextStepsForStep(step, stepIndex);
  }

  getRoleNameById(roleId?: string | null): string {
    if (!roleId) return '';
    const r = this.roles.find(role => role.id === roleId);
    return r ? getLocalizedName(r, getCurrentLang(this.translate)) || r.name : String(roleId);
  }

  getEntityNameById(entityId?: number | null): string {
    if (entityId === undefined || entityId === null) return '';
    const e = this.allApplicationEntities.find(x => x.id === entityId);
    if (e) {
      const entity = (e as any).entity;
      if (entity) {
        return getLocalizedName(entity, getCurrentLang(this.translate)) || e.name || String(e.id);
      }
      return e.name || String(e.id);
    }
    return String(entityId);
  }

  orderLabel(n: number): string {
    if (n <= 0) {
      return String(n);
    }
 
    const key = this.getOrdinalKey(n);
    if (key) {
      if (key.includes('-')) {
        return key.replace('-', ' ');
      }
      return this.translate.instant(key);
    }
 
    return this.translate.instant('workflow.stepNumber', { number: n });
  }

  private getOrdinalKey(n: number): string | null {
    const predefined: { [k: number]: string } = {
      1: 'workflow.first',
      2: 'workflow.second',
      3: 'workflow.third',
      4: 'workflow.fourth',
      5: 'workflow.fifth',
      6: 'workflow.sixth',
      7: 'workflow.seventh',
      8: 'workflow.eighth',
      9: 'workflow.ninth',
      10: 'workflow.tenth',
      11: 'workflow.eleventh',
      12: 'workflow.twelfth',
      13: 'workflow.thirteenth',
      14: 'workflow.fourteenth',
      15: 'workflow.fifteenth',
      16: 'workflow.sixteenth',
      17: 'workflow.seventeenth',
      18: 'workflow.eighteenth',
      19: 'workflow.nineteenth',
      20: 'workflow.twentieth'
    };

    if (predefined[n]) {
      return predefined[n];
    }

    const tens: { [k: number]: string } = {
      20: 'workflow.twentieth',
      30: 'workflow.thirtieth',
      40: 'workflow.fortieth',
      50: 'workflow.fiftieth',
      60: 'workflow.sixtieth',
      70: 'workflow.seventieth',
      80: 'workflow.eightieth',
      90: 'workflow.ninetieth',
      100: 'workflow.oneHundredth'
    };

    if (tens[n]) {
      return tens[n];
    }

    if (n > 20 && n < 100) {
      const ones = n % 10;
      const base = n - ones;
      const baseKey = tens[base];
      const onesKey = predefined[ones];
      if (baseKey && onesKey) {
        const baseText = this.translate.instant(baseKey).replace(/th$/i, '').trim();
        const onesText = this.translate.instant(onesKey).toLowerCase();
        return `${baseText}-${onesText}`;
      }
    }

    return null;
  }
}


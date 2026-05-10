import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, Observable, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight, GripVertical } from 'lucide-angular';
import { WorkflowService } from '@workflow/services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { RoleDto, BackendUserDto, ApplicationEntityDto } from '@models/backend-user.model';
import { PaginatedList } from '@models/api-response.model';
import { WorkflowStepDto, WorkflowStepTransitionDto, WorkflowStepNotifier, BackendWorkflowDto, BackendUpdateWorkflowDto, workflowTypeToNumber } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { TranslationMap } from '@models/common.types';
import { ConfigService } from '@services/config.service';
import { trackByIndex } from '@utils/trackby.utils';

/** Edit step form shape */
interface EditStepForm {
  order: number;
  roleId: string | null;
  applicationEntityId: number | null;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string | null;
  higherApplicationEntityId?: number | null;
  notifyingRoleIds?: string[];
  notifyingUserIds?: string[];
  /** Additional roles that may approve the same step (any-of), excluding the primary role. */
  parallelRoleIds?: string[];
  workflowStepId?: number;
  usersInNotifyingRoles?: Array<{ roleId: string; users: BackendUserDto[] }>;
  availableUsers?: Array<{ id: string; userName: string; roles?: string[] }>;
  skipToStepIds?: number[];
  availableNextSteps?: WorkflowStepDto[];
  canSkip?: boolean;
  canReturn?: boolean;
}

@Component({
  selector: 'app-edit-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DragDropModule, DropdownComponent, HasPermissionDirective],
  templateUrl: './edit-workflow.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditWorkflowComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly GripVertical = GripVertical;
  readonly trackByIndex = trackByIndex;

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  workflowId: number | null = null;
  editForm: { id: number; name: string; status: 'Active' | 'Inactive'; workflowType?: number } | null = null;
  editWorkflowType: number = 1;
  editSteps: EditStepForm[] = [];

  roles: RoleDto[] = [];
  allApplicationEntities: Array<{ id: number; name?: string; entity?: ApplicationEntityDto }> = [];
  workflowTypes: Array<{ id: number; name: string }> = [];
  readonly workflowStatusOptions = [
    { label: 'workflow.active', value: 'Active' as const },
    { label: 'workflow.inactive', value: 'Inactive' as const }
  ];

  loading = false;
  submitting = false;
  errorMessage: string | null = null;
  allUsers: Array<{ id: string; userName: string; roles?: string[] }> = [];

  hasOpenDropdown = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workflowService: WorkflowService,
    private translationService: TranslationService,
    private backendUserService: BackendUserService,
    private translate: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/workflow']);
      return;
    }
    this.workflowId = Number(id);
    this.loadWorkflow();

    this.backendUserService.getAllRolesSimple().pipe(takeUntil(this.destroy$)).subscribe({
      next: roles => { this.roles = roles; this.cdr.markForCheck(); },
      error: (err) => { this.configService.logError('Failed to load roles', err); this.roles = []; this.cdr.markForCheck(); }
    });
    this.loadApplicationEntities();

    const lang = this.translationService.getCurrentLanguage();
    this.workflowTypes = this.workflowService.getWorkflowTypeItems(lang);

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadApplicationEntities();
    });

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadApplicationEntities(): void {
    this.backendUserService.getApplicationEntities().pipe(takeUntil(this.destroy$)).subscribe({
      next: (entities: ApplicationEntityDto[]) => {
        const currentLang = getCurrentLang(this.translate);
        this.allApplicationEntities = (entities || []).map((e: ApplicationEntityDto) => {
          const id = e?.id ?? (e as ApplicationEntityDto & { applicationEntityId?: number }).applicationEntityId ?? 0;
          const localizedName = getLocalizedName(e, currentLang);
          return { id, name: localizedName || String(id), entity: e };
        });
        this.cdr.markForCheck();
      },
      error: (err) => { this.configService.logError('Failed to load application entities', err); this.allApplicationEntities = []; this.cdr.markForCheck(); }
    });
  }

  private loadWorkflow(): void {
    if (!this.workflowId) return;

    this.loading = true;
    this.workflowService.getWorkflowDetailById(this.workflowId).pipe(takeUntil(this.destroy$)).subscribe({
      next: wf => {
        const status = wf?.isActive ? 'Active' : 'Inactive';
        const numericWorkflowType = workflowTypeToNumber(wf?.workflowType ?? 1);
        this.editForm = {
          id: wf?.id || this.workflowId!,
          name: wf?.workflowName || '',
          status: status as 'Active' | 'Inactive',
          workflowType: numericWorkflowType
        };
        this.editWorkflowType = numericWorkflowType;
        const steps: WorkflowStepDto[] = wf?.workflowSteps || [];

        const sortedSteps = [...steps].sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));

        this.editSteps = sortedSteps.map((s, idx) => {
          let skipToStepIds: number[] = [];
          if (Array.isArray(s.transitions) && s.transitions.length > 0) {
            skipToStepIds = s.transitions
              .map((t: WorkflowStepTransitionDto) => t.targetWorkflowStepId)
              .filter((id: number | undefined) => id != null && id !== undefined);
          } else if (Array.isArray(s.allowedSkipTargetIds)) {
            skipToStepIds = [...s.allowedSkipTargetIds];
          }

          return {
            order: s.stepOrder || (idx + 1),
            roleId: s.applicationRoleId || null,
            applicationEntityId: s.applicationEntityId || null,
            requireHigherApproval: !!s.requireHigherApproval,
            higherApprovalRoleId: s.higherApprovalRoleId || null,
            higherApplicationEntityId: s.higherApplicationEntityId ?? s.higherApprovalApplicationEntityId ?? null,
            notifyingRoleIds: [],
            notifyingUserIds: [],
            parallelRoleIds: Array.isArray(s.parallelRoles)
              ? s.parallelRoles.map(pr => pr.roleId).filter((id: string | undefined) => !!id && id !== s.applicationRoleId)
              : [],
            workflowStepId: s.id,
            usersInNotifyingRoles: [],
            availableUsers: [],
            skipToStepIds,
            availableNextSteps: [],
            canSkip: s.canSkip === true,
            canReturn: s.canReturn === true
          };
        });

        this.loadNotifiersForSteps(() => {
          this.loadAllUsers(() => {
            this.loadAllUsersForSteps();
            this.loadNextStepsForAllSteps();
          });
        });

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.configService.logError('Failed to load workflow details', err);
        this.translate.get('toast.failedToLoadDetails').pipe(takeUntil(this.destroy$)).subscribe(msg => {
          this.errorMessage = msg;
          this.cdr.markForCheck();
        });
        this.loading = false;
        this.cdr.markForCheck();
      }
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
      parallelRoleIds: [],
      usersInNotifyingRoles: [],
      availableUsers: [],
      skipToStepIds: [],
      availableNextSteps: [],
      canSkip: false, // New steps default to normal sequential flow
      canReturn: false
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

  onStepDrop(event: CdkDragDrop<EditStepForm[]>): void {
    moveItemInArray(this.editSteps, event.previousIndex, event.currentIndex);
    this.editSteps = this.editSteps.map((s, i) => ({ ...s, order: i + 1 }));
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
    const _notifierData = this.editSteps.map((s, idx) => {
      // Ensure arrays exist and are properly formatted
      const roleIds = Array.isArray(s.notifyingRoleIds) ? [...s.notifyingRoleIds] : [];
      const userIds = Array.isArray(s.notifyingUserIds) ? [...s.notifyingUserIds] : [];

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

    // Build workflow steps payload with all properties including canReturn
    const workflowStepsPayload = this.editSteps.map((s, idx) => ({
      id: s.workflowStepId || 0,
      workflowId: editId,
      stepOrder: idx + 1,
      applicationRoleId: s.roleId as string,
      applicationEntityId: (s.applicationEntityId as number) || 0,
      mustApprove: false,
      requireHigherApproval: !!s.requireHigherApproval,
      higherApprovalRoleId: s.requireHigherApproval ? (s.higherApprovalRoleId || null) : null,
      higherApplicationEntityId: s.requireHigherApproval ? (s.higherApplicationEntityId || null) : null,
      reserveQty: false,
      canReturn: !!s.canReturn,
      parallelRoleIds: Array.isArray(s.parallelRoleIds)
        ? [...new Set(s.parallelRoleIds.filter(id => !!id && id !== s.roleId))]
        : []
    }));

    // Build backend payload — order auto-reject triggers are edited from Settings → Order auto-reject.
    const backendPayload = {
      id: editId,
      workflowName: this.editForm.name,
      workflowType: this.editWorkflowType,
      isActive: this.editForm.status === 'Active',
      isSpecialOrReserved: false,
      workflowSteps: workflowStepsPayload
    } as BackendUpdateWorkflowDto;

    const updateNotifiers = (workflowSteps?: WorkflowStepDto[]): Observable<boolean> => {
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
          const matchingStep = workflowSteps.find((ws: WorkflowStepDto) => ws.stepOrder === (idx + 1));
          if (matchingStep) {
            stepId = matchingStep.id;
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

          // Always call updateStepNotifiers, even if arrays are empty (to clear existing notifiers)
          notifierSaveObservables.push(
            this.workflowService.updateStepNotifiers(
              stepId,
              roleIds,
              userIds
            ).pipe(
              tap(() => {
                this.configService.log(`Successfully saved notifiers for step ${stepId}`);
              }),
              catchError(err => {
                this.configService.logError(`Failed to update notifiers for step ${stepId}`, err);
                return new Observable<boolean>(observer => {
                  observer.next(true);
                  observer.complete();
                });
              })
            )
          );
        } else {
          this.configService.logWarning(`Skipping notifiers for step at index ${idx} - no stepId found`);
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

          // Call API that ONLY updates transitions, does NOT touch workflow step properties
          transitionSaveObservables.push(
            this.workflowService.setStepTransitions(
              stepId,
              targetStepIds
            ).pipe(
              tap(() => {
                this.configService.log(`Successfully updated transitions for step ${stepId}`);
              }),
              catchError(err => {
                this.configService.logError(`Failed to update transitions for step ${stepId}`, err);
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

    // First update workflow with steps (including canReturn), then update transitions and notifiers
    this.workflowService.updateBackendWorkflow(backendPayload).pipe(
      switchMap(() => updateTransitions()),
      switchMap(() => updateNotifiers()),
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.submitting = false;
        this.cdr.markForCheck();
        this.translate.get(['toast.success', 'toast.workflowUpdated']).pipe(takeUntil(this.destroy$)).subscribe((translations: TranslationMap) => {
          this.toastService.success(translations['toast.workflowUpdated'], translations['toast.success']);
        });

        setTimeout(() => {
          this.router.navigate(['/workflow']);
        }, 500);
      },
      error: err => {
        this.submitting = false;
        this.cdr.markForCheck();

        this.translate.get(['toast.error', 'toast.failedToUpdateWorkflow']).pipe(takeUntil(this.destroy$)).subscribe((translations: TranslationMap) => {
          const errorMsg = translations['toast.failedToUpdateWorkflow'] || 'Failed to update workflow';
          this.errorMessage = (err instanceof Error ? err.message : String(err)) || errorMsg;
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
        catchError(_err => {
          return new Observable<{ step: EditStepForm; notifiers: WorkflowStepNotifier[] }>(observer => {
            observer.next({ step, notifiers: [] });
            observer.complete();
          });
        })
      )
    );

    forkJoin(notifierObservables).pipe(takeUntil(this.destroy$)).subscribe({
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

        this.cdr.markForCheck();

        if (callback) {
          setTimeout(() => callback(), 100);
        }
      },
      error: (err) => {
        this.configService.logError('Failed to load notifiers for workflow steps', err);
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
    this.backendUserService.getUsers({ page: 1, pageSize: 1000 }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: PaginatedList<BackendUserDto>) => {
        const users = response.items || [];
        this.allUsers = users.map((user: BackendUserDto) => ({
          id: String(user.id),
          userName: user.userName || '',
          roles: user.roleIds || []
        })).sort((a: { userName?: string }, b: { userName?: string }) =>
          (a.userName || '').localeCompare(b.userName || '')
        );
        this.cdr.markForCheck();
        if (callback) {
          callback();
        }
      },
      error: (err) => {
        this.configService.logError('Failed to load users', err);
        this.allUsers = [];
        this.cdr.markForCheck();
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

  private loadUsersForNotifyingRoles(step: EditStepForm, _stepIndex: number): void {
    if (!step.usersInNotifyingRoles) {
      step.usersInNotifyingRoles = [];
    }
    if (!step.availableUsers) {
      step.availableUsers = [];
    }

    // Preserve existing user IDs
    const preservedUserIds = step.notifyingUserIds
      ? [...step.notifyingUserIds].map((id: string) => String(id))
      : [];

    // Preserve existing role IDs - don't modify them here
    const preservedRoleIds = step.notifyingRoleIds
      ? [...step.notifyingRoleIds]
      : [];

    // Use cached users instead of making API call
    step.availableUsers = [...this.allUsers];

    // Restore user IDs if they were preserved and are still valid
    if (preservedUserIds.length > 0) {
      const validUserIds = preservedUserIds.filter((userId: string) =>
        step.availableUsers!.some((u: { id: string }) => String(u.id) === String(userId))
      );
      step.notifyingUserIds = validUserIds.length > 0 ? [...validUserIds] : [];
    } else {
      // Only set to empty array if it wasn't previously set
      if (step.notifyingUserIds === undefined || step.notifyingUserIds === null) {
        step.notifyingUserIds = [];
      }
    }

    // Restore role IDs - preserve them, don't clear
    if (preservedRoleIds.length > 0) {
      step.notifyingRoleIds = [...preservedRoleIds];
    } else {
      // Only initialize if not already set
      if (step.notifyingRoleIds === undefined || step.notifyingRoleIds === null) {
        step.notifyingRoleIds = [];
      }
    }

    this.cdr.markForCheck();
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

  private loadNextStepsForStep(step: EditStepForm, _stepIndex: number): void {
    // Only call API for existing steps (those with workflowStepId)
    if (!step.workflowStepId) {
      // New steps don't have ID yet, so no next steps available
      step.availableNextSteps = [];
      return;
    }

    // Call API to get next steps for this step
    this.workflowService.getNextStepsForWorkflowStep(step.workflowStepId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (nextSteps: WorkflowStepDto[]) => {
        step.availableNextSteps = nextSteps.map((ns: WorkflowStepDto) => ({
          ...ns,
          displayName: this.getStepDisplayName(ns)
        }));
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.configService.logError(`Failed to load next steps for step ${step.workflowStepId}`, err);
        step.availableNextSteps = [];
        this.cdr.markForCheck();
      }
    });
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
    if (!r) return roleId;
    return (this.isRTL ? r.nameAr : r.nameEn) || r.name || roleId;
  }

  getEntityNameById(entityId?: number | null): string {
    if (entityId === undefined || entityId === null) return '';
    const e = this.allApplicationEntities.find(x => x.id === entityId);
    return e ? (e.name || String(entityId)) : String(entityId);
  }

  orderLabel(n: number): string {
    if (n <= 0) {
      return '';
    }

    // Try to get translation key for predefined ordinals (1-20)
    const key = this.getOrdinalKey(n);
    if (key) {
      return this.translate.instant(key);
    }

    // For numbers beyond 20, generate ordinal dynamically
    return this.generateOrdinal(n);
  }

  private generateOrdinal(n: number): string {
    const currentLang = this.translate.currentLang || this.translate.defaultLang;

    // For Arabic, just return the number as-is (Arabic doesn't use ordinal suffixes like English)
    if (currentLang === 'ar') {
      return String(n);
    }

    // For English, generate ordinal suffix dynamically
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;

    // Special cases for 11th, 12th, 13th
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return `${n}th`;
    }

    // Regular cases
    switch (lastDigit) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }

  private getOrdinalKey(n: number): string | null {
    // Mapping for ordinals (1st to 20th)
    const predefined: { [key: number]: string } = {
      1: 'common.ordinals.first',
      2: 'common.ordinals.second',
      3: 'common.ordinals.third',
      4: 'common.ordinals.fourth',
      5: 'common.ordinals.fifth',
      6: 'common.ordinals.sixth',
      7: 'common.ordinals.seventh',
      8: 'common.ordinals.eighth',
      9: 'common.ordinals.ninth',
      10: 'common.ordinals.tenth',
      11: 'common.ordinals.eleventh',
      12: 'common.ordinals.twelfth',
      13: 'common.ordinals.thirteenth',
      14: 'common.ordinals.fourteenth',
      15: 'common.ordinals.fifteenth',
      16: 'common.ordinals.sixteenth',
      17: 'common.ordinals.seventeenth',
      18: 'common.ordinals.eighteenth',
      19: 'common.ordinals.nineteenth',
      20: 'common.ordinals.twentieth'
    };

    if (predefined[n]) {
      return predefined[n];
    }

    // For larger numbers, you might want a more complex logic
    // or just return null to fallback to the number itself
    return null;
  }
}


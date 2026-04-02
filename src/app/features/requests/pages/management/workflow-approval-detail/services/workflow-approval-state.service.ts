import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestDetail } from '@models/workflow-approval.model';
import { WorkflowApprovalPermissionsService } from './workflow-approval-permissions.service';
import { WorkflowApprovalDataService } from './workflow-approval-data.service';
import { TranslateService } from '@ngx-translate/core';
import { 
  hasHigherApproval, 
  getCurrentStepTransitions, 
  getWorkflowStepDisplayName,
  hasPendingStep,
  isLastApprovalCompleted
} from '../utils/workflow-approval-helpers';

export interface WorkflowApprovalState {
  requestId: number | null;
  requestDetail: RequestDetail | null;
  processing: boolean;
  isWeaponOrder: boolean;
  isPickupDateAlreadySet: boolean;
  isDepotSelected: boolean;
  isSuperAdmin: boolean;
  supplyData: any | null;
  previousWorkflowSteps: any[];
  loadingPreviousSteps: boolean;
  isReturnDepotSet: boolean;
  isReturnDeliveryDateSet: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalStateService {
  private stateSubject = new BehaviorSubject<WorkflowApprovalState>({
    requestId: null,
    requestDetail: null,
    processing: false,
    isWeaponOrder: false,
    isPickupDateAlreadySet: false,
    isDepotSelected: false,
    isSuperAdmin: false,
    supplyData: null,
    previousWorkflowSteps: [],
    loadingPreviousSteps: false,
    isReturnDepotSet: false,
    isReturnDeliveryDateSet: false
  });

  state$: Observable<WorkflowApprovalState> = this.stateSubject.asObservable();

  // Individual state observables for convenience
  requestId$ = this.state$.pipe(map(state => state.requestId));
  requestDetail$ = this.state$.pipe(map(state => state.requestDetail));
  processing$ = this.state$.pipe(map(state => state.processing));
  isWeaponOrder$ = this.state$.pipe(map(state => state.isWeaponOrder));
  isPickupDateAlreadySet$ = this.state$.pipe(map(state => state.isPickupDateAlreadySet));
  isSuperAdmin$ = this.state$.pipe(map(state => state.isSuperAdmin));
  supplyData$ = this.state$.pipe(map(state => state.supplyData));
  previousWorkflowSteps$ = this.state$.pipe(map(state => state.previousWorkflowSteps));
  loadingPreviousSteps$ = this.state$.pipe(map(state => state.loadingPreviousSteps));

  constructor(
    private permissionsService: WorkflowApprovalPermissionsService,
    private dataService: WorkflowApprovalDataService,
    private translateService: TranslateService
  ) {}

  /**
   * Get current state snapshot
   */
  getState(): WorkflowApprovalState {
    return this.stateSubject.value;
  }

  /**
   * Update state
   */
  updateState(updates: Partial<WorkflowApprovalState>): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      ...updates
    });
  }

  /**
   * Reset state
   */
  resetState(): void {
    this.stateSubject.next({
      requestId: null,
      requestDetail: null,
      processing: false,
      isWeaponOrder: false,
      isPickupDateAlreadySet: false,
      isDepotSelected: false,
      isSuperAdmin: false,
      supplyData: null,
      previousWorkflowSteps: [],
      loadingPreviousSteps: false,
      isReturnDepotSet: false,
      isReturnDeliveryDateSet: false
    });
  }

  // Permission check methods as observables
  canApproveOrReject$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.processing$
  ]).pipe(
    map(([requestDetail, processing]) => 
      this.permissionsService.canApproveOrReject(requestDetail, processing)
    )
  );

  canRejectRequest$: Observable<boolean> = this.state$.pipe(
    map(() => this.permissionsService.canRejectRequest())
  );

  canReturnForReview$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.processing$
  ]).pipe(
    map(([requestDetail, processing]) => 
      this.permissionsService.canReturnForReview(requestDetail, processing)
    )
  );

  canReviewSupply$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.isWeaponOrder$
  ]).pipe(
    map(([requestDetail, isWeaponOrder]) => 
      this.permissionsService.canReviewSupply(requestDetail, isWeaponOrder)
    )
  );

  canUpdateRequestAndSupply$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.isWeaponOrder$
  ]).pipe(
    map(([requestDetail, isWeaponOrder]) => 
      this.permissionsService.canUpdateRequestAndSupply(requestDetail, isWeaponOrder)
    )
  );

  canReviewWeaponSupply$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.isWeaponOrder$
  ]).pipe(
    map(([requestDetail, isWeaponOrder]) => 
      this.permissionsService.canReviewWeaponSupply(requestDetail, isWeaponOrder)
    )
  );

  canSelectDepots$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.isWeaponOrder$
  ]).pipe(
    map(([requestDetail, isWeaponOrder]) => 
      this.permissionsService.canSelectDepots(requestDetail, isWeaponOrder)
    )
  );

  canSetSupplyPickupDate$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => 
      this.permissionsService.canSetSupplyPickupDate(requestDetail)
    )
  );

  canConfirmSupplyPickupDate$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => 
      this.permissionsService.canConfirmSupplyPickupDate(requestDetail)
    )
  );

  isPickupDateEditable$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => 
      this.permissionsService.isPickupDateEditable(requestDetail)
    )
  );

  canSubmitSupply$: Observable<boolean> = combineLatest([
    this.requestDetail$,
    this.isWeaponOrder$
  ]).pipe(
    map(([requestDetail, isWeaponOrder]) => 
      this.permissionsService.canSubmitSupply(requestDetail, isWeaponOrder)
    )
  );

  hasHigherApproval$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => hasHigherApproval(requestDetail))
  );

  hasPendingStep$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => hasPendingStep(requestDetail))
  );

  isLastApprovalCompleted$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => isLastApprovalCompleted(requestDetail))
  );

  hasTransitions$: Observable<boolean> = this.requestDetail$.pipe(
    map(requestDetail => {
      const transitions = getCurrentStepTransitions(requestDetail);
      return transitions.length > 0;
    })
  );

  // Synchronous permission check methods (for use in templates and immediate checks)
  canApproveOrReject(): boolean {
    const state = this.getState();
    return this.permissionsService.canApproveOrReject(state.requestDetail, state.processing);
  }

  canRejectRequest(): boolean {
    return this.permissionsService.canRejectRequest();
  }

  canReturnForReview(): boolean {
    const state = this.getState();
    return this.permissionsService.canReturnForReview(state.requestDetail, state.processing);
  }

  canReviewSupply(): boolean {
    const state = this.getState();
    return this.permissionsService.canReviewSupply(state.requestDetail, state.isWeaponOrder);
  }

  canUpdateRequestAndSupply(): boolean {
    const state = this.getState();
    return this.permissionsService.canUpdateRequestAndSupply(state.requestDetail, state.isWeaponOrder);
  }

  canReviewWeaponSupply(): boolean {
    const state = this.getState();
    return this.permissionsService.canReviewWeaponSupply(state.requestDetail, state.isWeaponOrder);
  }

  canSelectDepots(): boolean {
    const state = this.getState();
    return this.permissionsService.canSelectDepots(state.requestDetail, state.isWeaponOrder);
  }

  canSetSupplyPickupDate(): boolean {
    const state = this.getState();
    return this.permissionsService.canSetSupplyPickupDate(state.requestDetail);
  }

  canConfirmSupplyPickupDate(): boolean {
    const state = this.getState();
    return this.permissionsService.canConfirmSupplyPickupDate(state.requestDetail);
  }

  isPickupDateEditable(): boolean {
    const state = this.getState();
    return this.permissionsService.isPickupDateEditable(state.requestDetail);
  }

  canSubmitSupply(): boolean {
    const state = this.getState();
    return this.permissionsService.canSubmitSupply(state.requestDetail, state.isWeaponOrder);
  }

  hasHigherApproval(): boolean {
    const state = this.getState();
    return hasHigherApproval(state.requestDetail);
  }

  hasTransitions(): boolean {
    const state = this.getState();
    const transitions = getCurrentStepTransitions(state.requestDetail);
    return transitions.length > 0;
  }

  hasPendingStep(): boolean {
    const state = this.getState();
    return hasPendingStep(state.requestDetail);
  }

  isLastApprovalCompleted(): boolean {
    const state = this.getState();
    return isLastApprovalCompleted(state.requestDetail);
  }

  getCurrentStepTransitions(): any[] {
    const state = this.getState();
    return getCurrentStepTransitions(state.requestDetail);
  }

  getWorkflowStepDisplayName(step: any): string {
    return getWorkflowStepDisplayName(step, this.translateService);
  }

  /**
   * Check if depot selection has been made (for weapon orders with SelectDepots permission)
   */
  isDepotSelected(): boolean {
    return this.getState().isDepotSelected;
  }

  /**
   * Check if supply is submitted
   */
  isSupplySubmitted(): boolean {
    const state = this.getState();
    if (!state.supplyData) {
      return false;
    }

    // Check for submitted (2) or completed/approved (3+) status
    const status = state.supplyData.submissionStatus;
    if (status != null && status >= 2) {
      return true;
    }

    // Backward compatibility: For old orders that may have receiver info filled
    // but submissionStatus is still 1 (Draft), check if essential receiver fields are present
    const hasReceiverInfo = !!(
      state.supplyData.recieverName &&
      state.supplyData.recieverName.trim() !== '' &&
      state.supplyData.receiverRankId &&
      state.supplyData.recieverMilitaryId &&
      state.supplyData.recieverMilitaryId.trim() !== ''
    );

    return hasReceiverInfo;
  }

  // Return-specific permission and state methods

  canSetReturnDepot(): boolean {
    const state = this.getState();
    return this.permissionsService.canSetReturnDepot(state.requestDetail);
  }

  canSetReturnDeliveryDate(): boolean {
    const state = this.getState();
    return this.permissionsService.canSetReturnDeliveryDate(state.requestDetail);
  }

  canProcessReturnItems(): boolean {
    const state = this.getState();
    return this.permissionsService.canProcessReturnItems(state.requestDetail);
  }

  isReturnDepotSet(): boolean {
    return this.getState().isReturnDepotSet;
  }

  isReturnDeliveryDateSet(): boolean {
    return this.getState().isReturnDeliveryDateSet;
  }

  /**
   * When true, the Take Action Approve button must be hidden — return completion goes through Review & complete only.
   */
  shouldHideStandaloneApproveForReturn(): boolean {
    return this.permissionsService.shouldHideStandaloneApproveForReturn(this.getState().requestDetail);
  }
}

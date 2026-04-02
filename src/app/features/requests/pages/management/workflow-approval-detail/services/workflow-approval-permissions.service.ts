/**
 * Workflow Approval Permissions Service
 * Handles all permission checks and authorization logic
 */

import { Injectable } from '@angular/core';
import { BackendAuthService } from '@services/backend-auth.service';
import { RequestDetail, WorkflowApprovalStep } from '@models/workflow-approval.model';
import { OrderSummary } from '@models/order-report.model';
import { REQUEST_STATUS_APPROVED } from '@utils/status.utils';
import { hasPendingStep } from '../utils/workflow-approval-helpers';

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalPermissionsService {
  private readonly SUPPLY_REVIEW_PERMISSION = 'UpdateRequestAndSuggestLots';
  private readonly UPDATE_REQUEST_AND_SUPPLY_PERMISSION = 'UpdateRequestAndSupply';
  private readonly CANNOT_REJECT_PERMISSION = 'CannotRejectRequest';
  private readonly SET_SUPPLY_PICKUP_DATE_PERMISSION = 'SetSupplyPickupDate';
  private readonly CONFIRM_SUPPLY_PICKUP_DATE_PERMISSION = 'ConfirmSupplyPickupDate';
  private readonly VIEW_SUPPLY_DATE_PERMISSION = 'ViewSupplyDate';
  private readonly VIEW_WORKFLOW_SUPPLY_SUMMARY_PERMISSION = 'ViewWorkflowSupplySummary';
  private readonly SUBMIT_SUPPLY_PERMISSION = 'SubmitSupply';
  private readonly REVIEW_WEAPON_SUPPLY_PERMISSION = 'ReviewWeaponSupply';
  private readonly SELECT_DEPOTS_PERMISSION = 'SelectDepots';
  private readonly UPDATE_REQUEST_ITEMS_PERMISSION = 'UpdateRequestItems';
  private readonly SET_RETURN_DEPOT_PERMISSION = 'SetReturnDepot';
  private readonly SET_RETURN_DELIVERY_DATE_PERMISSION = 'SetReturnDeliveryDate';
  private readonly PROCESS_RETURN_ITEMS_PERMISSION = 'ProcessReturnItems';

  constructor(private authService: BackendAuthService) { }

  /**
   * Check if user can approve or reject requests
   */
  canApproveOrReject(requestDetail: RequestDetail | null, processing: boolean): boolean {
    if (!requestDetail || processing) {
      return false;
    }

    // Allow action buttons for both Pending and ReturnedForReview statuses
    if (requestDetail.status !== 'Pending' && requestDetail.status !== 'ReturnedForReview' && requestDetail.status !== 'Returned') {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    // If the current user is the requester, don't show approve/reject buttons
    if (requestDetail.requesterId && currentUser.id) {
      const requesterId = requestDetail.requesterId.toLowerCase().trim();
      const currentUserId = currentUser.id.toLowerCase().trim();
      if (requesterId === currentUserId) {
        return false;
      }
    }

    // Check if user is administrator (multiple detection methods)
    const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
    const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') ||
      currentUser?.email?.toLowerCase().includes('administrator');
    const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;

    const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;

    if (isAdministrator) {
      return true;
    }

    const currentUserId = currentUser.id?.toLowerCase() || '';
    const currentUserName = currentUser.userName?.toLowerCase() || '';
    const currentUserEmail = currentUser.email?.toLowerCase() || '';

    const currentPendingStep = requestDetail.approvalHistory?.find(
      step => step.status === 'Pending' && step.isPending
    );

    if (!currentPendingStep) {
      return false;
    }

    if (currentPendingStep.isCurrentUserApprover !== undefined) {
      if (isAdministrator) {
        return true;
      }
      return currentPendingStep.isCurrentUserApprover;
    }

    // Check if user has already acted in the current workflow step
    if (requestDetail.approvalHistory && requestDetail.approvalHistory.length > 0) {
      const hasUserAlreadyActedInCurrentStep = requestDetail.approvalHistory.some(step => {
        if (step.workflowStepId === currentPendingStep.workflowStepId) {
          if (step.status === 'Approved' || step.status === 'Rejected') {
            const changedBy = step.changedBy?.toLowerCase() || '';
            const approverName = step.approverName?.toLowerCase() || '';

            const matchesUserId = currentUserId && changedBy.includes(currentUserId);
            const matchesUserName = currentUserName && (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
            const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);

            if (matchesUserId || matchesUserName || matchesUserEmail) {
              return true;
            }
          }
        }
        return false;
      });

      if (hasUserAlreadyActedInCurrentStep) {
        return false;
      }
    }

    // Additional check: if this is not a pending step for the current user, don't show buttons
    const hasAnyApprovedOrRejectedByCurrentUser = requestDetail.approvalHistory?.some(step => {
      if (step.status === 'Approved' || step.status === 'Rejected') {
        const changedBy = step.changedBy?.toLowerCase() || '';
        const approverName = step.approverName?.toLowerCase() || '';

        const matchesUserId = currentUserId && changedBy.includes(currentUserId);
        const matchesUserName = currentUserName && (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
        const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);

        return matchesUserId || matchesUserName || matchesUserEmail;
      }
      return false;
    });

    if (hasAnyApprovedOrRejectedByCurrentUser) {
      const currentUserRoles = this.authService.getCurrentUser()?.roles || [];

      // Helper to normalize strings for comparison
      const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

      const pendingRoleName = normalize(currentPendingStep.applicationRoleName || '');
      const pendingRoleId = normalize(currentPendingStep.applicationRoleId || '');

      // Check if user has a role that matches the pending step
      const hasMatchingRole = currentUserRoles.some(userRole => {
        const normalizedUserRole = normalize(userRole);
        if (!normalizedUserRole) return false;

        // 1. Check against Role ID (if available)
        if (pendingRoleId) {
          if (normalizedUserRole === pendingRoleId) return true;
          if (normalizedUserRole.includes(pendingRoleId) || pendingRoleId.includes(normalizedUserRole)) return true;
        }

        // 2. Check against Role Name
        if (pendingRoleName) {
          if (normalizedUserRole === pendingRoleName) return true;
          if (pendingRoleName.startsWith(normalizedUserRole)) return true;
          if (normalizedUserRole.length > 10 && pendingRoleName.includes(normalizedUserRole)) return true;
          if (pendingRoleName.length > 10 && normalizedUserRole.includes(pendingRoleName)) return true;
        }

        return false;
      });

      if (!hasMatchingRole) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if user can reject requests
   */
  canRejectRequest(): boolean {
    const currentUser = this.authService.getCurrentUser();

    try {
      // Check if user is administrator (multiple detection methods)
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') ||
        currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;

      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;

      if (isAdministrator) {
        return true;
      }

      // For non-administrators, check CannotRejectRequest permission
      const hasCannotRejectPermission = this.authService.hasPermission(this.CANNOT_REJECT_PERMISSION);

      return !hasCannotRejectPermission;
    } catch (error) {
      return true;
    }
  }

  /**
   * Check if user can return for review
   */
  canReturnForReview(requestDetail: RequestDetail | null, processing: boolean): boolean {
    if (!requestDetail || processing) {
      return false;
    }

    // Allow return for review when status is Pending or ReturnedForReview
    if (requestDetail.status !== 'Pending' && requestDetail.status !== 'ReturnedForReview' && requestDetail.status !== 'Returned') {
      return false;
    }

    // User must be able to approve/reject to return
    if (!this.canApproveOrReject(requestDetail, processing)) {
      return false;
    }

    // Check if the current workflow step allows returning (canReturn must be true)
    const currentPendingStep = requestDetail.approvalHistory?.find(
      step => step.status === 'Pending' && step.isPending
    );

    if (!currentPendingStep) {
      return false;
    }

    // Only show return button if canReturn is true for the current step
    return currentPendingStep.canReturn === true;
  }

  /**
   * Check if user can review supply
   */
  canReviewSupply(requestDetail: RequestDetail | null, isWeaponOrder: boolean): boolean {
    if (!requestDetail) {
      return false;
    }

    if (requestDetail.requestType !== 'Order') {
      return false;
    }

    if (requestDetail.status !== 'Pending') {
      return false;
    }

    try {
      // Super admin should always see the Review button (for both weapon and non-weapon orders)
      if (this.authService.isSuperAdmin()) {
        return true;
      }

      // For normal users, they must be the current approver on the pending step
      const currentPendingStep = requestDetail.approvalHistory?.find(
        step => step.status === 'Pending' && step.isPending === true
      );

      if (!currentPendingStep) {
        return false;
      }

      if (currentPendingStep.isPending !== true || currentPendingStep.isCurrentUserApprover !== true) {
        return false;
      }

      // For weapon orders, require UpdateRequestItems permission
      if (isWeaponOrder) {
        return this.authService.hasPermission(this.UPDATE_REQUEST_ITEMS_PERMISSION);
      }

      // For non-weapon orders, use the standard supply review permission
      return this.authService.hasPermission(this.SUPPLY_REVIEW_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can update request and supply
   */
  canUpdateRequestAndSupply(requestDetail: RequestDetail | null, isWeaponOrder: boolean): boolean {
    if (!requestDetail) {
      return false;
    }

    if (requestDetail.requestType !== 'Order') {
      return false;
    }

    if (requestDetail.status !== 'Pending') {
      return false;
    }

    // Hide for weapon orders - only show for ammunition and explosives
    if (isWeaponOrder) {
      return false;
    }

    try {
      // Super admin should always see the Update Request & Supply button (for non-weapon orders)
      if (this.authService.isSuperAdmin()) {
        return true;
      }

      // For normal users, they must be the current approver on the pending step
      const currentPendingStep = requestDetail.approvalHistory?.find(
        step => step.status === 'Pending' && step.isPending === true
      );

      if (!currentPendingStep) {
        return false;
      }

      // Must have isPending: true AND isCurrentUserApprover: true
      if (currentPendingStep.isPending !== true || currentPendingStep.isCurrentUserApprover !== true) {
        return false;
      }

      return this.authService.hasPermission(this.UPDATE_REQUEST_AND_SUPPLY_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can review weapon supply
   */
  canReviewWeaponSupply(requestDetail: RequestDetail | null, isWeaponOrder: boolean): boolean {
    if (!requestDetail) {
      return false;
    }

    if (requestDetail.requestType !== 'Order') {
      return false;
    }

    if (requestDetail.status !== 'Pending') {
      return false;
    }

    // Only show for weapon orders
    if (!isWeaponOrder) {
      return false;
    }

    try {
      // Super admin should always see the Review Weapon Supply button (for weapon orders)
      if (this.authService.isSuperAdmin()) {
        return true;
      }

      // For normal users, they must be the current approver on the pending step
      const currentPendingStep = requestDetail.approvalHistory?.find(
        step => step.status === 'Pending' && step.isPending === true
      );

      if (!currentPendingStep) {
        return false;
      }

      if (currentPendingStep.isPending !== true || currentPendingStep.isCurrentUserApprover !== true) {
        return false;
      }

      // Check if items are weapons and user has permission
      return this.authService.hasPermission(this.REVIEW_WEAPON_SUPPLY_PERMISSION) && isWeaponOrder;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can select depots (weapon supply flow).
   * Only shown for weapon orders, same as Review Weapon Supply.
   * Requires canReviewWeaponSupply context AND the SelectDepots permission.
   */
  canSelectDepots(requestDetail: RequestDetail | null, isWeaponOrder: boolean): boolean {
    if (!isWeaponOrder) {
      return false;
    }

    try {
      if (this.authService.isSuperAdmin()) {
        return true;
      }
      return this.authService.hasPermission(this.SELECT_DEPOTS_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can view supply date (pickup date)
   */
  canViewSupplyDate(): boolean {
    try {
      return this.authService.hasPermission(this.VIEW_SUPPLY_DATE_PERMISSION);
    } catch {
      return false;
    }
  }

  /**
   * SuperAdmin or ViewWorkflowSupplySummary; not shown for rejected orders (cancelled still blocked by API).
   * The parent page additionally requires an initial supply before mounting the summary card.
   */
  canViewWorkflowSupplySummarySection(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Order') {
      return false;
    }
    if (requestDetail.status === 'Rejected') {
      return false;
    }
    try {
      if (this.authService.isSuperAdmin()) {
        return true;
      }
      return this.authService.hasPermission(this.VIEW_WORKFLOW_SUPPLY_SUMMARY_PERMISSION);
    } catch {
      return false;
    }
  }

  /**
   * Order report: approved/completed orders only (final summary), plus permission — unlike workflow detail which can show provisional summary while in progress.
   */
  canViewWorkflowSupplySummaryForOrderReport(orderSummary: OrderSummary | null): boolean {
    if (!orderSummary || orderSummary.requestType !== 'Order') {
      return false;
    }
    if (orderSummary.requestStatusCode !== REQUEST_STATUS_APPROVED) {
      return false;
    }
    try {
      if (this.authService.isSuperAdmin()) {
        return true;
      }
      return this.authService.hasPermission(this.VIEW_WORKFLOW_SUPPLY_SUMMARY_PERMISSION);
    } catch {
      return false;
    }
  }

  /**
   * Check if user can set supply pickup date
   */
  canSetSupplyPickupDate(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Order') {
      return false;
    }

    try {
      // Administrators should NOT bypass the permission check for this specific action
      return this.authService.hasPermission(this.SET_SUPPLY_PICKUP_DATE_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can confirm supply pickup date
   */
  canConfirmSupplyPickupDate(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Order') {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();

    try {
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') ||
        currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;

      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions;

      if (isAdministrator) {
        return true;
      }

      return this.authService.hasPermission(this.CONFIRM_SUPPLY_PICKUP_DATE_PERMISSION);
    } catch (error) {
      return false;
    }
  }

  /**
   * True if this user appears as the actor on any Approved/Rejected workflow history row.
   * Used to stop pickup-date edits after they have taken an approval decision (unless they are again the active approver).
   */
  private hasCurrentUserRecordedApproveOrReject(requestDetail: RequestDetail): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !requestDetail.approvalHistory?.length) {
      return false;
    }

    const currentUserId = currentUser.id?.toLowerCase() || '';
    const currentUserName = currentUser.userName?.toLowerCase() || '';
    const currentUserEmail = currentUser.email?.toLowerCase() || '';

    return requestDetail.approvalHistory.some(step => {
      if (step.status !== 'Approved' && step.status !== 'Rejected') {
        return false;
      }
      const changedBy = step.changedBy?.toLowerCase() || '';
      const approverName = step.approverName?.toLowerCase() || '';

      const matchesUserId = currentUserId && changedBy.includes(currentUserId);
      const matchesUserName = currentUserName &&
        (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
      const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);

      return matchesUserId || matchesUserName || matchesUserEmail;
    });
  }

  /**
   * True if the current user appears as the actor on an approval history row for approve, reject, return, or return-for-review.
   * Used to lock return depot / delivery date updates after they acted (unless they are the active approver again).
   */
  private hasCurrentUserRecordedWorkflowDecision(requestDetail: RequestDetail): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !requestDetail.approvalHistory?.length) {
      return false;
    }

    const currentUserId = currentUser.id?.toLowerCase() || '';
    const currentUserName = currentUser.userName?.toLowerCase() || '';
    const currentUserEmail = currentUser.email?.toLowerCase() || '';

    return requestDetail.approvalHistory.some(step => {
      if (
        step.status !== 'Approved' &&
        step.status !== 'Rejected' &&
        step.status !== 'Returned' &&
        step.status !== 'ReturnedForReview'
      ) {
        return false;
      }
      const changedBy = step.changedBy?.toLowerCase() || '';
      const approverName = step.approverName?.toLowerCase() || '';

      const matchesUserId = currentUserId && changedBy.includes(currentUserId);
      const matchesUserName = currentUserName &&
        (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
      const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);

      return matchesUserId || matchesUserName || matchesUserEmail;
    });
  }

  /**
   * Whether the current user may change return depot / delivery date (Update, first-time set, or edit mode).
   * Mirrors isPickupDateEditable: after approve/reject/return, lock unless user is the active approver again.
   */
  canUpdateReturnWorkflowFields(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail) {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();
    try {
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') ||
        currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
      const isSuperAdmin = this.authService.isSuperAdmin();
      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions || isSuperAdmin;
      if (isAdministrator) {
        return true;
      }
    } catch {
      // continue with normal checks
    }

    if (!hasPendingStep(requestDetail)) {
      return false;
    }

    if (requestDetail.status === 'Approved' || requestDetail.status === 'Rejected') {
      return false;
    }

    if (!this.hasCurrentUserRecordedWorkflowDecision(requestDetail)) {
      return true;
    }

    const pendingStep = requestDetail.approvalHistory?.find(
      step => step.status === 'Pending' && step.isPending === true
    );
    return pendingStep?.isCurrentUserApprover === true;
  }

  /**
   * Check if pickup date is editable
   */
  isPickupDateEditable(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail) {
      return false;
    }

    const currentUser = this.authService.getCurrentUser();

    // Check if user is super-admin/administrator
    try {
      const hasAdministratorRole = this.authService.hasRole('Administrator') || this.authService.hasRole('Admin');
      const isAdminByUsername = currentUser?.userName?.toLowerCase().includes('administrator') ||
        currentUser?.email?.toLowerCase().includes('administrator');
      const hasAdminLevelPermissions = (currentUser?.permissions?.length || 0) >= 200;
      const isSuperAdmin = this.authService.isSuperAdmin();

      const isAdministrator = hasAdministratorRole || isAdminByUsername || hasAdminLevelPermissions || isSuperAdmin;

      // Super-admin/Administrator can always edit pickup date
      if (isAdministrator) {
        return true;
      }
    } catch (error) {
      // If admin check fails, continue with normal checks
    }

    // Confirm permission + active workflow
    if (!hasPendingStep(requestDetail)) {
      return false;
    }

    if (!this.canConfirmSupplyPickupDate(requestDetail)) {
      return false;
    }

    // After this user has approved/rejected, lock pickup edits unless they are the current approver again
    // (e.g. multi-step workflow). Confirm-only users have no Approve/Reject rows and stay editable.
    const pendingStep = requestDetail.approvalHistory?.find(
      step => step.status === 'Pending' && step.isPending === true
    );
    const isCurrentApprover = pendingStep?.isCurrentUserApprover === true;

    if (this.hasCurrentUserRecordedApproveOrReject(requestDetail) && !isCurrentApprover) {
      return false;
    }

    return true;
  }

  /**
   * Check if user can see and use the submit supply component
   * Note: Super admins can see it but don't need to submit it to approve
   */
  canSubmitSupply(requestDetail: RequestDetail | null, isWeaponOrder: boolean): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Order') {
      return false;
    }

    // Hide submit supply section for weapon orders
    if (isWeaponOrder) {
      return false;
    }

    try {
      const isSuperAdmin = this.authService.isSuperAdmin();
      
      // Check if user has the permission
      const hasPermission = this.authService.hasPermission(this.SUBMIT_SUPPLY_PERMISSION);

      // Super admins can always see the component (they don't need permission)
      if (isSuperAdmin) {
        // Still check if there's a pending step and they are the approver
        const currentPendingStep = requestDetail.approvalHistory?.find(
          step => step.status === 'Pending' && step.isPending === true
        );
        
        // Super admin can see it if there's a pending step
        // They don't need to be the current approver to see it
        return currentPendingStep !== undefined;
      }

      // For non-admin users, they need permission
      if (!hasPermission) {
        return false;
      }

      // User has permission - check if they are the current approver
      const currentPendingStep = requestDetail.approvalHistory?.find(
        step => step.status === 'Pending' && step.isPending === true
      );

      if (!currentPendingStep) {
        return false; // No pending step
      }

      // Only show if user is the current approver
      return currentPendingStep.isCurrentUserApprover === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can set the return depot
   */
  canSetReturnDepot(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Return') {
      return false;
    }
    if (!hasPendingStep(requestDetail)) {
      return false;
    }
    try {
      if (this.authService.isSuperAdmin()) {
        return true;
      }
      return this.authService.hasPermission(this.SET_RETURN_DEPOT_PERMISSION);
    } catch {
      return false;
    }
  }

  /**
   * Check if user can set the return delivery date
   */
  canSetReturnDeliveryDate(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Return') {
      return false;
    }
    if (!hasPendingStep(requestDetail)) {
      return false;
    }
    try {
      if (this.authService.isSuperAdmin()) {
        return true;
      }
      return this.authService.hasPermission(this.SET_RETURN_DELIVERY_DATE_PERMISSION);
    } catch {
      return false;
    }
  }

  /**
   * Check if user can process return items
   */
  canProcessReturnItems(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Return') {
      return false;
    }
    if (!hasPendingStep(requestDetail)) {
      return false;
    }
    try {
      if (this.authService.isSuperAdmin()) {
        return true;
      }
      return this.authService.hasPermission(this.PROCESS_RETURN_ITEMS_PERMISSION);
    } catch {
      return false;
    }
  }

  /**
   * Return requests are completed via Process Return Items (review screen), which approves the workflow.
   * Hide the standalone Approve button once depot and delivery are set so approvers cannot bypass lot/serial capture.
   */
  shouldHideStandaloneApproveForReturn(requestDetail: RequestDetail | null): boolean {
    if (!requestDetail || requestDetail.requestType !== 'Return') {
      return false;
    }
    if (!hasPendingStep(requestDetail)) {
      return false;
    }
    return !!requestDetail.returnToDepotId && !!requestDetail.deliveryDate;
  }
}

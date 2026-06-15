
import { TranslateService } from '@ngx-translate/core';
import { RequestDetail, WorkflowApprovalStep, WorkflowStepTransition } from '@models/workflow-approval.model';
import { WorkflowStepDto } from '@models/workflow.model';
import { getLocalizedName, getCurrentLang, Localizable } from '@utils/localization.utils';
import { formatDateTimeExtended } from '@utils/format.utils';
import { RequestStatusEnum, resolveWorkflowApproverDisplayName } from '@utils/request-mapper.utils';
import { WorkflowApprovalStepOption } from '../services/workflow-approval-data.service';

type WorkflowStepDisplayLike = WorkflowStepDto & {
  applicationRole?: { name?: string; nameEn?: string; nameAr?: string } | null;
  applicationRoleName?: string;
  applicationRoleNameAr?: string | null;
  stepOrder?: number | string;
};

type WorkflowStepTransitionTargetDisplayLike = {
  stepOrder?: number | string;
  applicationRole?: { name?: string; nameEn?: string; nameAr?: string } | null;
  applicationRoleName?: string | null;
  applicationRoleNameAr?: string | null;
};

type TransitionOptionLike =
  | WorkflowStepTransition
  | { value: WorkflowStepTransition }
  | { value: unknown };

type ApprovalStepWithPascalTransitions = WorkflowApprovalStep & {
  Transitions?: unknown;
};

function _isWorkflowStepTransitionLike(value: unknown): value is WorkflowStepTransition {
  if (!value || typeof value !== 'object') return false;
  const v = value as { targetWorkflowStepId?: unknown; sourceWorkflowStepId?: unknown };
  return typeof v.targetWorkflowStepId === 'number' && typeof v.sourceWorkflowStepId === 'number';
}

/**
 * Get approval history with requester as the first step
 */
export function getDisplayApprovalHistory(
  requestDetail: RequestDetail | null,
  translateService: TranslateService
): WorkflowApprovalStep[] {
  if (!requestDetail) {
    return [];
  }

  const currentLang = getCurrentLang(translateService);
  let requesterDisplayName = 'Unknown Requester';

  if (currentLang === 'ar' && requestDetail.requesterNameAr) {
    requesterDisplayName = requestDetail.requesterNameAr;
  } else if (requestDetail.requesterNameEn) {
    requesterDisplayName = requestDetail.requesterNameEn;
  } else if (requestDetail.requesterName) {
    requesterDisplayName = requestDetail.requesterName;
  }

  const requesterStep: WorkflowApprovalStep = {
    id: 0,
    approverName: requesterDisplayName,
    approverNameEn: requestDetail.requesterNameEn,
    approverNameAr: requestDetail.requesterNameAr,
    status: 'Submitted',
    applicationRoleName: 'Requester (Order Requesting Entity)',
    applicationRoleNameAr: 'مقدم الطلب (جهة طلب المواد)',
    approvedDateTime: formatApprovalDateTime(
      requestDetail.creationDate || requestDetail.requestDate,
      undefined,
      translateService
    ),
    isPending: false,
    comments: requestDetail.notes
  };

  const steps: WorkflowApprovalStep[] = [requesterStep, ...(requestDetail.approvalHistory || [])];

  // Append a virtual system auto-reject terminal node when the request was auto-rejected.
  // The pending step stays as-is (the approver never acted — the SYSTEM rejected).
  if (requestDetail.status === 'AutoRejected') {
    const systemStep: WorkflowApprovalStep = {
      id: -1,
      isSystemAutoReject: true,
      status: 'AutoRejected',
      isPending: false,
      approverNameEn: translateService.instant('workflowApprovalDetail.systemAutoRejectedBy'),
      approverNameAr: translateService.instant('workflowApprovalDetail.systemAutoRejectedBy'),
      applicationRoleName: translateService.instant('workflowApprovalDetail.systemAutoRejectedRole'),
      applicationRoleNameAr: translateService.instant('workflowApprovalDetail.systemAutoRejectedRole'),
      approvedDateTime: requestDetail.autoRejectedAt
        ? formatApprovalDateTime(requestDetail.autoRejectedAt, undefined, translateService)
        : undefined,
      changedAt: requestDetail.autoRejectedAt,
      files: [],
      transitions: []
    };
    steps.push(systemStep);
  }

  return steps;
}

/**
 * Format approval date-time for workflow display
 */
export function formatApprovalDateTime(
  dateTime: string | Date | undefined,
  changedAt?: string | Date | undefined,
  _translateService?: TranslateService
): string {
  // If primary date is missing, fall back to changedAt completely
  if (!dateTime && changedAt) {
    return formatDateTimeExtended(changedAt);
  }

  return formatDateTimeExtended(dateTime, changedAt);
}

/**
 * Get workflow step display name (localized)
 */
export function getWorkflowStepDisplayName(
  step: WorkflowStepDisplayLike | WorkflowApprovalStepOption | null | undefined,
  translateService: TranslateService
): string {
  if (!step) return '';

  // Get role name - backend only sends ApplicationRoleName (EN), not ApplicationRoleNameAr
  // So we need to check the nested applicationRole object for Arabic name
  let roleNameEn: string | undefined;
  let roleNameAr: string | undefined;

  const nestedRole = (step as WorkflowStepDisplayLike).applicationRole;

  // First check nested applicationRole object (has both EN and AR)
  if (nestedRole) {
    roleNameEn = nestedRole.nameEn ?? nestedRole.name;
    roleNameAr = nestedRole.nameAr ?? nestedRole.name;
  }

  // Fallback to flat properties if nested object not available
  if (!roleNameEn && step.applicationRoleName) {
    roleNameEn = step.applicationRoleName;
  }
  if (!roleNameAr && step.applicationRoleNameAr) {
    roleNameAr = step.applicationRoleNameAr ?? undefined;
  }

  // Use getLocalizedValue helper for role name
  const roleName = getLocalizedValue(roleNameEn, roleNameAr, translateService) ||
    translateService.instant('workflowApprovalDetail.unknownApprover');

  // Use translate service for "Step" label
  const stepLabel = translateService.instant('requestsManagement.orderReport.table.step');

  return `${stepLabel} ${step.stepOrder}: ${roleName}`;
}

/**
 * Get transition display name for dropdown
 */
export function getTransitionDisplayName(
  option: TransitionOptionLike | null | undefined,
  translateService: TranslateService
): string {
  if (!option) return '';

  const transition =
    typeof option === 'object' && option !== null && 'value' in option
      ? (option as { value: unknown }).value
      : option;

  if (!transition || typeof transition !== 'object') {
    return '';
  }

  const targetStepUnknown = (transition as { targetStep?: unknown }).targetStep;
  if (!targetStepUnknown || typeof targetStepUnknown !== 'object') {
    return '';
  }

  const targetStep = targetStepUnknown as WorkflowStepTransitionTargetDisplayLike;
  const stepOrder = targetStep.stepOrder ?? '';

  // Get role name - check nested applicationRole object for both EN and AR
  let roleNameEn: string | undefined;
  let roleNameAr: string | undefined;

  // First check nested applicationRole object (has both EN and AR)
  if (targetStep.applicationRole) {
    roleNameEn = targetStep.applicationRole.nameEn ?? targetStep.applicationRole.name;
    roleNameAr = targetStep.applicationRole.nameAr ?? targetStep.applicationRole.name;
  }

  // Fallback to flat properties if nested object not available
  if (!roleNameEn && targetStep.applicationRoleName) {
    roleNameEn = targetStep.applicationRoleName;
  }
  if (!roleNameAr && targetStep.applicationRoleNameAr) {
    roleNameAr = targetStep.applicationRoleNameAr ?? undefined;
  }

  // Use getLocalizedValue helper for role name
  const roleName = getLocalizedValue(roleNameEn, roleNameAr, translateService) ||
    translateService.instant('workflowApprovalDetail.unknownApprover');

  // Use translate service for "Step" label
  const stepLabel = translateService.instant('requestsManagement.orderReport.table.step');

  return `${stepLabel} ${stepOrder}: ${roleName}`;
}

/**
 * Get localized value based on current language
 */
export function getLocalizedValue(
  en: string | undefined,
  ar: string | undefined,
  translateService: TranslateService
): string {
  const lang = translateService.currentLang;
  if (lang === 'ar') {
    return ar || en || '';
  }
  return en || ar || '';
}

/**
 * Get localized approver name
 */
export function getApproverName(
  approval: WorkflowApprovalStep,
  translateService: TranslateService
): string {
  return resolveWorkflowApproverDisplayName(approval, getCurrentLang(translateService));
}

/**
 * Resolve usage purpose with proper localization
 */
export function resolveUsagePurpose(
  requestDetail: RequestDetail | null,
  translateService: TranslateService
): string {
  if (!requestDetail) {
    return 'N/A';
  }
  const currentLang = getCurrentLang(translateService);
  return getLocalizedName(
    {
      nameEn: requestDetail.requestPurposeNameEn,
      nameAr: requestDetail.requestPurposeNameAr
    },
    currentLang
  ) || requestDetail.usagePurpose || 'N/A';
}

/**
 * Check if there is a pending step in the approval workflow
 */
export function hasPendingStep(requestDetail: RequestDetail | null): boolean {
  if (!requestDetail || !requestDetail.approvalHistory) {
    return false;
  }
  
  if (requestDetail.status === 'Rejected' || requestDetail.status === 'AutoRejected' || requestDetail.status === 'Cancelled') {
    return false;
  }
  return requestDetail.approvalHistory.some(
    step => step.status === 'Pending' && step.isPending === true
  );
}

/**
 * Check if the last approval is completed
 */
export function isLastApprovalCompleted(requestDetail: RequestDetail | null): boolean {
  if (!requestDetail) {
    return false;
  }

  // Check if request status is Approved using enum
  const requestStatusEnum = normalizeStatusToEnum(requestDetail.status);
  if (requestStatusEnum === RequestStatusEnum.Approved) {
    return true;
  }

  // Check if there are no pending steps in the approval history
  if (requestDetail.approvalHistory && requestDetail.approvalHistory.length > 0) {
    const hasPendingStep = requestDetail.approvalHistory.some(
      step => step.status === 'Pending' && step.isPending === true
    );
    return !hasPendingStep;
  }

  return false;
}

/**
 * Helper method to normalize status string to RequestStatusEnum value
 */
function normalizeStatusToEnum(status: string | undefined): RequestStatusEnum | null {
  if (!status) return null;
  const statusLower = status.toLowerCase().trim();
  if (statusLower === 'approved' || statusLower === 'completed') {
    return RequestStatusEnum.Approved;
  }
  if (statusLower === 'rejected' || statusLower === 'declined') {
    return RequestStatusEnum.Rejected;
  }
  if (statusLower === 'autorejected' || statusLower === 'auto rejected' || statusLower === 'auto-rejected' || statusLower === '7') {
    return RequestStatusEnum.AutoRejected ?? RequestStatusEnum.Rejected;
  }
  if (statusLower === 'new' || statusLower === 'pending') {
    return RequestStatusEnum.New;
  }
  if (statusLower === 'underprocess' || statusLower === 'under process' || statusLower === 'inprogress' || statusLower === 'in progress') {
    return RequestStatusEnum.UnderProcess;
  }
  if (statusLower === 'returnedforreview' || statusLower === 'returned') {
    return RequestStatusEnum.ReturnedForReview;
  }
  return null;
}

/**
 * Check if request has higher approval requirement
 */
export function hasHigherApproval(requestDetail: RequestDetail | null): boolean {
  if (!requestDetail || !requestDetail.approvalHistory) {
    return false;
  }

  // Find the current pending step
  const pendingStep = requestDetail.approvalHistory.find(step => step.status === 'Pending' && step.isPending);

  if (!pendingStep || !pendingStep.requireHigherApproval) {
    return false;
  }

  const hasApprovedStepWithSameWorkflowStepId = requestDetail.approvalHistory.some(step =>
    step.workflowStepId === pendingStep.workflowStepId &&
    step.status === 'Approved'
  );

  return !hasApprovedStepWithSameWorkflowStepId;
}

/**
 * Get current step transitions
 */
export function getCurrentStepTransitions(requestDetail: RequestDetail | null): WorkflowStepTransition[] {
  if (!requestDetail || !requestDetail.approvalHistory) {
    return [];
  }

  const currentPendingStep = requestDetail.approvalHistory.find(
    step => step.status === 'Pending' && step.isPending
  );

  if (!currentPendingStep) {
    return [];
  }

  // Check for transitions property (may be in different formats from backend)
  const pascalTransitions = (currentPendingStep as ApprovalStepWithPascalTransitions).Transitions;
  const normalizedPascalTransitions = Array.isArray(pascalTransitions)
    ? pascalTransitions as WorkflowStepTransition[]
    : [];

  const transitions = currentPendingStep.transitions ?? normalizedPascalTransitions;

  if (!Array.isArray(transitions) || transitions.length === 0) {
    return [];
  }

  return transitions;
}

/**
 * Get rank display name (localized)
 */
export function getRankDisplayName(
  rank: Localizable | null | undefined,
  translateService: TranslateService
): string {
  if (!rank) return '';
  return getLocalizedName(rank, getCurrentLang(translateService)) || (rank.nameEn ?? '') || '';
}

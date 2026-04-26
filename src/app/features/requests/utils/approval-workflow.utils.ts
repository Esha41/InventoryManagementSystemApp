/**
 * Approval Workflow Utilities
 * Functions for mapping and processing approval workflow data
 */

import { ApprovalStep } from '@models/supply-request.model';
import { getApprovalStatusBadgeClass } from '@utils/status-class.utils';

/**
 * Map WorkflowApprovalStep to ApprovalStep format
 */
export function mapWorkflowStepsToApprovalSteps(workflowSteps: any[]): ApprovalStep[] {
  return workflowSteps.map((step, index) => ({
    id: step.id?.toString() || (index + 1).toString(),
    approverName: step.approverName || step.applicationRoleName || 'Pending Approval',
    approverId: extractApproverId(step.changedBy) || step.applicationRoleId?.toString() || '',
    militaryRank: extractMilitaryRank(step.approverName) || step.applicationRoleName || '',
    status: step.status === 'Approved' ? 'Approved' : step.status === 'Rejected' ? 'Rejected' : 'Pending',
    approvedDate: step.approvedDate || '',
    comments: step.comments || ''
  }));
}

/**
 * Extract approver ID from changedBy field (format: userId@domain.com)
 */
export function extractApproverId(changedBy?: string): string {
  if (!changedBy) return '';
  const parts = changedBy.split('@');
  return parts[0] || '';
}

/**
 * Extract military rank from approver name (if available)
 */
export function extractMilitaryRank(approverName?: string): string {
  if (!approverName) return '';

  // Try to extract rank from name (e.g., "Maj. Khalid Hassan" -> "Major")
  const rankMatch = approverName.match(/^(Maj|Lt\.?\s*Col|Col|Gen|Sgt|Cpt)\.?/i);
  if (rankMatch) {
    const rank = rankMatch[1].toLowerCase();
    if (rank.includes('maj')) return 'Major';
    if (rank.includes('lt') && rank.includes('col')) return 'Lieutenant Colonel';
    if (rank.includes('col')) return 'Colonel';
    if (rank.includes('gen')) return 'General';
    if (rank.includes('sgt')) return 'Sergeant';
    if (rank.includes('cpt')) return 'Captain';
  }
  return '';
}

/**
 * Get approval status icon name
 */
export function getApprovalStatusIconName(status: string): string {
  switch (status) {
    case 'Approved': return 'CheckCircle';
    case 'Rejected': return 'AlertTriangle';
    case 'Pending': return 'Clock';
    default: return 'Clock';
  }
}

/**
 * Get approval status CSS classes
 * @deprecated Use getApprovalStatusBadgeClass from @utils/status-class.utils instead
 */
export function getApprovalStatusClass(status: string): string {
  // Re-export from core utils for backward compatibility
  return getApprovalStatusBadgeClass(status);
}

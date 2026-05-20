import { DelegationScope } from '@models/backend-enums';

export { DelegationScope } from '@models/backend-enums';

/**
 * Get all available delegation scopes (excluding None)
 */
export function getAvailableDelegationScopes(): DelegationScope[] {
  return [DelegationScope.WorkflowApproval];
}

/** Translation key suffix: DELEGATION.SCOPE_{suffix} */
export function getDelegationScopeI18nSuffix(scope: DelegationScope): string {
  switch (scope) {
    case DelegationScope.WorkflowApproval:
      return 'WORKFLOWAPPROVAL';
    default:
      return 'NONE';
  }
}

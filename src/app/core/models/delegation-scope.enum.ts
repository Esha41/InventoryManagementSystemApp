/**
 * Enum for delegation scopes.
 * Backend sends enum values as strings (JsonStringEnumConverter),
 * so we use string values here.
 */
export enum DelegationScope {
    None = 'None',
    WorkflowApproval = 'WorkflowApproval'
}

/**
 * Get all available delegation scopes (excluding None)
 */
export function getAvailableDelegationScopes(): DelegationScope[] {
    return [
        DelegationScope.WorkflowApproval
    ];
}

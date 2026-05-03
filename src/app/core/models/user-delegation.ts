
export interface UserDelegation {
    id: number;
    delegatorUserId: string;
    delegatorUserName: string;
    delegatorFullName: string;
    delegateeUserId: string;
    delegateeUserName: string;
    delegateeFullName: string;
    startDate: string; // ISO Date
    endDate: string; // ISO Date
    reason: string;
    isActive: boolean;
    createdDate: string;
    status: string;
    delegationStatus: number; // 0 = Pending, 1 = Approved, 2 = Rejected
    isIncoming: boolean;
    delegationScopes: string[]; // Array of DelegationScope enum values as strings
}

export interface CreateUserDelegation {
    delegateeUserId: string;
    startDate: string;
    endDate: string;
    reason: string;
    delegationScopes: string[]; // Array of DelegationScope enum values as strings
}

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
}

export interface CreateUserDelegation {
    delegateeUserId: string;
    startDate: string;
    endDate: string;
    reason: string;
}

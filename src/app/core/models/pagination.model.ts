export interface FilterData {
    field?: string;
    operator?: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'doesnotcontain' | 'startswith' | 'endswith';
    value?: string;
    logic?: 'and' | 'or';
    filters?: FilterData[];
    sortField?: string;
    sortDirection?: number; // 1 for asc, 2 for desc based on backend
}

export interface PagedListRequest {
    page: number;
    pageSize: number;
    filter?: FilterData;
    /** When true, returns only soft-deleted items (IsDeleted = true). Used for ammunition "deleted ammunition" view. */
    deletedOnly?: boolean;
}

export interface PaginatedList<T> {
    items: T[];
    pageIndex: number;
    totalPages: number;
    totalCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

/**
 * Request Type Mapper Utilities
 * Maps unified BaseRequestDto to specific request types (Order, Return, Discard)
 * Following Angular best practices for data transformation
 */

import { UnifiedListRequestDto } from '@models/unified-list-request.model';
import { OrderDto } from '@models/order.model';
import { ReturnDto } from '@models/return.model';
import { DiscardDto } from '@models/discard.model';

/**
 * Request Type Enum (matches backend)
 */
export enum RequestType {
    Order = 1,
    Return = 2,
    Discard = 3
}

/**
 * Convert string enum to number
 * Handles backend returning enums as strings
 */
function normalizeRequestType(requestType: number | string): number {
    if (typeof requestType === 'number') {
        return requestType;
    }

    // Map string to number
    const typeMap: { [key: string]: number } = {
        'Order': RequestType.Order,
        'Return': RequestType.Return,
        'Discard': RequestType.Discard
    };

    return typeMap[requestType] || 0;
}

/**
 * Convert string priority to number.
 * @see `ettadbackend/Project.Data/Enums/RequestPriority.cs` (Normal=1, Urgent=2, VeryUrgent=3)
 */
function normalizePriority(priority: number | string): number {
    if (typeof priority === 'number') {
        return priority;
    }

    const key = String(priority).trim().toLowerCase().replace(/[\s\-_]+/g, '');

    const priorityMap: { [key: string]: number } = {
        normal: 1,
        urgent: 2,
        veryurgent: 3,
        // legacy string labels
        critical: 3,
        high: 2,
        medium: 2,
        low: 1
    };

    return priorityMap[key] ?? 1;
}

/**
 * Convert string status to number
 */
function normalizeStatus(status: number | string): number {
    if (typeof status === 'number') {
        return status;
    }

    const raw = String(status).trim();
    if (!raw) return 1;

    // Normalize to a stable key (case-insensitive; ignore spaces/hyphens/underscores).
    const key = raw.toLowerCase().replace(/[\s\-_]+/g, '');

    // If it is numeric-like (e.g. "7"), accept it.
    const numeric = parseInt(key, 10);
    if (!Number.isNaN(numeric)) {
        return numeric;
    }

    const statusMap: { [key: string]: number } = {
        new: 1,
        underprocess: 2,
        approved: 3,
        rejected: 4,
        cancelled: 5,
        returnedforreview: 6,
        autorejected: 7
    };

    return statusMap[key] || 1; // Default to New
}

/**
 * Convert string item type to number
 * @see `ettadbackend/Project.Data/Enums/ItemType.cs`
 */
function normalizeItemType(itemType: number | string | undefined): number | undefined {
    if (itemType === undefined || itemType === null) {
        return undefined;
    }

    if (typeof itemType === 'number') {
        return itemType;
    }

    const itemTypeMap: { [key: string]: number } = {
        'Ammunition': 1,
        'Weapon': 2,
        'Explosive': 3,
        'Accessory': 4
    };

    return itemTypeMap[itemType];
}

/**
 * Normalize BaseRequestDto to ensure all enums are numbers
 */
function normalizeBaseRequestDto(request: UnifiedListRequestDto): UnifiedListRequestDto {
    return {
        ...request,
        requestType: normalizeRequestType(request.requestType),
        priority: normalizePriority(request.priority),
        status: normalizeStatus(request.status),
        requestPurposeNotes: request.requestPurposeNotes ?? '',
        isMyTurn: request.isMyTurn ?? false,
        requestItems: request.requestItems?.map(item => ({
            ...item,
            itemType: normalizeItemType(item.itemType)
        }))
    };
}

/**
 * Map BaseRequestDto to OrderDto
 * Transforms the unified structure to Order-specific structure
 */
export function mapToOrderDto(base: UnifiedListRequestDto): OrderDto {
    const normalized = normalizeBaseRequestDto(base);

    const order: OrderDto = {
        id: normalized.id,
        requestNo: normalized.requestNo,
        orderNo: normalized.requestNo,
        requestType: normalized.requestType,
        reason: normalized.reason,
        priority: normalized.priority,
        status: normalized.status,
        notes: normalized.notes,
        requestPurposeNotes: normalized.requestPurposeNotes,
        departmentId: normalized.departmentId,
        requesterId: normalized.requesterId,
        requestPurposeId: normalized.requestPurposeId,

        departmentNameAr: normalized.department?.nameAr,
        departmentNameEn: normalized.department?.nameEn,
        requesterName: normalized.requester?.fullNameEN || normalized.requester?.fullNameAR || normalized.requester?.userName,
        requesterNameEn: normalized.requester?.fullNameEN,
        requesterNameAr: normalized.requester?.fullNameAR,
        requestPurposeNameAr: normalized.requestPurpose?.nameAr,
        requestPurposeNameEn: normalized.requestPurpose?.nameEn,

        department: normalized.department ? {
            id: normalized.department.id,
            code: normalized.department.code,
            nameAr: normalized.department.nameAr,
            nameEn: normalized.department.nameEn,
            isDeleted: normalized.department.isDeleted
        } : undefined,
        requester: normalized.requester ? {
            id: normalized.requester.id,
            userName: normalized.requester.userName,
            fullNameEN: normalized.requester.fullNameEN,
            fullNameAR: normalized.requester.fullNameAR,
            militoryId: normalized.requester.militoryId,
            email: normalized.requester.email,
            rank: normalized.requester.rank ?? undefined,
            department: normalized.requester.department ?? undefined
        } : undefined,
        requestPurpose: normalized.requestPurpose ? {
            id: normalized.requestPurpose.id,
            nameAr: normalized.requestPurpose.nameAr,
            nameEn: normalized.requestPurpose.nameEn,
            requestType: normalized.requestPurpose.requestType
        } : undefined,

        requestItems: normalized.requestItems?.map(item => ({
            id: item.id,
            itemId: item.itemId,
            quantity: item.quantity,
            requestId: item.requestId,
            notes: item.notes,
            itemName: item.itemName,
            itemNo: item.itemNo,
            nsn: item.nsn,
            itemType: item.itemType
        })),

        isFromAllowance: normalized.isFromAllowance ?? false,
        usageDateFrom: normalized.usageDateFrom,
        usageTimeFrom: normalized.usageTimeFrom,
        usageDateTo: normalized.usageDateTo,
        usageTimeTo: normalized.usageTimeTo,
        usagePurpose: normalized.usagePurpose,
        annualDiscard: normalized.annualDiscard,
        usageLocation: normalized.usageLocation,
        numberOfOfficer: normalized.numberOfOfficer,
        numberOfOtherRank: normalized.numberOfOtherRank,
        supplyDate: normalized.supplyDate,

        creationDate: normalized.creationDate,
        isMyTurn: normalized.isMyTurn
    };

    return order;
}

/**
 * Map BaseRequestDto to ReturnDto
 * Transforms the unified structure to Return-specific structure
 */
export function mapToReturnDto(base: UnifiedListRequestDto): ReturnDto {
    const normalized = normalizeBaseRequestDto(base);

    const ret: ReturnDto = {
        id: normalized.id,
        requestNo: normalized.requestNo,
        requestType: normalized.requestType,
        reason: normalized.reason,
        priority: normalized.priority,
        status: normalized.status,
        notes: normalized.notes,
        requestPurposeNotes: normalized.requestPurposeNotes,
        departmentId: normalized.departmentId,
        requesterId: normalized.requesterId,
        requestPurposeId: normalized.requestPurposeId,

        department: normalized.department ? {
            id: normalized.department.id,
            code: normalized.department.code,
            nameAr: normalized.department.nameAr,
            nameEn: normalized.department.nameEn,
            isDeleted: normalized.department.isDeleted
        } : undefined,

        requester: normalized.requester ? {
            id: normalized.requester.id,
            userName: normalized.requester.userName,
            fullNameEN: normalized.requester.fullNameEN,
            fullNameAR: normalized.requester.fullNameAR,
            militoryId: normalized.requester.militoryId,
            email: normalized.requester.email,
            rank: normalized.requester.rank ?? undefined,
            department: normalized.requester.department ?? undefined
        } : undefined,

        requestPurpose: normalized.requestPurpose ? {
            id: normalized.requestPurpose.id,
            nameAr: normalized.requestPurpose.nameAr,
            nameEn: normalized.requestPurpose.nameEn,
            requestType: normalized.requestPurpose.requestType
        } : undefined,

        requestItems: normalized.requestItems?.map(item => ({
            id: item.id,
            itemId: item.itemId,
            quantity: item.quantity,
            requestId: item.requestId,
            notes: item.notes,
            itemName: item.itemName,
            itemNo: item.itemNo,
            nsn: item.nsn,
            itemType: item.itemType
        })),

        creationDate: normalized.creationDate,
        isMyTurn: normalized.isMyTurn,

        returnToDepotId: normalized.returnToDepotId,
        deliveryDate: normalized.deliveryDate,
        returnToDepot: normalized.returnToDepot ?? undefined
    };

    return ret;
}

/**
 * Map BaseRequestDto to DiscardDto
 * Transforms the unified structure to Discard-specific structure
 */
export function mapToDiscardDto(base: UnifiedListRequestDto): DiscardDto {
    const normalized = normalizeBaseRequestDto(base);

    const discard: DiscardDto = {
        id: normalized.id,
        requestNo: normalized.requestNo,
        requestType: normalized.requestType,
        reason: normalized.reason,
        priority: normalized.priority,
        status: normalized.status,
        notes: normalized.notes,
        requestPurposeNotes: normalized.requestPurposeNotes,
        departmentId: normalized.departmentId,
        requesterId: normalized.requesterId,
        requestPurposeId: normalized.requestPurposeId,

        department: normalized.department ? {
            id: normalized.department.id,
            code: normalized.department.code,
            nameAr: normalized.department.nameAr,
            nameEn: normalized.department.nameEn,
            isDeleted: normalized.department.isDeleted
        } : undefined,

        requester: normalized.requester ? {
            id: normalized.requester.id,
            userName: normalized.requester.userName,
            fullNameEN: normalized.requester.fullNameEN,
            fullNameAR: normalized.requester.fullNameAR,
            militoryId: normalized.requester.militoryId,
            email: normalized.requester.email,
            rank: normalized.requester.rank ?? undefined,
            department: normalized.requester.department ?? undefined
        } : undefined,

        requestPurpose: normalized.requestPurpose ? {
            id: normalized.requestPurpose.id,
            nameAr: normalized.requestPurpose.nameAr,
            nameEn: normalized.requestPurpose.nameEn,
            requestType: normalized.requestPurpose.requestType
        } : undefined,

        requestItems: normalized.requestItems?.map(item => ({
            id: item.id,
            itemId: item.itemId,
            quantity: item.quantity,
            requestId: item.requestId,
            notes: item.notes,
            itemName: item.itemName,
            itemNo: item.itemNo,
            nsn: item.nsn,
            itemType: item.itemType
        })),

        creationDate: normalized.creationDate,
        isMyTurn: normalized.isMyTurn
    };

    return discard;
}

/**
 * Separate requests by type
 * Returns an object with arrays for each request type
 * Handles both string and numeric enum values
 */
export function separateRequestsByType(requests: UnifiedListRequestDto[]): {
    orders: UnifiedListRequestDto[];
    returns: UnifiedListRequestDto[];
    discards: UnifiedListRequestDto[];
} {
    const normalizedRequests = requests.map(r => normalizeBaseRequestDto(r));

    return {
        orders: normalizedRequests.filter(r => r.requestType === RequestType.Order),
        returns: normalizedRequests.filter(r => r.requestType === RequestType.Return),
        discards: normalizedRequests.filter(r => r.requestType === RequestType.Discard)
    };
}

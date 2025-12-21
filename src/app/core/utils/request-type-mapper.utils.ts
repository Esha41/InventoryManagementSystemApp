/**
 * Request Type Mapper Utilities
 * Maps unified BaseRequestDto to specific request types (Order, Return, Discard)
 * Following Angular best practices for data transformation
 */

import { BaseRequestDto } from '@services/unified-request.service';
import { OrderDto } from '@services/order.service';
import { ReturnDto } from '@services/return.service';
import { DiscardDto } from '@services/discard.service';

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
 * Convert string priority to number
 */
function normalizePriority(priority: number | string): number {
    if (typeof priority === 'number') {
        return priority;
    }

    const priorityMap: { [key: string]: number } = {
        'Critical': 0,
        'High': 1,
        'Medium': 2,
        'Low': 3
    };

    return priorityMap[priority] || 2; // Default to Medium
}

/**
 * Convert string status to number
 */
function normalizeStatus(status: number | string): number {
    if (typeof status === 'number') {
        return status;
    }

    const statusMap: { [key: string]: number } = {
        'New': 1,
        'UnderProcess': 2,
        'Approved': 3,
        'Rejected': 4,
        'Cancelled': 5,
        'ReturnedForReview': 6
    };

    return statusMap[status] || 1; // Default to New
}

/**
 * Convert string item type to number
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
        'Explosive': 3
    };

    return itemTypeMap[itemType];
}

/**
 * Normalize BaseRequestDto to ensure all enums are numbers
 */
function normalizeBaseRequestDto(request: BaseRequestDto): BaseRequestDto {
    return {
        ...request,
        requestType: normalizeRequestType(request.requestType),
        priority: normalizePriority(request.priority),
        status: normalizeStatus(request.status),
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
export function mapToOrderDto(base: BaseRequestDto): OrderDto {
    // Normalize enums first
    const normalized = normalizeBaseRequestDto(base);

    return {
        id: normalized.id,
        requestNo: normalized.requestNo,
        orderNo: normalized.requestNo, // Alias for compatibility
        requestType: normalized.requestType,
        reason: normalized.reason,
        priority: normalized.priority,
        status: normalized.status,
        notes: normalized.notes,
        departmentId: normalized.departmentId,
        requesterId: normalized.requesterId,
        requestPurposeId: normalized.requestPurposeId,

        // Flattened navigation properties for convenience
        departmentNameAr: normalized.department?.nameAr,
        departmentNameEn: normalized.department?.nameEn,
        requesterName: normalized.requester?.fullNameEN || normalized.requester?.fullNameAR || normalized.requester?.userName,
        requestPurposeNameAr: normalized.requestPurpose?.nameAr,
        requestPurposeNameEn: normalized.requestPurpose?.nameEn,

        // Nested objects for localization (similar to ReturnDto and DiscardDto)
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
            rank: normalized.requester.rank,
            department: normalized.requester.department
        } : undefined,

        // Request items
        requestItems: normalized.requestItems?.map(item => ({
            id: item.id,
            itemId: item.itemId,
            quantity: item.quantity,
            notes: item.notes,
            itemName: item.itemName,
            itemNo: item.itemNo,
            itemType: item.itemType
        })),

        // Order-specific properties (mapped from BaseRequestDto if available)
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
        depotNameAr: normalized.depotNameAr,
        depotNameEn: normalized.depotNameEn,
        recieverId: normalized.receiverId,
        recieverName: normalized.receiverName,
        depotId: normalized.depotId,

        // Audit fields from BaseRequestDto
        creationDate: normalized.creationDate
    } as OrderDto;
}

/**
 * Map BaseRequestDto to ReturnDto
 * Transforms the unified structure to Return-specific structure
 */
export function mapToReturnDto(base: BaseRequestDto): ReturnDto {
    // Normalize enums first
    const normalized = normalizeBaseRequestDto(base);

    return {
        id: normalized.id,
        requestNo: normalized.requestNo,
        requestType: normalized.requestType,
        reason: normalized.reason,
        priority: normalized.priority,
        status: normalized.status,
        notes: normalized.notes,
        departmentId: normalized.departmentId,
        requesterId: normalized.requesterId,
        requestPurposeId: normalized.requestPurposeId,

        // Nested navigation objects (Return uses nested structure)
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
            rank: normalized.requester.rank,
            department: normalized.requester.department
        } : undefined,

        requestPurpose: normalized.requestPurpose ? {
            id: normalized.requestPurpose.id,
            nameAr: normalized.requestPurpose.nameAr,
            nameEn: normalized.requestPurpose.nameEn,
            requestType: normalized.requestPurpose.requestType
        } : undefined,

        // Request items
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

        // Audit fields from BaseRequestDto
        creationDate: normalized.creationDate
    } as ReturnDto;
}

/**
 * Map BaseRequestDto to DiscardDto
 * Transforms the unified structure to Discard-specific structure
 */
export function mapToDiscardDto(base: BaseRequestDto): DiscardDto {
    // Normalize enums first
    const normalized = normalizeBaseRequestDto(base);

    return {
        id: normalized.id,
        requestNo: normalized.requestNo,
        requestType: normalized.requestType,
        reason: normalized.reason,
        priority: normalized.priority,
        status: normalized.status,
        notes: normalized.notes,
        departmentId: normalized.departmentId,
        requesterId: normalized.requesterId,
        requestPurposeId: normalized.requestPurposeId,

        // Nested navigation objects (Discard uses nested structure)
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
            rank: normalized.requester.rank,
            department: normalized.requester.department
        } : undefined,

        requestPurpose: normalized.requestPurpose ? {
            id: normalized.requestPurpose.id,
            nameAr: normalized.requestPurpose.nameAr,
            nameEn: normalized.requestPurpose.nameEn,
            requestType: normalized.requestPurpose.requestType
        } : undefined,

        // Request items
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

        // Audit fields from BaseRequestDto
        creationDate: normalized.creationDate
    } as DiscardDto;
}

/**
 * Separate requests by type
 * Returns an object with arrays for each request type
 * Handles both string and numeric enum values
 */
export function separateRequestsByType(requests: BaseRequestDto[]): {
    orders: BaseRequestDto[];
    returns: BaseRequestDto[];
    discards: BaseRequestDto[];
} {
    // Normalize all requests first
    const normalizedRequests = requests.map(r => normalizeBaseRequestDto(r));

    return {
        orders: normalizedRequests.filter(r => r.requestType === RequestType.Order),
        returns: normalizedRequests.filter(r => r.requestType === RequestType.Return),
        discards: normalizedRequests.filter(r => r.requestType === RequestType.Discard)
    };
}

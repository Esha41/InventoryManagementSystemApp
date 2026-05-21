/**
 * Request Type Mapper Utilities
 * Maps unified BaseRequestDto to specific request types (Order, Return, Discard)
 * Following Angular best practices for data transformation
 */

import { UnifiedListRequestDto } from '@models/unified-list-request.model';
import { OrderDto } from '@models/order.model';
import { ReturnDto } from '@models/return.model';
import { DiscardDto } from '@models/discard.model';

import { RequestType } from '@models/backend-enums';

export { RequestType } from '@models/backend-enums';

function normalizeRequestType(requestType: number): number {
    return requestType;
}

function normalizePriority(priority: number): number {
    return priority;
}

function normalizeStatus(status: number): number {
    return status;
}

function normalizeItemType(itemType: number | undefined): number | undefined {
    return itemType;
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

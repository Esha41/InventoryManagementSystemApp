/**
 * Common file upload models used across the application
 */

/**
 * Enum to identify which domain entity a file belongs to.
 * Maps to backend FileEntityType enum.
 */
export enum FileEntityType {
    Ammunition = 1,
    Order = 2,
    Workflow = 3,
    WorkflowApproval = 4,
    Supply = 5,
    Return = 6,
    Weapon = 7,
    Explosive = 8,
    Asset = 9,
    AssetSupply = 10,
    /** Help Center articles / Help Me landing attachments (backend FileEntityType.HelpCenter). */
    HelpCenter = 11,
    /** User manual downloads (singleton bundle: use entityId = 1). */
    HelpCenterUserManual = 12,
    ReturnTrackingLine = 13,
    Accessory = 14
}

/**
 * File upload DTO matching backend structure
 */
export interface FileUploadDto {
    id: number;
    fileUrl: string;
    fileName: string;
    originalName: string;
    isMain: boolean;
    entity: number;
    entityId: number;
    /** Present when the file fulfills a request-purpose attachment slot (order create). */
    attachmentRequirementId?: number | null;
    attachmentRequirementNameEn?: string | null;
    attachmentRequirementNameAr?: string | null;
}

export const ORDER_RECEIVER_SIGNATURE_SLOT_NAME_EN = 'Order Receiver Signature';

/** True when the file is tagged as the order receiver signature slot, or legacy filename. */
export function isOrderReceiverSignatureFile(file: FileUploadDto): boolean {
    const slotName = file.attachmentRequirementNameEn?.trim();
    if (slotName === ORDER_RECEIVER_SIGNATURE_SLOT_NAME_EN) {
        return true;
    }
    const originalName = (file.originalName || file.fileName || '').toLowerCase();
    return originalName === 'receiver-signature.png';
}

import {
    LucideIconData,
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    UserCheck,
    UserMinus,
    ArrowLeftRight,
    RefreshCw,
    PackageCheck,
    MapPin,
    Wrench,
    ShieldCheck,
    Trash2,
    AlertTriangle,
    Flame,
    PenLine,
    PackageOpen,
    HelpCircle
} from 'lucide-angular';

/** Mirrors backend Ettad.Data.Enums.AssetHistoryActionType (numeric values). */
export enum AssetHistoryActionType {
    Created = 1,
    Assigned = 2,
    Returned = 3,
    Transferred = 4,
    StatusChanged = 5,
    Supplied = 6,
    LocationChanged = 7,
    MaintenanceStarted = 8,
    MaintenanceCompleted = 9,
    Disposed = 10,
    Lost = 11,
    Damaged = 12,
    Updated = 13,
    Received = 14
}

interface ActionTypeMeta {
    labelKey: string;
    descriptionKey: string;
    dotClass: string;
    icon: LucideIconData;
    /** Flip icon horizontally in RTL (asymmetric glyphs). */
    mirrorInRtl?: boolean;
}

const ACTION_TYPE_METADATA: Record<AssetHistoryActionType, ActionTypeMeta> = {
    [AssetHistoryActionType.Created]: {
        labelKey: 'assetHistory.actionType.created',
        descriptionKey: 'assetHistory.description.created',
        dotClass: 'bg-emerald-500',
        icon: CheckCircle
    },
    [AssetHistoryActionType.Assigned]: {
        labelKey: 'assetHistory.actionType.assigned',
        descriptionKey: 'assetHistory.description.assigned',
        dotClass: 'bg-blue-500',
        icon: UserCheck,
        mirrorInRtl: true
    },
    [AssetHistoryActionType.Returned]: {
        labelKey: 'assetHistory.actionType.returned',
        descriptionKey: 'assetHistory.description.returned',
        dotClass: 'bg-amber-500',
        icon: UserMinus,
        mirrorInRtl: true
    },
    [AssetHistoryActionType.Transferred]: {
        labelKey: 'assetHistory.actionType.transferred',
        descriptionKey: 'assetHistory.description.transferred',
        dotClass: 'bg-cyan-500',
        icon: ArrowLeftRight
    },
    [AssetHistoryActionType.StatusChanged]: {
        labelKey: 'assetHistory.actionType.statusChanged',
        descriptionKey: 'assetHistory.description.statusChanged',
        dotClass: 'bg-violet-500',
        icon: RefreshCw
    },
    [AssetHistoryActionType.Supplied]: {
        labelKey: 'assetHistory.actionType.supplied',
        descriptionKey: 'assetHistory.description.supplied',
        dotClass: 'bg-teal-500',
        icon: PackageCheck,
        mirrorInRtl: true
    },
    [AssetHistoryActionType.LocationChanged]: {
        labelKey: 'assetHistory.actionType.locationChanged',
        descriptionKey: 'assetHistory.description.locationChanged',
        dotClass: 'bg-sky-500',
        icon: MapPin
    },
    [AssetHistoryActionType.MaintenanceStarted]: {
        labelKey: 'assetHistory.actionType.maintenanceStarted',
        descriptionKey: 'assetHistory.description.maintenanceStarted',
        dotClass: 'bg-yellow-500',
        icon: Wrench
    },
    [AssetHistoryActionType.MaintenanceCompleted]: {
        labelKey: 'assetHistory.actionType.maintenanceCompleted',
        descriptionKey: 'assetHistory.description.maintenanceCompleted',
        dotClass: 'bg-emerald-400',
        icon: ShieldCheck
    },
    [AssetHistoryActionType.Disposed]: {
        labelKey: 'assetHistory.actionType.disposed',
        descriptionKey: 'assetHistory.description.disposed',
        dotClass: 'bg-red-500',
        icon: Trash2
    },
    [AssetHistoryActionType.Lost]: {
        labelKey: 'assetHistory.actionType.lost',
        descriptionKey: 'assetHistory.description.lost',
        dotClass: 'bg-red-700',
        icon: AlertTriangle
    },
    [AssetHistoryActionType.Damaged]: {
        labelKey: 'assetHistory.actionType.damaged',
        descriptionKey: 'assetHistory.description.damaged',
        dotClass: 'bg-red-600',
        icon: Flame
    },
    [AssetHistoryActionType.Updated]: {
        labelKey: 'assetHistory.actionType.updated',
        descriptionKey: 'assetHistory.description.updated',
        dotClass: 'bg-slate-400',
        icon: PenLine,
        mirrorInRtl: true
    },
    [AssetHistoryActionType.Received]: {
        labelKey: 'assetHistory.actionType.received',
        descriptionKey: 'assetHistory.description.received',
        dotClass: 'bg-indigo-500',
        icon: PackageOpen,
        mirrorInRtl: true
    }
};

function resolveMeta(actionType?: number | null): ActionTypeMeta | null {
    if (actionType == null) return null;
    return ACTION_TYPE_METADATA[actionType as AssetHistoryActionType] ?? null;
}

/** i18n key for the action type title (e.g. "Status Changed"). */
export function getHistoryActionTypeKey(actionType?: number | null): string {
    return resolveMeta(actionType)?.labelKey ?? 'assetHistory.actionType.unknown';
}

/** i18n key for the descriptive sentence template (supports interpolation params). */
export function getHistoryDescriptionKey(actionType?: number | null): string {
    return resolveMeta(actionType)?.descriptionKey ?? 'assetHistory.description.unknown';
}

/** Tailwind color class for the timeline dot. */
export function getHistoryActionTypeDotClass(actionType?: number | null): string {
    return resolveMeta(actionType)?.dotClass ?? 'bg-[var(--color-brand)]';
}

/** Lucide icon for the action type. */
export function getHistoryActionTypeIcon(actionType?: number | null): LucideIconData {
    return resolveMeta(actionType)?.icon ?? HelpCircle;
}

/** Arrow for old → new transitions (status, custodian, location). */
export function getHistoryFlowArrowIcon(isRtl: boolean): LucideIconData {
    return isRtl ? ArrowLeft : ArrowRight;
}

/** Optional Tailwind class to mirror asymmetric action icons in RTL. */
export function getHistoryActionTypeIconClass(actionType?: number | null, isRtl?: boolean): string {
    if (!isRtl) return '';
    return resolveMeta(actionType)?.mirrorInRtl ? '-scale-x-100' : '';
}

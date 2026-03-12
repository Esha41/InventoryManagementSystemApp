/**
 * Announcement Models and Interfaces
 */

import { Priority } from '../utils/priority.utils';

export enum AnnouncementDeliveryType {
    Banner = 1,
    Notification = 2,
    Both = 3
}

export interface Announcement {
    id: number;
    message: string;
    priority: Priority;
    deliveryType: AnnouncementDeliveryType;
    isDismissable: boolean;
    startDate: Date | string;
    endDate?: Date | string | null;
    targetRoles?: string[] | null;
    isActive: boolean;
    creationDate: Date | string;
    createdBy?: string;
}

export interface CreateAnnouncementDto {
    message: string;
    priority: Priority;
    deliveryType: AnnouncementDeliveryType;
    isDismissable: boolean;
    startDate: Date | string;
    endDate?: Date | string | null;
    targetRoles?: string[] | null;
    isActive?: boolean;
}

export interface UpdateAnnouncementDto {
    message?: string;
    priority?: Priority;
    deliveryType?: AnnouncementDeliveryType;
    isDismissable?: boolean;
    startDate?: Date | string;
    endDate?: Date | string | null;
    targetRoles?: string[] | null;
    isActive?: boolean;
}

export interface ActiveAnnouncement {
    id: number;
    message: string;
    priority: Priority;
    deliveryType: AnnouncementDeliveryType;
    isDismissable: boolean;
}

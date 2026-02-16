/**
 * Announcement Models and Interfaces
 */

import { Priority } from '../utils/priority.utils';

export interface Announcement {
    id: number;
    message: string;
    priority: Priority;
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
    isDismissable: boolean;
    startDate: Date | string;
    endDate?: Date | string | null;
    targetRoles?: string[] | null;
    isActive?: boolean;
}

export interface UpdateAnnouncementDto {
    message?: string;
    priority?: Priority;
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
    isDismissable: boolean;
}

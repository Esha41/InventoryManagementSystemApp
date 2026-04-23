import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiService } from '@services/api.service';
import {
    Announcement,
    CreateAnnouncementDto,
    UpdateAnnouncementDto,
    ActiveAnnouncement
} from '@models/announcement.model';
import { ApiResponse } from '@models/api-response.model';

@Injectable({
    providedIn: 'root'
})
export class AnnouncementService {
    private readonly endpoint = '/announcement';

    constructor(private apiService: ApiService) { }

    /** Emits when active announcements should be refreshed (e.g. after create/update/delete). */
    private readonly refreshActive$ = new Subject<void>();
    readonly refreshActiveAnnouncements$ = this.refreshActive$.asObservable();

    /** Call after create/update/delete so the banner refreshes. */
    notifyActiveAnnouncementsChanged(): void {
        this.refreshActive$.next();
    }

    /**
     * Get all announcements (Admin only)
     */
    getAll(): Observable<ApiResponse<Announcement[]>> {
        return this.apiService.getRaw<Announcement[]>(this.endpoint) as unknown as Observable<ApiResponse<Announcement[]>>;
    }

    /**
     * Get announcement by ID (Admin only)
     */
    getById(id: number): Observable<ApiResponse<Announcement>> {
        return this.apiService.getRaw<Announcement>(`${this.endpoint}/${id}`) as unknown as Observable<ApiResponse<Announcement>>;
    }

    /**
     * Get active announcements for current user
     */
    getActive(): Observable<ApiResponse<ActiveAnnouncement[]>> {
        return this.apiService.getRaw<ActiveAnnouncement[]>(`${this.endpoint}/active`) as unknown as Observable<ApiResponse<ActiveAnnouncement[]>>;
    }

    /**
     * Create new announcement (Admin only)
     */
    create(dto: CreateAnnouncementDto): Observable<ApiResponse<Announcement>> {
        return this.apiService.postRaw<Announcement>(this.endpoint, dto) as unknown as Observable<ApiResponse<Announcement>>;
    }

    /**
     * Update announcement (Admin only)
     */
    update(id: number, dto: UpdateAnnouncementDto): Observable<ApiResponse<Announcement>> {
        return this.apiService.putRaw<Announcement>(`${this.endpoint}/${id}`, dto) as unknown as Observable<ApiResponse<Announcement>>;
    }

    /**
     * Delete announcement (Admin only)
     */
    delete(id: number): Observable<ApiResponse<boolean>> {
        return this.apiService.deleteRaw<boolean>(`${this.endpoint}/${id}`) as unknown as Observable<ApiResponse<boolean>>;
    }

    /**
     * Dismiss announcement for current user
     */
    dismiss(id: number): Observable<ApiResponse<boolean>> {
        return this.apiService.postRaw<boolean>(`${this.endpoint}/${id}/dismiss`, {}) as unknown as Observable<ApiResponse<boolean>>;
    }
}

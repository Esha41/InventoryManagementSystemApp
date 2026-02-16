import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    Announcement,
    CreateAnnouncementDto,
    UpdateAnnouncementDto,
    ActiveAnnouncement
} from '../models/announcement.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
    providedIn: 'root'
})
export class AnnouncementService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/announcement`;

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
        return this.http.get<ApiResponse<Announcement[]>>(this.apiUrl);
    }

    /**
     * Get announcement by ID (Admin only)
     */
    getById(id: number): Observable<ApiResponse<Announcement>> {
        return this.http.get<ApiResponse<Announcement>>(`${this.apiUrl}/${id}`);
    }

    /**
     * Get active announcements for current user
     */
    getActive(): Observable<ApiResponse<ActiveAnnouncement[]>> {
        return this.http.get<ApiResponse<ActiveAnnouncement[]>>(`${this.apiUrl}/active`);
    }

    /**
     * Create new announcement (Admin only)
     */
    create(dto: CreateAnnouncementDto): Observable<ApiResponse<Announcement>> {
        return this.http.post<ApiResponse<Announcement>>(this.apiUrl, dto);
    }

    /**
     * Update announcement (Admin only)
     */
    update(id: number, dto: UpdateAnnouncementDto): Observable<ApiResponse<Announcement>> {
        return this.http.put<ApiResponse<Announcement>>(`${this.apiUrl}/${id}`, dto);
    }

    /**
     * Delete announcement (Admin only)
     */
    delete(id: number): Observable<ApiResponse<boolean>> {
        return this.http.delete<ApiResponse<boolean>>(`${this.apiUrl}/${id}`);
    }

    /**
     * Dismiss announcement for current user
     */
    dismiss(id: number): Observable<ApiResponse<boolean>> {
        return this.http.post<ApiResponse<boolean>>(`${this.apiUrl}/${id}/dismiss`, {});
    }
}

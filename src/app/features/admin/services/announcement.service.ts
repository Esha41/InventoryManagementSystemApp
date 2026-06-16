import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiService } from '@services/api.service';
import {
    Announcement,
    CreateAnnouncementDto,
    UpdateAnnouncementDto,
    ActiveAnnouncement
} from '@models/announcement.model';

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
    getAll(): Observable<Announcement[]> {
        return this.apiService.get<Announcement[]>(this.endpoint);
    }

    /**
     * Get announcement by ID (Admin only)
     */
    getById(id: number): Observable<Announcement> {
        return this.apiService.get<Announcement>(`${this.endpoint}/${id}`);
    }

    /**
     * Get active announcements for current user
     */
    getActive(): Observable<ActiveAnnouncement[]> {
        return this.apiService.get<ActiveAnnouncement[]>(`${this.endpoint}/active`);
    }

    /**
     * Create new announcement (Admin only)
     */
    create(dto: CreateAnnouncementDto): Observable<Announcement> {
        return this.apiService.post<Announcement>(this.endpoint, dto);
    }

    /**
     * Update announcement (Admin only)
     */
    update(id: number, dto: UpdateAnnouncementDto): Observable<Announcement> {
        return this.apiService.put<Announcement>(`${this.endpoint}/${id}`, dto);
    }

    /**
     * Delete announcement (Admin only)
     */
    delete(id: number): Observable<boolean> {
        return this.apiService.delete<boolean>(`${this.endpoint}/${id}`);
    }

    /**
     * Dismiss announcement for current user
     */
    dismiss(id: number): Observable<boolean> {
        return this.apiService.post<boolean>(`${this.endpoint}/${id}/dismiss`, {});
    }
}

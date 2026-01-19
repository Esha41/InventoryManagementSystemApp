import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LookupService, LookupItem } from '@services/lookup.service';
import { BackendUserService } from '@services/backend-user.service';
import { BackendUserDto } from '@models/backend-user.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { getCurrentLang } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';

/**
 * Service to handle loading and managing lookup data (depots, users, ranks)
 */
@Injectable()
export class WeaponSupplyLookupService {

    // Depots
    availableDepots: LookupItem[] = [];
    depotDropdownOptions: DropdownOption<number>[] = [];

    // Users
    availableUsers: BackendUserDto[] = [];
    userDropdownOptions: DropdownOption<string>[] = [];

    // Ranks
    ranks: LookupItem[] = [];

    constructor(
        private lookupService: LookupService,
        private backendUserService: BackendUserService,
        private translate: TranslateService
    ) { }

    /**
     * Load all depots
     */
    loadDepots(): Observable<LookupItem[]> {
        return new Observable(observer => {
            this.lookupService.getDepots().subscribe({
                next: (depots: LookupItem[]) => {
                    this.availableDepots = depots.filter(d => !d.isDeleted);
                    this.depotDropdownOptions = this.createDepotOptions();
                    observer.next(depots);
                    observer.complete();
                },
                error: (error) => {
                    observer.error(error);
                }
            });
        });
    }

    /**
     * Load all users
     */
    loadUsers(): Observable<BackendUserDto[]> {
        return new Observable(observer => {
            this.backendUserService.getUsers().subscribe({
                next: (users: BackendUserDto[]) => {
                    this.availableUsers = users || [];
                    this.userDropdownOptions = this.createUserOptions();
                    observer.next(users);
                    observer.complete();
                },
                error: (error) => {
                    observer.error(error);
                }
            });
        });
    }

    /**
     * Load all ranks
     */
    loadRanks(): Observable<LookupItem[]> {
        return new Observable(observer => {
            this.lookupService.getLookupItems('Rank').subscribe({
                next: (ranks: LookupItem[]) => {
                    this.ranks = ranks || [];
                    observer.next(ranks);
                    observer.complete();
                },
                error: (error) => {
                    observer.error(error);
                }
            });
        });
    }

    /**
     * Get user display name by ID
     */
    getUserDisplayName(userId: string): string {
        if (!userId) return '';
        const user = this.availableUsers.find(u => u.id === userId);
        if (!user) return userId;
        const currentLang = getCurrentLang(this.translate);
        return currentLang === 'ar'
            ? (user.nameAr || user.userName)
            : (user.nameEn || user.userName);
    }

    /**
     * Create depot dropdown options
     */
    private createDepotOptions(): DropdownOption<number>[] {
        const currentLang = getCurrentLang(this.translate);
        return this.availableDepots.map(depot => ({
            value: depot.id!,
            label: currentLang === 'ar'
                ? (depot.nameAr || depot.nameEn || `Depot ${depot.id}`)
                : (depot.nameEn || depot.nameAr || `Depot ${depot.id}`),
            description: depot.code || ''
        })).sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * Create user dropdown options
     */
    private createUserOptions(): DropdownOption<string>[] {
        const currentLang = getCurrentLang(this.translate);
        return this.availableUsers.map(user => ({
            value: user.id,
            label: currentLang === 'ar'
                ? (user.nameAr || user.userName)
                : (user.nameEn || user.userName),
            description: user.userName
        })).sort((a, b) => a.label.localeCompare(b.label));
    }
}

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { LookupService, LookupItem } from '@services/lookup.service';
import { EmployeeService } from '@services/employee.service';
import { EmployeeDto } from '@core/models/asset.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class WeaponSupplyLookupService {

    availableDepots: LookupItem[] = [];
    depotDropdownOptions: DropdownOption<number>[] = [];

    availableEmployees: EmployeeDto[] = [];
    employeeDropdownOptions: DropdownOption<number>[] = [];

    ranks: LookupItem[] = [];
    rankDropdownOptions: DropdownOption<number>[] = [];

    constructor(
        private lookupService: LookupService,
        private employeeService: EmployeeService,
        private translate: TranslateService
    ) { }

    loadDepots(): Observable<LookupItem[]> {
        return this.lookupService.getDepots().pipe(
            tap((depots: LookupItem[]) => {
                this.availableDepots = depots.filter(d => !d.isDeleted);
                this.depotDropdownOptions = this.createDepotOptions();
            })
        );
    }

    loadEmployees(): Observable<EmployeeDto[]> {
        return this.employeeService.getEmployees().pipe(
            map((employees: EmployeeDto[]) => (employees || []).filter(e => !e.isDeleted)),
            tap((employees: EmployeeDto[]) => {
                this.availableEmployees = employees;
                this.employeeDropdownOptions = this.createEmployeeOptions();
            })
        );
    }

    loadRanks(): Observable<LookupItem[]> {
        return this.lookupService.getLookupItems('Rank').pipe(
            tap((ranks: LookupItem[]) => {
                this.ranks = ranks || [];
                this.rankDropdownOptions = this.createRankOptions();
            })
        );
    }

    private createRankOptions(): DropdownOption<number>[] {
        const currentLang = getCurrentLang(this.translate);
        return this.ranks.map(rank => ({
            value: rank.id!,
            label: getLocalizedName(rank, currentLang) || `Rank ${rank.id}`
        })).sort((a, b) => a.label.localeCompare(b.label));
    }

    resolveEmployeeByUserId(userId: string): number | undefined {
        if (!userId) return undefined;
        const employee = this.availableEmployees.find(e => e.userId === userId);
        return employee?.id;
    }

    getEmployeeDisplayName(employeeId: number): string {
        if (!employeeId) return '';
        const employee = this.availableEmployees.find(e => e.id === employeeId);
        if (!employee) return String(employeeId);
        const currentLang = getCurrentLang(this.translate);
        return currentLang === 'ar'
            ? (employee.nameAr || employee.nameEn || String(employeeId))
            : (employee.nameEn || employee.nameAr || String(employeeId));
    }

    getDepotDisplayName(depotId: number): string {
        if (!depotId) return '';
        const depot = this.availableDepots.find(d => d.id === depotId);
        if (!depot) return String(depotId);
        return getLocalizedName(depot, getCurrentLang(this.translate)) || String(depotId);
    }

    private createDepotOptions(): DropdownOption<number>[] {
        const currentLang = getCurrentLang(this.translate);
        return this.availableDepots.map(depot => ({
            value: depot.id!,
            label: getLocalizedName(depot, currentLang) || `Depot ${depot.id}`,
            description: depot.code || ''
        })).sort((a, b) => a.label.localeCompare(b.label));
    }

    refreshDepotOptionsOnLangChange(): void {
        if (this.availableDepots.length > 0) {
            this.depotDropdownOptions = this.createDepotOptions();
        }
        if (this.availableEmployees.length > 0) {
            this.employeeDropdownOptions = this.createEmployeeOptions();
        }
        if (this.ranks.length > 0) {
            this.rankDropdownOptions = this.createRankOptions();
        }
    }

    private createEmployeeOptions(): DropdownOption<number>[] {
        const currentLang = getCurrentLang(this.translate);
        return this.availableEmployees.map(emp => ({
            value: emp.id,
            label: currentLang === 'ar'
                ? (emp.nameAr || emp.nameEn || String(emp.id))
                : (emp.nameEn || emp.nameAr || String(emp.id)),
            description: emp.militaryId || emp.email || ''
        })).sort((a, b) => a.label.localeCompare(b.label));
    }
}

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserDelegationService } from '../../../../../core/services/user-delegation.service';
import { UserDelegation } from '../../../../../core/models/user-delegation';
import { ApiResponse } from '@models/api-response.model';
import { LucideAngularModule, Users, Calendar, User, AlertCircle, Filter, RefreshCw } from 'lucide-angular';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-admin-delegations',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule,
        AppDatePipe
    ],
    templateUrl: './admin-delegations.component.html',
    styleUrls: ['./admin-delegations.component.css']
})
export class AdminDelegationsComponent implements OnInit {
    readonly Users = Users;
    readonly Calendar = Calendar;
    readonly User = User;
    readonly AlertCircle = AlertCircle;
    readonly Filter = Filter;
    readonly RefreshCw = RefreshCw;

    delegations: UserDelegation[] = [];
    filteredDelegations: UserDelegation[] = [];
    isLoading = false;
    filterStatus: 'all' | 'pending' | 'approved' | 'rejected' | 'active' | 'expired' = 'all';

    constructor(
        private delegationService: UserDelegationService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadDelegations();
    }


    loadDelegations(): void {
        this.isLoading = true;
        this.delegationService.getAllDelegations()
            .pipe(finalize(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res: ApiResponse<UserDelegation[]>) => {
                    this.delegations = res?.succeeded && res.data ? res.data : [];
                    this.applyFilter();
                },
                error: () => {
                    this.delegations = [];
                    this.filteredDelegations = [];
                }
            });
    }

    setFilter(status: 'all' | 'pending' | 'approved' | 'rejected' | 'active' | 'expired'): void {
        this.filterStatus = status;
        this.applyFilter();
    }

    applyFilter(): void {
        if (this.filterStatus === 'all') {
            this.filteredDelegations = [...this.delegations];
        } else if (this.filterStatus === 'pending') {
            this.filteredDelegations = this.delegations.filter(d => d.delegationStatus === 0);
        } else if (this.filterStatus === 'approved') {
            this.filteredDelegations = this.delegations.filter(d => d.delegationStatus === 1);
        } else if (this.filterStatus === 'rejected') {
            this.filteredDelegations = this.delegations.filter(d => d.delegationStatus === 2);
        } else if (this.filterStatus === 'active') {
            this.filteredDelegations = this.delegations.filter(d => d.status === 'Active');
        } else if (this.filterStatus === 'expired') {
            this.filteredDelegations = this.delegations.filter(d => d.status === 'Expired');
        }
        this.cdr.detectChanges();
    }

    getStatusBadgeClass(delegation: UserDelegation): string {
        if (delegation.delegationStatus === 0) return 'badge-warning';
        if (delegation.delegationStatus === 1) return 'badge-success';
        if (delegation.delegationStatus === 2) return 'badge-danger';
        return 'badge-muted';
    }

    getTimeBadgeClass(delegation: UserDelegation): string {
        if (delegation.status === 'Active') return 'badge-success';
        if (delegation.status === 'Future') return 'badge-info';
        if (delegation.status === 'Expired') return 'badge-muted';
        return 'badge-muted';
    }

    refresh(): void {
        this.loadDelegations();
    }
}

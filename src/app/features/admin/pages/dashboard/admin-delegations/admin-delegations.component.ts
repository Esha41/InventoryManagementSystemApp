import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserDelegationService } from '../../../../../core/services/user-delegation.service';
import { UserDelegation } from '../../../../../core/models/user-delegation';
import { LucideAngularModule, Users, Calendar, User, AlertCircle, Filter, RefreshCw, ArrowRight, Ban, Network } from 'lucide-angular';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { finalize } from 'rxjs/operators';
import { ToastService } from '@services/toast.service';
import { ConfirmationDialogComponent } from '@shared/components/confirmation-dialog/confirmation-dialog.component';

@Component({
    selector: 'app-admin-delegations',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule,
        AppDatePipe,
        ConfirmationDialogComponent
    ],
    templateUrl: './admin-delegations.component.html',
    styleUrls: ['./admin-delegations.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDelegationsComponent implements OnInit {
    readonly Users = Users;
    readonly Calendar = Calendar;
    readonly User = User;
    readonly AlertCircle = AlertCircle;
    readonly Filter = Filter;
    // RefreshCw removed as button is removed
    readonly ArrowRight = ArrowRight;
    readonly Ban = Ban;
    readonly Network = Network;

    delegations: UserDelegation[] = [];
    filteredDelegations: UserDelegation[] = [];
    isLoading = false;
    filterStatus: 'all' | 'pending' | 'approved' | 'rejected' | 'active' | 'expired' = 'all';

    // Settings
    allowCrossDepartment = true;
    allowDelegatorAction = true;
    isSettingsLoading = false;

    // Revoke Dialog State
    showRevokeDialog = false;
    selectedDelegationForRevoke: UserDelegation | null = null;

    constructor(
        private delegationService: UserDelegationService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
    ) { }

    ngOnInit(): void {
        this.loadDelegations();
        this.loadSettings();
    }

    loadDelegations(): void {
        // ... (existing logic) ...
        this.isLoading = true;
        this.delegationService.getAllDelegations()
            .pipe(finalize(() => {
                this.isLoading = false;
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (data) => {
                    this.delegations = Array.isArray(data) ? data : [];
                    this.applyFilter();
                },
                error: () => {
                    this.delegations = [];
                    this.filteredDelegations = [];
                }
            });
    }

    loadSettings(): void {
        this.isSettingsLoading = true;

        // Load Cross Department Setting
        this.delegationService.getCrossDepartmentSetting()
            .subscribe({
                next: (value) => {
                    this.allowCrossDepartment = value;
                }
            });

        // Load Delegator Action Setting
        this.delegationService.getDelegatorActionSetting()
            .pipe(finalize(() => {
                this.isSettingsLoading = false;
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (value) => {
                    this.allowDelegatorAction = value;
                }
            });
    }

    toggleCrossDepartment(): void {
        const newValue = !this.allowCrossDepartment;
        this.isSettingsLoading = true;

        this.delegationService.updateCrossDepartmentSetting(newValue)
            .pipe(finalize(() => {
                this.isSettingsLoading = false;
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (success) => {
                    if (success) {
                        this.allowCrossDepartment = newValue;
                        this.toast.success(this.translate.instant('DELEGATION.SETTINGS.UPDATE_SUCCESS') || 'Delegation settings updated successfully');
                    } else {
                        this.toast.error('Failed to update settings');
                    }
                },
                error: () => {
                    this.toast.error('Failed to update settings');
                }
            });
    }

    toggleDelegatorAction(): void {
        const newValue = !this.allowDelegatorAction;
        this.isSettingsLoading = true;

        this.delegationService.updateDelegatorActionSetting(newValue)
            .pipe(finalize(() => {
                this.isSettingsLoading = false;
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (success) => {
                    if (success) {
                        this.allowDelegatorAction = newValue;
                        this.toast.success(this.translate.instant('DELEGATION.SETTINGS.UPDATE_SUCCESS') || 'Delegation settings updated successfully');
                    } else {
                        this.toast.error('Failed to update settings');
                    }
                },
                error: () => {
                    this.toast.error('Failed to update settings');
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
        this.cdr.markForCheck();
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
        this.loadSettings();
    }

    revokeDelegation(delegation: UserDelegation): void {
        this.selectedDelegationForRevoke = delegation;
        this.showRevokeDialog = true;
    }

    onRevokeConfirmed(): void {
        if (!this.selectedDelegationForRevoke) return;

        const id = this.selectedDelegationForRevoke.id;
        this.showRevokeDialog = false;
        this.isLoading = true;

        this.delegationService.revoke(id)
            .pipe(finalize(() => {
                this.isLoading = false;
                this.selectedDelegationForRevoke = null;
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (success) => {
                    if (success) {
                        this.toast.success('Delegation revoked successfully');
                        this.refresh();
                    } else {
                        this.toast.error('Failed to revoke delegation');
                    }
                },
                error: () => {
                    this.toast.error('Failed to revoke delegation');
                }
            });
    }

    onRevokeCancelled(): void {
        this.showRevokeDialog = false;
        this.selectedDelegationForRevoke = null;
    }
}

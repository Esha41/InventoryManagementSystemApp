import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserDelegationService } from '@admin/services/user-delegation.service';
import { UserDelegation } from '@models/user-delegation';
import { AddDelegationModalComponent } from './add-delegation-modal/add-delegation-modal.component';
import { ConfirmationDialogComponent } from '@components/confirmation-dialog/confirmation-dialog.component';
import { LucideAngularModule, Plus, Trash2, Calendar, User, AlertCircle, CheckCircle, XCircle, Ban } from 'lucide-angular';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-delegation-list',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        AddDelegationModalComponent,
        ConfirmationDialogComponent,
        LucideAngularModule,
        AppDatePipe
    ],
    templateUrl: './delegation-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DelegationListComponent implements OnInit {
    readonly Plus = Plus;
    readonly Trash2 = Trash2;
    readonly Calendar = Calendar;
    readonly User = User;
    readonly AlertCircle = AlertCircle;
    readonly CheckCircle = CheckCircle;
    readonly Ban = Ban;
    readonly XCircle = XCircle;

    activeTab: 'my-delegations' | 'pending-requests' = 'my-delegations';
    delegations: UserDelegation[] = [];
    pendingDelegations: UserDelegation[] = [];
    showAddModal = false;
    isLoading = false;

    // Confirmation dialog state
    showRevokeDialog = false;
    delegationToRevoke: UserDelegation | null = null;

    showApproveDialog = false;
    showRejectDialog = false;
    delegationToProcess: UserDelegation | null = null;

    constructor(
        private delegationService: UserDelegationService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadDelegations();
        this.loadPendingDelegations();
    }

    switchTab(tab: 'my-delegations' | 'pending-requests'): void {
        this.activeTab = tab;
    }

    loadDelegations(): void {
        this.isLoading = true;
        this.delegationService.getMyDelegations()
            .pipe(finalize(() => {
                this.isLoading = false;
                this.cdr.markForCheck();
            }))
            .subscribe({
                next: (data) => {
                    this.delegations = Array.isArray(data) ? data : [];
                },
                error: () => {
                    this.delegations = [];
                }
            });
    }

    loadPendingDelegations(): void {
        this.delegationService.getPendingDelegations()
            .subscribe({
                next: (data) => {
                    this.pendingDelegations = Array.isArray(data) ? data : [];
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.pendingDelegations = [];
                }
            });
    }

    openAddModal(): void {
        this.showAddModal = true;
    }

    onModalClose(refresh: boolean): void {
        this.showAddModal = false;
        if (refresh) {
            this.loadDelegations();
        }
    }

    revoke(delegation: UserDelegation): void {
        this.delegationToRevoke = delegation;
        this.showRevokeDialog = true;
    }

    onRevokeConfirmed(): void {
        if (this.delegationToRevoke) {
            this.delegationService.revoke(this.delegationToRevoke.id).subscribe({
                next: (success) => {
                    if (success) {
                        this.loadDelegations();
                    }
                }
            });
        }
        this.showRevokeDialog = false;
        this.delegationToRevoke = null;
    }

    onRevokeCancelled(): void {
        this.showRevokeDialog = false;
        this.delegationToRevoke = null;
    }

    approve(delegation: UserDelegation): void {
        this.delegationToProcess = delegation;
        this.showApproveDialog = true;
    }

    reject(delegation: UserDelegation): void {
        this.delegationToProcess = delegation;
        this.showRejectDialog = true;
    }

    onApproveConfirmed(): void {
        if (this.delegationToProcess) {
            this.delegationService.approve(this.delegationToProcess.id).subscribe({
                next: (success) => {
                    if (success) {
                        this.loadPendingDelegations();
                        this.loadDelegations();
                    } else {
                        // If checking failed (e.g. revoked), reload to update list
                        this.loadPendingDelegations();
                        this.loadDelegations();
                    }
                },
                error: (_err) => {
                    // On error also reload to be safe and sync state
                    this.loadPendingDelegations();
                    this.loadDelegations();
                }
            });
        }
        this.showApproveDialog = false;
        this.delegationToProcess = null;
    }

    onApproveCancelled(): void {
        this.showApproveDialog = false;
        this.delegationToProcess = null;
    }

    onRejectConfirmed(): void {
        if (this.delegationToProcess) {
            this.delegationService.reject(this.delegationToProcess.id).subscribe({
                next: (success) => {
                    if (success) {
                        this.loadPendingDelegations();
                        this.loadDelegations();
                    } else {
                        // If checking failed (e.g. revoked), reload to update list
                        this.loadPendingDelegations();
                        this.loadDelegations();
                    }
                },
                error: (_err) => {
                    // On error also reload to be safe and sync state
                    this.loadPendingDelegations();
                    this.loadDelegations();
                }
            });
        }
        this.showRejectDialog = false;
        this.delegationToProcess = null;
    }

    onRejectCancelled(): void {
        this.showRejectDialog = false;
        this.delegationToProcess = null;
    }
}

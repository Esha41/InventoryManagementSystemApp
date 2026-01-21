import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserDelegationService } from '@services/user-delegation.service';
import { UserDelegation } from '@models/user-delegation';
import { AddDelegationModalComponent } from './add-delegation-modal/add-delegation-modal.component';
import { ConfirmationDialogComponent } from '@components/confirmation-dialog/confirmation-dialog.component';
import { LucideAngularModule, Plus, Trash2, Calendar, User, AlertCircle, CheckCircle, XCircle } from 'lucide-angular';
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
    templateUrl: './delegation-list.component.html'
})
export class DelegationListComponent implements OnInit {
    readonly Plus = Plus;
    readonly Trash2 = Trash2;
    readonly Calendar = Calendar;
    readonly User = User;
    readonly AlertCircle = AlertCircle;
    readonly CheckCircle = CheckCircle;
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
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res) => {
                    this.delegations = res?.succeeded && res.data ? res.data : [];
                },
                error: () => {
                    this.delegations = [];
                }
            });
    }

    loadPendingDelegations(): void {
        this.delegationService.getPendingDelegations()
            .subscribe({
                next: (res) => {
                    this.pendingDelegations = res?.succeeded && res.data ? res.data : [];
                    this.cdr.detectChanges();
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
                next: (res) => {
                    if (res?.succeeded) {
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
                next: (res) => {
                    if (res?.succeeded) {
                        this.loadPendingDelegations();
                    } else {
                        // If checking failed (e.g. revoked), reload to update list
                        this.loadPendingDelegations();
                    }
                },
                error: (err) => {
                    // On error also reload to be safe and sync state
                    this.loadPendingDelegations();
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
                next: (res) => {
                    if (res?.succeeded) {
                        this.loadPendingDelegations();
                    } else {
                        // If checking failed (e.g. revoked), reload to update list
                        this.loadPendingDelegations();
                    }
                },
                error: (err) => {
                    // On error also reload to be safe and sync state
                    this.loadPendingDelegations();
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

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserDelegationService } from '@services/user-delegation.service';
import { UserDelegation } from '@models/user-delegation';
import { ConfirmationDialogComponent } from '@components/confirmation-dialog/confirmation-dialog.component';
import { LucideAngularModule, CheckCircle, XCircle, Calendar, User, AlertCircle } from 'lucide-angular';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-pending-delegations',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        ConfirmationDialogComponent,
        LucideAngularModule,
        AppDatePipe
    ],
    templateUrl: './pending-delegations.component.html'
})
export class PendingDelegationsComponent implements OnInit {
    readonly CheckCircle = CheckCircle;
    readonly XCircle = XCircle;
    readonly Calendar = Calendar;
    readonly User = User;
    readonly AlertCircle = AlertCircle;

    pendingDelegations: UserDelegation[] = [];
    isLoading = false;

    // Confirmation dialog state
    showApproveDialog = false;
    showRejectDialog = false;
    delegationToProcess: UserDelegation | null = null;

    constructor(
        private delegationService: UserDelegationService,
        private translate: TranslateService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadPendingDelegations();
    }

    loadPendingDelegations(): void {
        this.isLoading = true;
        this.delegationService.getPendingDelegations()
            .pipe(finalize(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (res) => {
                    this.pendingDelegations = res?.succeeded && res.data ? res.data : [];
                },
                error: () => {
                    this.pendingDelegations = [];
                }
            });
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
                    }
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
                    }
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

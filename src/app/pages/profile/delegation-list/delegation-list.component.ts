import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserDelegationService } from '../../../core/services/user-delegation.service';
import { UserDelegation } from '../../../core/models/user-delegation';
import { AddDelegationModalComponent } from './add-delegation-modal/add-delegation-modal.component';
import { ConfirmationDialogComponent } from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { LucideAngularModule, Plus, Trash2, Calendar, User, AlertCircle } from 'lucide-angular';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-delegation-list',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        AddDelegationModalComponent,
        ConfirmationDialogComponent,
        LucideAngularModule
    ],
    templateUrl: './delegation-list.component.html'
})
export class DelegationListComponent implements OnInit {
    readonly Plus = Plus;
    readonly Trash2 = Trash2;
    readonly Calendar = Calendar;
    readonly User = User;
    readonly AlertCircle = AlertCircle;

    delegations: UserDelegation[] = [];
    showAddModal = false;
    isLoading = false;

    // Confirmation dialog state
    showRevokeDialog = false;
    delegationToRevoke: UserDelegation | null = null;

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
}

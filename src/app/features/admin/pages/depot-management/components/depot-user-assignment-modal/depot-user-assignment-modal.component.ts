import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, X, Search, User } from 'lucide-angular';
import { UserDepotService } from '@services/user-depot.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { BackendUserDto } from '@models/backend-user.model';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-depot-user-assignment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, LucideAngularModule, LoadingStateComponent],
  templateUrl: './depot-user-assignment-modal.component.html',
  styleUrls: ['./depot-user-assignment-modal.component.css']
})
export class DepotUserAssignmentModalComponent implements OnInit, OnDestroy {
  readonly X = X;
  readonly Search = Search;
  readonly User = User;

  @Input() depotId!: number;
  @Input() depotName = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  allUsers: BackendUserDto[] = [];
  assignedUserIds: Set<string> = new Set();
  selectedUserIds: Set<string> = new Set();
  loading = true;
  saving = false;
  error: string | null = null;

  searchControl = new FormControl<string>('', { nonNullable: true });

  private destroy$ = new Subject<void>();

  get filteredUsers(): BackendUserDto[] {
    const term = this.searchControl.value?.trim().toLowerCase() || '';
    if (!term) return this.allUsers;
    return this.allUsers.filter(u => {
      const name = this.getUserDisplayName(u).toLowerCase();
      const userName = (u.userName || '').toLowerCase();
      const id = (u.id || '').toLowerCase();
      return name.includes(term) || userName.includes(term) || id.includes(term);
    });
  }

  constructor(
    private userDepotService: UserDepotService,
    private backendUserService: BackendUserService,
    private toastService: ToastService,
    private translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.loading = true;
    this.error = null;

    this.userDepotService.getDepotUsers(this.depotId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depotUsers) => {
          this.assignedUserIds = new Set(depotUsers.map(u => u.id));
          this.selectedUserIds = new Set(this.assignedUserIds);
          this.loadAllUsers();
        },
        error: (err) => {
          this.error = 'Failed to load depot users';
          this.loading = false;
        }
      });
  }

  private loadAllUsers(): void {
    this.backendUserService.getUsers({ page: 1, pageSize: 500 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.allUsers = response?.items ?? [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          if (!this.error) {
            this.error = 'Failed to load users';
          }
        }
      });
  }

  getUserDisplayName(user: BackendUserDto): string {
    return getLocalizedName(
      { nameEn: user.nameEn, nameAr: user.nameAr, fullNameEN: (user as any).fullNameEN, fullNameAR: (user as any).fullNameAR },
      getCurrentLang(this.translateService)
    ) || user.userName || user.id || '';
  }

  isSelected(userId: string): boolean {
    return this.selectedUserIds.has(userId);
  }

  toggleUser(userId: string): void {
    if (this.selectedUserIds.has(userId)) {
      this.selectedUserIds.delete(userId);
    } else {
      this.selectedUserIds.add(userId);
    }
    this.selectedUserIds = new Set(this.selectedUserIds);
  }

  selectAll(): void {
    const usersToSelect = this.filteredUsers.length > 0 ? this.filteredUsers : this.allUsers;
    const newSelected = new Set(this.selectedUserIds);
    usersToSelect.forEach(u => newSelected.add(u.id));
    this.selectedUserIds = newSelected;
  }

  clearAll(): void {
    this.selectedUserIds.clear();
  }

  save(): void {
    this.saving = true;
    this.error = null;

    this.userDepotService.updateDepotUsers(this.depotId, Array.from(this.selectedUserIds))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.toastService.success('Depot users updated successfully', 'Success');
          this.saved.emit();
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.message || err?.userMessage || 'Failed to update depot users';
          this.toastService.error(this.error ?? 'Failed to update depot users', 'Error');
        }
      });
  }

  close(): void {
    this.closed.emit();
  }
}

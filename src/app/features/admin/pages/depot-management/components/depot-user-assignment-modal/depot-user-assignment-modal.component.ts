import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, merge, takeUntil } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { LucideAngularModule, X, Search, User } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { UserDepotService } from '@services/user-depot.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { BackendUserDto } from '@models/backend-user.model';
import { LoadingStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { trackByStringId } from '@utils/trackby.utils';

@Component({
  selector: 'app-depot-user-assignment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, LucideAngularModule, LoadingStateComponent, DropdownComponent],
  templateUrl: './depot-user-assignment-modal.component.html',
  styleUrls: ['./depot-user-assignment-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepotUserAssignmentModalComponent implements OnInit, OnDestroy {
  readonly X = X;
  readonly Search = Search;
  readonly User = User;
  readonly trackByStringId = trackByStringId;

  readonly assignmentFilterOptions: DropdownOption<'all' | 'selected' | 'unselected'>[] = [
    { label: 'depot.filterAllUsers', value: 'all' },
    { label: 'depot.filterSelected', value: 'selected' },
    { label: 'depot.filterUnselected', value: 'unselected' }
  ];

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

  assignmentFilterControl = new FormControl<'all' | 'selected' | 'unselected'>('all', { nonNullable: true });

  searchControl = new FormControl<string>('', { nonNullable: true });

  private destroy$ = new Subject<void>();

  get filteredUsers(): BackendUserDto[] {
    const term = this.searchControl.value?.trim().toLowerCase() || '';
    let users = term
      ? this.allUsers.filter(u => {
          const name = this.getUserDisplayName(u).toLowerCase();
          const userName = (u.userName || '').toLowerCase();
          const id = (u.id || '').toLowerCase();
          return name.includes(term) || userName.includes(term) || id.includes(term);
        })
      : this.allUsers;

    const filter = this.assignmentFilterControl.value;
    if (filter === 'selected') {
      users = users.filter(u => this.selectedUserIds.has(u.id));
    } else if (filter === 'unselected') {
      users = users.filter(u => !this.selectedUserIds.has(u.id));
    }

    return users;
  }

  constructor(
    private userDepotService: UserDepotService,
    private backendUserService: BackendUserService,
    private toastService: ToastService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    merge(
      this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
      this.assignmentFilterControl.valueChanges.pipe(startWith(this.assignmentFilterControl.value))
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());

    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

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
          this.cdr.markForCheck();
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
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          if (!this.error) {
            this.error = 'Failed to load users';
          }
          this.cdr.markForCheck();
        }
      });
  }

  getUserDisplayName(user: BackendUserDto): string {
    return getLocalizedName(
      { nameEn: user.nameEn, nameAr: user.nameAr, fullNameEN: user.fullNameEN, fullNameAR: user.fullNameAR },
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
    this.cdr.markForCheck();
  }

  selectAll(): void {
    const usersToSelect = this.filteredUsers.length > 0 ? this.filteredUsers : this.allUsers;
    const newSelected = new Set(this.selectedUserIds);
    usersToSelect.forEach(u => newSelected.add(u.id));
    this.selectedUserIds = newSelected;
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.selectedUserIds.clear();
    this.cdr.markForCheck();
  }

  save(): void {
    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    this.userDepotService.updateDepotUsers(this.depotId, Array.from(this.selectedUserIds))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.cdr.markForCheck();
          this.toastService.success('Depot users updated successfully', 'Success');
          this.saved.emit();
          this.close();
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.message || err?.userMessage || 'Failed to update depot users';
          this.cdr.markForCheck();
          this.toastService.error(this.error ?? 'Failed to update depot users', 'Error');
        }
      });
  }

  close(): void {
    this.closed.emit();
  }
}

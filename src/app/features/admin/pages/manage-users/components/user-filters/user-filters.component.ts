import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnDestroy, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, X } from 'lucide-angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { LookupItem } from '@models/lookup.model';
import { RoleDto } from '@models/backend-user.model';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';

/**
 * User Filters Component
 * Handles user search/filter UI
 */
@Component({
  selector: 'app-user-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TranslateModule,
    DropdownComponent
  ],
  templateUrl: './user-filters.component.html',
  styleUrls: ['./user-filters.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFiltersComponent implements OnInit, OnDestroy, OnChanges {
  readonly Search = Search;
  readonly X = X;
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() searchTerm: string = '';
  @Input() statusFilter: 'all' | 'active' | 'inactive' | 'deleted' = 'all';
  @Input() useSearchButton: boolean = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() searchTriggered = new EventEmitter<string>();
  @Output() statusFilterChange = new EventEmitter<'all' | 'active' | 'inactive' | 'deleted'>();

  @Input() ranks: LookupItem[] = [];
  @Input() departments: LookupItem[] = [];
  @Input() roles: RoleDto[] = [];

  @Input() selectedRankId: number | null = null;
  @Input() selectedDepartmentId: number | null = null;
  @Input() selectedRoleId: string | null = null;

  @Output() rankFilterChange = new EventEmitter<number | null>();
  @Output() departmentFilterChange = new EventEmitter<number | null>();
  @Output() roleFilterChange = new EventEmitter<string | null>();

  // Local copies to support two-way updates without mutating @Input directly
  rankFilterId: number | null = null;
  departmentFilterId: number | null = null;
  roleFilterId: string | null = null;

  readonly rankOptionLabel = (option: any): string =>
    getLocalizedName(option ?? null, getCurrentLang(this.translate));

  readonly departmentOptionLabel = (option: any): string =>
    getLocalizedName(option ?? null, getCurrentLang(this.translate));

  readonly roleOptionLabel = (option: any): string =>
    getLocalizedName(option ?? null, getCurrentLang(this.translate));

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  get showSearchClear(): boolean {
    return (this.searchTerm ?? '').trim().length > 0;
  }

  /** Tailwind `pe-*` (logical end); inline-start padding from global `--app-search-input-padding-start` via `app-search-field__input-ps`. */
  get searchInputPaddingEndClass(): string {
    if (this.useSearchButton) {
      return this.showSearchClear ? 'pe-[14rem]' : 'pe-[10.75rem]';
    }
    if (this.showSearchClear) {
      return 'pe-11';
    }
    return 'pe-4';
  }

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      if (!this.useSearchButton) {
        this.searchChange.emit(term);
      }
    });

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedRankId']) {
      this.rankFilterId = this.selectedRankId;
    }
    if (changes['selectedDepartmentId']) {
      this.departmentFilterId = this.selectedDepartmentId;
    }
    if (changes['selectedRoleId']) {
      this.roleFilterId = this.selectedRoleId;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(): void {
    if (!this.useSearchButton) {
      this.searchSubject.next(this.searchTerm);
    }
  }

  onSearchClick(): void {
    this.searchTriggered.emit(this.searchTerm);
  }

  onClearSearch(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.searchTerm = '';
    if (this.useSearchButton) {
      this.searchTriggered.emit('');
    } else {
      this.searchChange.emit('');
    }
    this.cdr.markForCheck();
  }

  onStatusFilterChange(status: 'all' | 'active' | 'inactive' | 'deleted'): void {
    this.statusFilter = status;
    this.statusFilterChange.emit(this.statusFilter);
  }

  onRankFilterChange(value: unknown): void {
    this.rankFilterId = this.toIdNumber(value);
    this.rankFilterChange.emit(this.rankFilterId);
  }

  clearRankFilter(event: MouseEvent): void {
    event.stopPropagation();
    this.rankFilterId = null;
    this.rankFilterChange.emit(null);
    this.cdr.markForCheck();
  }

  onDepartmentFilterChange(value: unknown): void {
    this.departmentFilterId = this.toIdNumber(value);
    this.departmentFilterChange.emit(this.departmentFilterId);
  }

  clearDepartmentFilter(event: MouseEvent): void {
    event.stopPropagation();
    this.departmentFilterId = null;
    this.departmentFilterChange.emit(null);
  }

  onRoleFilterChange(value: unknown): void {
    this.roleFilterId = this.toIdString(value) ?? null;
    this.roleFilterChange.emit(this.roleFilterId);
  }

  clearRoleFilter(event: MouseEvent): void {
    event.stopPropagation();
    this.roleFilterId = null;
    this.roleFilterChange.emit(null);
  }

  private toIdNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    // Single select may emit the raw primitive id or the option object (type inference).
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    // If it's an option object with an id field.
    if (typeof value === 'object' && value !== null && 'id' in value) {
      const id = (value as any).id;
      if (typeof id === 'number') return id;
      if (typeof id === 'string') {
        const n = Number(id);
        return Number.isFinite(n) ? n : null;
      }
    }

    // If it's an array (shouldn't happen for single select, but handle defensively).
    if (Array.isArray(value) && value.length > 0) {
      return this.toIdNumber(value[0]);
    }

    return null;
  }

  private toIdString(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const extractOne = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'object' && v !== null && 'id' in v) {
        const id = (v as any).id;
        if (id === null || id === undefined) return null;
        return String(id);
      }
      return null;
    };

    if (Array.isArray(value)) {
      const first = value.length > 0 ? extractOne(value[0]) : null;
      return first && first.trim().length > 0 ? first : null;
    }

    const one = extractOne(value);
    return one && one.trim().length > 0 ? one : null;
  }
}

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import {
  CreateUpdateItemDepartmentAssignmentDto,
  BaseItemWithType
} from '@models/item-department-assignment.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { isAmmunitionType, isWeaponType, isExplosiveType } from '@utils/item-type.utils';
import { Subject, takeUntil } from 'rxjs';

export type AssignmentFormData = Omit<CreateUpdateItemDepartmentAssignmentDto, 'departmentId'> & {
  departmentId: number | null;
};

@Component({
  selector: 'app-assignment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent],
  templateUrl: './assignment-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentModalComponent implements OnInit, OnDestroy {
  readonly X = X;

  @Input() isOpen = false;
  @Input() isEditMode = false;
  @Input() departments: LookupItem[] = [];
  @Input() allItems: BaseItemWithType[] = [];
  @Input() currentAssignment: AssignmentFormData = this.getEmptyAssignment();
  @Input() currentAssignmentId = 0;
  @Input() selectedAmmunitionIds: number[] = [];
  @Input() selectedWeaponIds: number[] = [];
  @Input() selectedExplosiveIds: number[] = [];
  @Input() availableItems: BaseItemWithType[] = [];
  @Input() loading = false;
  @Input() errorMessage: string | null = null;

  @Output() save = new EventEmitter<void>();
  @Output() assignmentDismissed = new EventEmitter<void>();
  @Output() departmentChange = new EventEmitter<number | string | null>();
  @Output() itemSelectChange = new EventEmitter<number>();
  @Output() ammunitionChange = new EventEmitter<number[]>();
  @Output() weaponsChange = new EventEmitter<number[]>();
  @Output() explosivesChange = new EventEmitter<number[]>();

  private readonly destroy$ = new Subject<void>();

  constructor(
    public translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.translateService.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get availableAmmunition(): BaseItemWithType[] {
    return (this.availableItems || []).filter((i) => isAmmunitionType(i.itemType));
  }

  get availableWeapons(): BaseItemWithType[] {
    return (this.availableItems || []).filter((i) => isWeaponType(i.itemType));
  }

  get availableExplosives(): BaseItemWithType[] {
    return (this.availableItems || []).filter((i) => isExplosiveType(i.itemType));
  }

  getLocalizedName(dept: LookupItem | null | undefined): string {
    return getLocalizedName(dept, getCurrentLang(this.translateService)) ?? '';
  }

  getDepartmentOptionLabel = (
    option: LookupItem | DropdownOption<LookupItem | null | undefined> | null | undefined
  ): string => {
    if (!option) return '';
    const item =
      option && 'value' in option
        ? (option as DropdownOption<LookupItem | null | undefined>).value
        : option;
    return this.getLocalizedName(item ?? undefined);
  };

  getItemOptionLabel = (
    option: BaseItemWithType | DropdownOption<BaseItemWithType | null | undefined> | null | undefined
  ): string => {
    if (!option) return '';
    const item =
      option && 'value' in option
        ? (option as DropdownOption<BaseItemWithType | null | undefined>).value
        : option;
    if (!item) return '';

    const lang = getCurrentLang(this.translateService);
    const name =
      getLocalizedName({ name: item.name, nameAr: item.nameAr ?? undefined }, lang)?.trim() ||
      item.name ||
      item.displayLabel ||
      '';
    const itemNo = (item.itemNo ?? '').trim();
    return itemNo ? `${name} (${itemNo})` : name;
  };

  private getEmptyAssignment(): AssignmentFormData {
    return { itemId: 0, departmentId: null, notes: '' };
  }

  onSave(): void {
    this.save.emit();
  }

  onCancel(): void {
    this.assignmentDismissed.emit();
  }

  onDepartmentChange(value: number | string | null): void {
    this.departmentChange.emit(value);
  }

  onItemSelectChange(itemId: number): void {
    this.itemSelectChange.emit(itemId);
  }

  onAmmunitionChange(ids: number[]): void {
    this.ammunitionChange.emit(
      (ids || []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)).filter((id) => !isNaN(id))
    );
  }

  onWeaponsChange(ids: number[]): void {
    this.weaponsChange.emit(
      (ids || []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)).filter((id) => !isNaN(id))
    );
  }

  onExplosivesChange(ids: number[]): void {
    this.explosivesChange.emit(
      (ids || []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id)).filter((id) => !isNaN(id))
    );
  }
}

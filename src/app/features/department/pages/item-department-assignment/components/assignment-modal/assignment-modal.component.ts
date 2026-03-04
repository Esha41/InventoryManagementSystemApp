import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@shared/components/dropdown/dropdown.component';
import {
  CreateUpdateItemDepartmentAssignmentDto,
  BaseItemWithType
} from '@models/item-department-assignment.model';
import { LookupItem } from '@models/lookup.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { isAmmunitionType, isWeaponType, isExplosiveType } from '@utils/item-type.utils';

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
export class AssignmentModalComponent {
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
  @Output() cancel = new EventEmitter<void>();
  @Output() departmentChange = new EventEmitter<number | string | null>();
  @Output() itemSelectChange = new EventEmitter<number>();
  @Output() ammunitionChange = new EventEmitter<number[]>();
  @Output() weaponsChange = new EventEmitter<number[]>();
  @Output() explosivesChange = new EventEmitter<number[]>();

  constructor(
    public translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

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

  private getEmptyAssignment(): AssignmentFormData {
    return { itemId: 0, departmentId: null, notes: '' };
  }

  onSave(): void {
    this.save.emit();
  }

  onCancel(): void {
    this.cancel.emit();
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

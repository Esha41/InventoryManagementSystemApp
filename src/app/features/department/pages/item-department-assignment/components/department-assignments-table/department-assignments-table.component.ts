import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { PERMISSIONS } from '@constants/permissions.constants';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Plus, Trash2 } from 'lucide-angular';
import { ItemDepartmentAssignmentDto } from '@models/item-department-assignment.model';
import { BaseItemWithType } from '@models/item-department-assignment.model';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { getItemTypeName, getAssetDetailsTab } from '@utils/item-type.utils';

@Component({
  selector: 'app-department-assignments-table',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, HasPermissionDirective],
  templateUrl: './department-assignments-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentAssignmentsTableComponent {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Plus = Plus;
  readonly Trash2 = Trash2;

  @Input() assignments: ItemDepartmentAssignmentDto[] = [];
  @Input() allItems: BaseItemWithType[] = [];
  @Input() departmentId!: number;

  @Output() deleteAssignment = new EventEmitter<ItemDepartmentAssignmentDto>();
  @Output() addItems = new EventEmitter<number>();

  constructor(private router: Router) {}

  getItemNSN(itemId: number): string {
    const item = this.allItems.find((i) => i.id === itemId);
    return item?.nsn ?? '-';
  }

  getItemPartNo(itemId: number): string {
    const item = this.allItems.find((i) => i.id === itemId);
    return item?.partNo ?? '-';
  }

  getItemTypeName(itemType: number | string | undefined): string {
    return getItemTypeName(itemType);
  }

  navigateToAssetDetails(assignment: ItemDepartmentAssignmentDto): void {
    const tab = getAssetDetailsTab(assignment.itemType);
    const queryParams: { tab?: string; returnTo: string } = { returnTo: '/department/item-department-assignment' };
    if (tab) {
      queryParams.tab = tab;
    }
    this.router.navigate(['/assets/asset-list', assignment.itemId], { queryParams });
  }

  onDelete(assignment: ItemDepartmentAssignmentDto): void {
    this.deleteAssignment.emit(assignment);
  }

  onAddItems(): void {
    this.addItems.emit(this.departmentId);
  }
}

import { Injectable } from '@angular/core';
import { forkJoin, Observable, Subject, takeUntil } from 'rxjs';
import { ItemDepartmentAssignmentService } from '@admin/services/item-department-assignment.service';
import { LookupService } from '@services/lookup.service';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import {
  ItemDepartmentAssignmentDto,
  CreateUpdateItemDepartmentAssignmentDto,
  DepartmentAssignmentSummaryDto,
  BaseItemWithType
} from '@models/item-department-assignment.model';
import { LookupItem } from '@models/lookup.model';
import { BaseItemDto } from '@models/inventory.model';

export interface LoadDataResult {
  departments: LookupItem[];
  departmentSummaries: DepartmentAssignmentSummaryDto[];
  allItems: BaseItemWithType[];
}

@Injectable()
export class ItemDepartmentAssignmentFacade {
  private destroy$ = new Subject<void>();
  private _assignments: ItemDepartmentAssignmentDto[] = [];
  private _assignmentsByDepartment = new Map<number, ItemDepartmentAssignmentDto[]>();

  constructor(
    private assignmentService: ItemDepartmentAssignmentService,
    private lookupService: LookupService,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService
  ) {}

  get assignments(): ItemDepartmentAssignmentDto[] {
    return this._assignments;
  }

  get assignmentsByDepartment(): Map<number, ItemDepartmentAssignmentDto[]> {
    return this._assignmentsByDepartment;
  }

  loadData(): Observable<LoadDataResult> {
    return new Observable((subscriber) => {
      forkJoin({
        summaries: this.assignmentService.getDepartmentSummaries(),
        departments: this.lookupService.getDepartments(),
        ammunition: this.ammunitionService.getAll<BaseItemDto>(),
        weapons: this.weaponService.getAll<BaseItemDto>(),
        explosives: this.explosiveService.getAll<BaseItemDto>()
      }).subscribe({
        next: (results) => {
          const departments = results.departments
            ? results.departments.filter((d: LookupItem) => !d.isDeleted)
            : [];
          const departmentSummaries = Array.isArray(results.summaries) ? results.summaries : [];
          this._assignments = [];
          this._assignmentsByDepartment.clear();

          const ammo: BaseItemWithType[] = (results.ammunition || [])
            .filter((item: BaseItemDto) => !item.isDeleted)
            .map((item: BaseItemDto) => ({
              ...item,
              itemType: 1,
              displayLabel: `${item.name} (${item.itemNo})`
            }));
          const weapons: BaseItemWithType[] = (results.weapons || [])
            .filter((item: BaseItemDto) => !item.isDeleted)
            .map((item: BaseItemDto) => ({
              ...item,
              itemType: 2,
              displayLabel: `${item.name} (${item.itemNo})`
            }));
          const explosives: BaseItemWithType[] = (results.explosives || [])
            .filter((item: BaseItemDto) => !item.isDeleted)
            .map((item: BaseItemDto) => ({
              ...item,
              itemType: 3,
              displayLabel: `${item.name} (${item.itemNo})`
            }));
          const allItems = [...ammo, ...weapons, ...explosives];

          subscriber.next({ departments, departmentSummaries, allItems });
          subscriber.complete();
        },
        error: (err) => {
          subscriber.error(err);
        }
      });
    });
  }

  loadAssignmentsForDepartment(
    departmentId: number,
    destroy$: Subject<void>,
    onLoaded?: () => void
  ): void {
    if (this._assignmentsByDepartment.has(departmentId)) {
      onLoaded?.();
      return;
    }
    this.assignmentService
      .getByDepartmentId(departmentId)
      .pipe(takeUntil(destroy$))
      .subscribe({
        next: (list) => {
          const assignments = Array.isArray(list) ? list : [];
          this._assignments = this._assignments.filter(
            (a) => Number(a.departmentId) !== departmentId
          );
          assignments.forEach((a) => this._assignments.push(a));
          this._assignmentsByDepartment.set(departmentId, assignments);
          onLoaded?.();
        },
        error: () => {
          this._assignmentsByDepartment.set(departmentId, []);
          onLoaded?.();
        }
      });
  }

  removeAssignmentFromCache(assignmentId: number, departmentId: number): void {
    const deptAssignments = this._assignmentsByDepartment.get(departmentId);
    if (deptAssignments) {
      const updated = deptAssignments.filter((a) => a.id !== assignmentId);
      this._assignmentsByDepartment.set(departmentId, updated);
    }
    this._assignments = this._assignments.filter((a) => a.id !== assignmentId);
  }

  getDepartmentAssignments(departmentId: number): ItemDepartmentAssignmentDto[] {
    return this._assignmentsByDepartment.get(departmentId) || [];
  }

  create(dto: CreateUpdateItemDepartmentAssignmentDto): Observable<number> {
    return this.assignmentService.create(dto);
  }

  update(
    id: number,
    dto: CreateUpdateItemDepartmentAssignmentDto
  ): Observable<boolean> {
    return this.assignmentService.update(id, dto);
  }

  bulkAssign(
    assignments: CreateUpdateItemDepartmentAssignmentDto[]
  ): Observable<boolean> {
    return this.assignmentService.bulkAssign(assignments);
  }

  delete(id: number): Observable<boolean> {
    return this.assignmentService.delete(id);
  }

  getDepartmentSummaries(): Observable<DepartmentAssignmentSummaryDto[]> {
    return this.assignmentService.getDepartmentSummaries();
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

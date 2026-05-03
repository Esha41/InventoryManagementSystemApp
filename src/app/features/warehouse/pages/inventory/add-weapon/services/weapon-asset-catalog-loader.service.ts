import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LookupService, LookupItem } from '@services/lookup.service';
import { WeaponService } from '@assets/services/weapon.service';
import { EmployeeService } from '@admin/services/employee.service';
import { WeaponDto } from '@models/weapon.model';
import { EmployeeDto } from '@models/asset.model';

export interface WeaponAssetCatalogLoaded {
  currentDepot: LookupItem | null;
  availableWeapons: WeaponDto[];
  employees: EmployeeDto[];
  departments: LookupItem[];
  suppliers: LookupItem[];
  manufacturers: LookupItem[];
  allPrimaryPurposes: LookupItem[];
}

/**
 * Loads depots, weapons, employees, lookups for the add-weapon-asset page in one round trip.
 */
@Injectable({ providedIn: 'root' })
export class WeaponAssetCatalogLoaderService {
  constructor(
    private readonly lookupService: LookupService,
    private readonly weaponService: WeaponService,
    private readonly employeeService: EmployeeService
  ) {}

  loadCatalog(warehouseId: number): Observable<WeaponAssetCatalogLoaded> {
    return forkJoin({
      depot: this.lookupService.getDepots(),
      weapons: this.weaponService.getAll<WeaponDto>(),
      employees: this.employeeService.getEmployees(),
      departments: this.lookupService.getDepartments(),
      suppliers: this.lookupService.getSuppliers(),
      manufacturers: this.lookupService.getManufacturers(),
      primaryPurposes: this.lookupService.getPrimaryPurposes()
    }).pipe(
      map(({ depot, weapons, employees, departments, suppliers, manufacturers, primaryPurposes }) => ({
        currentDepot: depot.find(d => d.id === warehouseId) || null,
        availableWeapons: weapons,
        employees: (employees || []).filter(e => !e.isDeleted),
        departments: (departments || []).filter(d => !d.isDeleted),
        suppliers: (suppliers || []).filter(s => !s.isDeleted),
        manufacturers: (manufacturers || []).filter(m => !m.isDeleted),
        allPrimaryPurposes: (primaryPurposes || []).filter(p => !p.isDeleted)
      }))
    );
  }
}

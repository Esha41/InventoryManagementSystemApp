import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  LucideAngularModule,
  Loader2,
  AlertCircle,
  Package,
  CircleCheck
} from 'lucide-angular';
import { Cartridge } from '@models/cartridge.model';
import { WeaponDto } from '@models/weapon.model';
import { WeaponAssociation } from '@models/request-item.model';
import { ButtonComponent } from '@components/button/button.component';
import {
  DropdownComponent,
  DropdownOption
} from '@components/dropdown/dropdown.component';
import {
  resolveCatalogItemCaliberId,
  isCatalogItemExplicitlyDeleted
} from '@utils/catalog-caliber.utils';

const EMPTY_WEAPON_OPTIONS: DropdownOption<number>[] = [];
const EMPTY_WEAPON_IDS: number[] = [];

function sameWeaponIdSelection(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

@Component({
  selector: 'app-weapon-association',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent
  ],
  templateUrl: './weapon-association.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAssociationComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly Loader2 = Loader2;
  readonly AlertCircle = AlertCircle;
  readonly Package = Package;
  readonly CircleCheck = CircleCheck;

  @Input() ammunitionItems: Cartridge[] = [];
  @Input() allWeapons: WeaponDto[] = [];
  /** When set (non-empty), options per ammunition caliber come from the association API. */
  @Input() weaponsByAmmunitionCaliberId: Map<number, WeaponDto[]> | null = null;
  @Input() associations: Map<number, WeaponAssociation[]> = new Map();
  @Input() loadingWeapons = false;
  @Input() weaponLoadError: string | null = null;
  @Input() canProceed = false;

  @Output() associateCatalogWeapons = new EventEmitter<{
    ammoItemId: number;
    weaponIds: number[];
    caliberId: number | null;
  }>();
  @Output() associateOtherWeapon = new EventEmitter<{
    ammoItemId: number;
    otherName: string;
    caliberId: number | null;
  }>();
  @Output() clearAssociation = new EventEmitter<number>();
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  otherNameInput: Map<number, string> = new Map();
  /**
   * Explicit per-ammo section toggles. Unset entries fall back to
   * "is there an existing association of that type?" so re-entering the step
   * pre-expands the sections that already have data.
   */
  private readonly catalogSectionEnabled = new Map<number, boolean>();
  private readonly customSectionEnabled = new Map<number, boolean>();
  /** Per ammunition line: when true, catalog dropdown lists all assignable weapons. */
  private readonly viewAllWeaponsByAmmoId = new Map<number, boolean>();

  /** Stable option lists per ammunition line (avoid new array refs each CD). */
  private readonly weaponOptionsByAmmoId = new Map<number, DropdownOption<number>[]>();
  /** Local multi-select model per line (stable refs; synced from parent associations). */
  private readonly catalogWeaponIdsByAmmoId = new Map<number, number[]>();

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['ammunitionItems'] ||
      changes['allWeapons'] ||
      changes['weaponsByAmmunitionCaliberId']
    ) {
      this.rebuildWeaponOptions();
    }
    if (changes['associations']) {
      this.syncCatalogSelectionsFromAssociations();
      this.syncOtherNamesFromAssociations();
    }
  }

  trackByAmmoId(_index: number, ammo: Cartridge): number {
    return ammo.id;
  }

  weaponOptionsFor(ammoItemId: number): DropdownOption<number>[] {
    return this.weaponOptionsByAmmoId.get(ammoItemId) ?? EMPTY_WEAPON_OPTIONS;
  }

  catalogWeaponIdsFor(ammoItemId: number): number[] {
    return this.catalogWeaponIdsByAmmoId.get(ammoItemId) ?? EMPTY_WEAPON_IDS;
  }

  associationsForAmmo(ammoItemId: number): WeaponAssociation[] {
    return this.associations.get(ammoItemId) ?? [];
  }

  isCatalogSectionEnabled(ammoItemId: number): boolean {
    const explicit = this.catalogSectionEnabled.get(ammoItemId);
    if (explicit !== undefined) return explicit;
    return this.associationsForAmmo(ammoItemId).some(a => a.type === 'catalog');
  }

  isCustomSectionEnabled(ammoItemId: number): boolean {
    const explicit = this.customSectionEnabled.get(ammoItemId);
    if (explicit !== undefined) return explicit;
    return this.associationsForAmmo(ammoItemId).some(a => a.type === 'other');
  }

  toggleCatalogSection(ammoItemId: number): void {
    const next = !this.isCatalogSectionEnabled(ammoItemId);
    this.catalogSectionEnabled.set(ammoItemId, next);

    if (!next) {
      this.catalogWeaponIdsByAmmoId.delete(ammoItemId);
      const ammo = this.ammunitionItems.find(a => a.id === ammoItemId);
      this.associateCatalogWeapons.emit({
        ammoItemId,
        weaponIds: [],
        caliberId: ammo ? this.resolveAssociationCaliberId(ammo, []) : null
      });
    }
    this.cdr.markForCheck();
  }

  toggleCustomSection(ammoItemId: number): void {
    const next = !this.isCustomSectionEnabled(ammoItemId);
    this.customSectionEnabled.set(ammoItemId, next);

    if (!next) {
      this.otherNameInput.set(ammoItemId, '');
      const ammo = this.ammunitionItems.find(a => a.id === ammoItemId);
      const cal = ammo ? this.effectiveAmmoCaliberId(ammo) : null;
      this.associateOtherWeapon.emit({
        ammoItemId,
        otherName: '',
        caliberId: cal != null && Number.isFinite(Number(cal)) ? Number(cal) : null
      });
    }
    this.cdr.markForCheck();
  }

  onCatalogDropdownChange(
    ammo: Cartridge,
    value: number | number[] | null | undefined
  ): void {
    const ids = Array.isArray(value) ? value : value != null ? [Number(value)] : [];
    const uniq = [...new Set(ids.filter(id => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);

    const prev = this.catalogWeaponIdsFor(ammo.id);
    if (sameWeaponIdSelection(prev, uniq)) return;

    if (uniq.length === 0) {
      this.catalogWeaponIdsByAmmoId.delete(ammo.id);
    } else {
      this.catalogWeaponIdsByAmmoId.set(ammo.id, [...uniq]);
    }

    this.associateCatalogWeapons.emit({
      ammoItemId: ammo.id,
      weaponIds: uniq,
      caliberId: this.resolveAssociationCaliberId(ammo, uniq)
    });
  }

  private resolveAssociationCaliberId(ammo: Cartridge, weaponIds: readonly number[]): number | null {
    const ammoCal = this.effectiveAmmoCaliberId(ammo);
    if (ammoCal != null && Number.isFinite(Number(ammoCal))) return Number(ammoCal);

    for (const id of weaponIds) {
      const w = this.allWeapons.find(x => x.id === id);
      const wCal = w ? this.effectiveWeaponCaliberId(w) : null;
      if (wCal != null && Number.isFinite(Number(wCal))) return Number(wCal);
    }
    return null;
  }

  effectiveAmmoCaliberId(ammo: Cartridge): number | null {
    return resolveCatalogItemCaliberId(ammo);
  }

  effectiveWeaponCaliberId(w: WeaponDto): number | null {
    return resolveCatalogItemCaliberId(w);
  }

  ammoHasCaliberForFilter(ammo: Cartridge): boolean {
    const caliberId = this.effectiveAmmoCaliberId(ammo);
    return caliberId != null && Number.isFinite(Number(caliberId));
  }

  isViewingAllWeapons(ammoItemId: number): boolean {
    return this.viewAllWeaponsByAmmoId.get(ammoItemId) === true;
  }

  isViewingCompatibleWeapons(ammoItemId: number): boolean {
    return !this.isViewingAllWeapons(ammoItemId);
  }

  setWeaponCatalogScope(ammoItemId: number, scope: 'compatible' | 'all'): void {
    const viewingAll = scope === 'all';
    if (viewingAll === this.isViewingAllWeapons(ammoItemId)) return;

    if (viewingAll) {
      this.viewAllWeaponsByAmmoId.set(ammoItemId, true);
    } else {
      this.viewAllWeaponsByAmmoId.delete(ammoItemId);
    }
    this.rebuildWeaponOptionsForAmmo(ammoItemId);
    this.cdr.markForCheck();
  }

  shouldShowCompatibleOnlyEmptyHint(ammo: Cartridge): boolean {
    if (!this.ammoHasCaliberForFilter(ammo) || this.isViewingAllWeapons(ammo.id)) {
      return false;
    }
    return this.getCompatibleWeapons(this.effectiveAmmoCaliberId(ammo)).length === 0;
  }

  getCompatibleWeapons(ammoCaliberId: number | null | undefined): WeaponDto[] {
    if (ammoCaliberId == null || !Number.isFinite(Number(ammoCaliberId))) {
      return this.getAllAssignableWeapons();
    }
    const ammoCal = Number(ammoCaliberId);

    const byAmmoCal = this.weaponsByAmmunitionCaliberId;
    if (byAmmoCal && byAmmoCal.size > 0) {
      if (!byAmmoCal.has(ammoCal)) return [];
      return (byAmmoCal.get(ammoCal) ?? []).filter(w => !isCatalogItemExplicitlyDeleted(w));
    }

    return this.allWeapons.filter(w => {
      const wCal = this.effectiveWeaponCaliberId(w);
      return (
        wCal !== null &&
        wCal === ammoCal &&
        !isCatalogItemExplicitlyDeleted(w)
      );
    });
  }

  onOtherNameChange(ammoItemId: number, name: string): void {
    this.otherNameInput.set(ammoItemId, name);
    this.cdr.markForCheck();
  }

  canConfirmOtherWeapon(ammo: Cartridge): boolean {
    return !!(this.otherNameInput.get(ammo.id) ?? '').trim();
  }

  onOtherWeaponConfirm(ammo: Cartridge): void {
    const name = (this.otherNameInput.get(ammo.id) ?? '').trim();
    if (!name) return;

    const ammoCal = this.effectiveAmmoCaliberId(ammo);
    const caliberId =
      ammoCal != null && Number.isFinite(Number(ammoCal)) ? Number(ammoCal) : null;

    this.associateOtherWeapon.emit({
      ammoItemId: ammo.id,
      otherName: name,
      caliberId
    });
    this.cdr.markForCheck();
  }

  onOtherWeaponEnter(ammo: Cartridge, event: Event): void {
    event.preventDefault();
    if (this.canConfirmOtherWeapon(ammo)) {
      this.onOtherWeaponConfirm(ammo);
    }
  }

  firstOtherName(ammoItemId: number): string | null {
    const o = this.associationsForAmmo(ammoItemId).find(a => a.type === 'other');
    return o?.otherName?.trim() ?? null;
  }

  private rebuildWeaponOptions(): void {
    const nextIds = new Set(this.ammunitionItems.map(a => a.id));
    for (const id of this.weaponOptionsByAmmoId.keys()) {
      if (!nextIds.has(id)) {
        this.weaponOptionsByAmmoId.delete(id);
        this.catalogWeaponIdsByAmmoId.delete(id);
        this.viewAllWeaponsByAmmoId.delete(id);
        this.catalogSectionEnabled.delete(id);
        this.customSectionEnabled.delete(id);
        this.otherNameInput.delete(id);
      }
    }

    for (const ammo of this.ammunitionItems) {
      this.rebuildWeaponOptionsForAmmo(ammo.id);
    }
  }

  private rebuildWeaponOptionsForAmmo(ammoItemId: number): void {
    const ammo = this.ammunitionItems.find(a => a.id === ammoItemId);
    if (!ammo) return;

    const options = this.weaponsForAmmo(ammo).map(w => ({
      label: this.weaponOptionLabel(w),
      value: w.id
    }));
    this.weaponOptionsByAmmoId.set(ammoItemId, options);
  }

  private weaponsForAmmo(ammo: Cartridge): WeaponDto[] {
    const caliberId = this.effectiveAmmoCaliberId(ammo);
    if (caliberId == null || !Number.isFinite(Number(caliberId))) {
      return this.getCompatibleWeapons(null);
    }
    if (this.isViewingAllWeapons(ammo.id)) {
      return this.getAllAssignableWeapons();
    }
    return this.getCompatibleWeapons(caliberId);
  }

  private getAllAssignableWeapons(): WeaponDto[] {
    return this.allWeapons.filter(w => !isCatalogItemExplicitlyDeleted(w));
  }

  private syncCatalogSelectionsFromAssociations(): void {
    for (const ammo of this.ammunitionItems) {
      const ids = this.associationsForAmmo(ammo.id)
        .filter(a => a.type === 'catalog' && a.weaponItemId != null && a.weaponItemId > 0)
        .map(a => a.weaponItemId as number)
        .sort((a, b) => a - b);

      const prev = this.catalogWeaponIdsFor(ammo.id);
      if (sameWeaponIdSelection(prev, ids)) continue;

      if (ids.length === 0) {
        this.catalogWeaponIdsByAmmoId.delete(ammo.id);
      } else {
        this.catalogWeaponIdsByAmmoId.set(ammo.id, [...ids]);
      }
    }
  }

  private syncOtherNamesFromAssociations(): void {
    for (const ammo of this.ammunitionItems) {
      const other = this.associationsForAmmo(ammo.id).find(a => a.type === 'other');
      const name = other?.otherName?.trim() ?? '';
      if (!name) continue;
      this.otherNameInput.set(ammo.id, name);
    }
  }

  private weaponOptionLabel(w: WeaponDto): string {
    const base = w.name ?? '';
    return w.model ? `${base} — ${w.model}` : base;
  }
}

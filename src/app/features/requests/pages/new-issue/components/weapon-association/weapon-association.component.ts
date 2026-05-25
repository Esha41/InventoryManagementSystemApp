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
  CircleCheck,
  ChevronRight,
  ChevronDown,
  Search,
  X
} from 'lucide-angular';
import { Cartridge } from '@models/cartridge.model';
import { WeaponDto } from '@models/weapon.model';
import { WeaponAssociation } from '@models/request-item.model';
import { ButtonComponent } from '@components/button/button.component';
import {
  resolveCatalogItemCaliberId,
  isCatalogItemExplicitlyDeleted
} from '@utils/catalog-caliber.utils';

export type WeaponAssociationPanel = 'compatible' | 'all' | 'other';

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
    ButtonComponent
  ],
  templateUrl: './weapon-association.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAssociationComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  readonly Loader2 = Loader2;
  readonly AlertCircle = AlertCircle;
  readonly CircleCheck = CircleCheck;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly Search = Search;
  readonly X = X;

  /** File types accepted by the Weapon Association Attachments input. */
  readonly attachmentAcceptedTypes = '.pdf,.docx';

  @Input() ammunitionItems: Cartridge[] = [];
  @Input() allWeapons: WeaponDto[] = [];
  /** When set (non-empty), options per ammunition caliber come from the association API. */
  @Input() weaponsByAmmunitionCaliberId: Map<number, WeaponDto[]> | null = null;
  @Input() associations: Map<number, WeaponAssociation[]> = new Map();
  @Input() loadingWeapons = false;
  @Input() weaponLoadError: string | null = null;
  @Input() canProceed = false;
  /** Order-level files for the WEAPON_ASSOCIATION system slot. */
  @Input() attachmentFiles: File[] = [];
  /** True when at least one ammunition line uses a non-catalog ("other") weapon. */
  @Input() requiresAttachments = false;

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
  @Output() attachmentFilesChange = new EventEmitter<File[]>();
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  otherNameInput: Map<number, string> = new Map();

  private readonly expandedAmmoIds = new Set<number>();
  private readonly activePanelByAmmoId = new Map<number, WeaponAssociationPanel>();
  /** Per ammunition line: when true, catalog lists all assignable weapons. */
  private readonly viewAllWeaponsByAmmoId = new Map<number, boolean>();
  /** Local multi-select model per line (stable refs; synced from parent associations). */
  private readonly catalogWeaponIdsByAmmoId = new Map<number, number[]>();
  /** Per ammunition line: filters the catalog weapon list. */
  private readonly weaponSearchByAmmoId = new Map<number, string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['ammunitionItems'] ||
      changes['allWeapons'] ||
      changes['weaponsByAmmunitionCaliberId']
    ) {
      this.pruneStaleAmmoState();
    }
    if (changes['associations']) {
      const assocChange = changes['associations'];
      this.syncCatalogSelectionsFromAssociations();
      this.syncOtherNamesFromAssociations();

      if (assocChange.firstChange) {
        this.expandCollapsedRowsThatAlreadyHaveAssociations();
      } else {
        const prev = assocChange.previousValue as Map<number, WeaponAssociation[]> | undefined;
        if (prev instanceof Map) {
          this.expandCollapsedRowsWhereAssociationJustAppeared(prev);
        }
      }
    }
  }

  trackByAmmoId(_index: number, ammo: Cartridge): number {
    return ammo.id;
  }

  trackByWeaponId(_index: number, weapon: WeaponDto): number {
    return weapon.id;
  }

  catalogWeaponIdsFor(ammoItemId: number): number[] {
    return this.catalogWeaponIdsByAmmoId.get(ammoItemId) ?? EMPTY_WEAPON_IDS;
  }

  associationsForAmmo(ammoItemId: number): WeaponAssociation[] {
    return this.associations.get(ammoItemId) ?? [];
  }

  isAmmoExpanded(ammoItemId: number): boolean {
    return this.expandedAmmoIds.has(ammoItemId);
  }

  toggleAmmoExpanded(ammo: Cartridge, event?: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('button, input, app-button, label')) {
        return;
      }
    }

    if (this.expandedAmmoIds.has(ammo.id)) {
      this.expandedAmmoIds.delete(ammo.id);
      this.activePanelByAmmoId.delete(ammo.id);
      this.weaponSearchByAmmoId.delete(ammo.id);
    } else {
      this.expandedAmmoIds.add(ammo.id);
      this.selectDefaultPanel(ammo);
    }
    this.cdr.markForCheck();
  }

  /** First visible option: Compatible when applicable, otherwise View all weapons. */
  private selectDefaultPanel(ammo: Cartridge): void {
    const panel: WeaponAssociationPanel = this.hasCaliberFilterEffect(ammo)
      ? 'compatible'
      : 'all';
    this.activePanelByAmmoId.set(ammo.id, panel);
    this.setWeaponCatalogScope(ammo.id, panel);
  }

  activePanelFor(ammoItemId: number): WeaponAssociationPanel | null {
    return this.activePanelByAmmoId.get(ammoItemId) ?? null;
  }

  isActivePanel(ammoItemId: number, panel: WeaponAssociationPanel): boolean {
    return this.activePanelFor(ammoItemId) === panel;
  }

  setActivePanel(ammo: Cartridge, panel: WeaponAssociationPanel, event?: Event): void {
    event?.stopPropagation();
    this.activePanelByAmmoId.set(ammo.id, panel);
    this.weaponSearchByAmmoId.delete(ammo.id);

    if (panel === 'compatible') {
      this.setWeaponCatalogScope(ammo.id, 'compatible');
    } else if (panel === 'all') {
      this.setWeaponCatalogScope(ammo.id, 'all');
    }

    this.cdr.markForCheck();
  }

  catalogWeaponsForActiveScope(ammo: Cartridge): WeaponDto[] {
    const panel = this.activePanelFor(ammo.id);
    if (panel === 'other' || panel == null) {
      return [];
    }
    if (panel === 'all' || !this.hasCaliberFilterEffect(ammo)) {
      return this.getAllAssignableWeapons();
    }
    return this.getCompatibleWeapons(this.effectiveAmmoCaliberId(ammo));
  }

  catalogWeaponsScopeCount(ammo: Cartridge): number {
    return this.catalogWeaponsForActiveScope(ammo).length;
  }

  filteredCatalogWeaponsForActiveScope(ammo: Cartridge): WeaponDto[] {
    const weapons = this.catalogWeaponsForActiveScope(ammo);
    const q = (this.weaponSearchByAmmoId.get(ammo.id) ?? '').trim().toLowerCase();
    if (!q) return weapons;

    return weapons.filter(w => {
      const label = this.weaponDisplayLabel(w).toLowerCase();
      const name = (w.name ?? '').toLowerCase();
      const model = (w.model ?? '').toLowerCase();
      return label.includes(q) || name.includes(q) || model.includes(q);
    });
  }

  weaponSearchFor(ammoItemId: number): string {
    return this.weaponSearchByAmmoId.get(ammoItemId) ?? '';
  }

  onWeaponSearchChange(ammoItemId: number, term: string): void {
    if (!term.trim()) {
      this.weaponSearchByAmmoId.delete(ammoItemId);
    } else {
      this.weaponSearchByAmmoId.set(ammoItemId, term);
    }
    this.cdr.markForCheck();
  }

  isWeaponSelected(ammoItemId: number, weaponId: number): boolean {
    return this.catalogWeaponIdsFor(ammoItemId).includes(weaponId);
  }

  toggleWeaponInList(ammo: Cartridge, weaponId: number, event: Event): void {
    event.stopPropagation();
    const current = [...this.catalogWeaponIdsFor(ammo.id)];
    const idx = current.indexOf(weaponId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(weaponId);
    }
    this.applyCatalogSelection(ammo, current);
  }

  catalogSelectionCount(ammoItemId: number): number {
    return this.catalogWeaponIdsFor(ammoItemId).length;
  }

  hasAssociationForAmmo(ammoItemId: number): boolean {
    const list = this.associationsForAmmo(ammoItemId);
    return list.some(
      a =>
        (a.type === 'catalog' && !!a.weaponItemId) ||
        (a.type === 'other' && !!a.otherName?.trim())
    );
  }

  get showAssociationValidation(): boolean {
    return (
      !this.loadingWeapons &&
      !this.weaponLoadError &&
      this.ammunitionItems.length > 0 &&
      !this.canProceed
    );
  }

  private applyCatalogSelection(ammo: Cartridge, uniq: number[]): void {
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
    this.cdr.markForCheck();
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

  hasCaliberFilterEffect(ammo: Cartridge): boolean {
    if (!this.ammoHasCaliberForFilter(ammo)) return false;
    const compatible = this.getCompatibleWeapons(this.effectiveAmmoCaliberId(ammo));
    return compatible.length > 0 && compatible.length < this.getAllAssignableWeapons().length;
  }

  setWeaponCatalogScope(ammoItemId: number, scope: 'compatible' | 'all'): void {
    const viewingAll = scope === 'all';
    if (viewingAll) {
      this.viewAllWeaponsByAmmoId.set(ammoItemId, true);
    } else {
      this.viewAllWeaponsByAmmoId.delete(ammoItemId);
    }
    this.cdr.markForCheck();
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

  onOtherWeaponConfirm(ammo: Cartridge, event?: Event): void {
    event?.stopPropagation();
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
    event.stopPropagation();
    if (this.canConfirmOtherWeapon(ammo)) {
      this.onOtherWeaponConfirm(ammo);
    }
  }

  firstOtherName(ammoItemId: number): string | null {
    const o = this.associationsForAmmo(ammoItemId).find(a => a.type === 'other');
    return o?.otherName?.trim() ?? null;
  }

  weaponDisplayLabel(w: WeaponDto): string {
    const base = w.name ?? '';
    return w.model ? `${base} — ${w.model}` : base;
  }

  private expandCollapsedRowsThatAlreadyHaveAssociations(): void {
    let changed = false;
    for (const ammo of this.ammunitionItems) {
      if (this.hasAssociationForAmmo(ammo.id) && !this.expandedAmmoIds.has(ammo.id)) {
        this.expandedAmmoIds.add(ammo.id);
        this.selectDefaultPanel(ammo);
        changed = true;
      }
    }
    if (changed) {
      this.cdr.markForCheck();
    }
  }


  private expandCollapsedRowsWhereAssociationJustAppeared(
    previousAssociations: Map<number, WeaponAssociation[]>
  ): void {
    let changed = false;
    for (const ammo of this.ammunitionItems) {
      if (this.expandedAmmoIds.has(ammo.id)) continue;

      const prevHad = this.hasAssociationForAmmoInMap(previousAssociations, ammo.id);
      const currHad = this.hasAssociationForAmmo(ammo.id);
      if (!prevHad && currHad) {
        this.expandedAmmoIds.add(ammo.id);
        this.selectDefaultPanel(ammo);
        changed = true;
      }
    }
    if (changed) {
      this.cdr.markForCheck();
    }
  }

  private hasAssociationForAmmoInMap(
    map: Map<number, WeaponAssociation[]>,
    ammoItemId: number
  ): boolean {
    const list = map.get(ammoItemId) ?? [];
    return list.some(
      a =>
        (a.type === 'catalog' && !!a.weaponItemId) ||
        (a.type === 'other' && !!a.otherName?.trim())
    );
  }

  private pruneStaleAmmoState(): void {
    const nextIds = new Set(this.ammunitionItems.map(a => a.id));
    for (const id of [...this.catalogWeaponIdsByAmmoId.keys()]) {
      if (!nextIds.has(id)) {
        this.catalogWeaponIdsByAmmoId.delete(id);
        this.viewAllWeaponsByAmmoId.delete(id);
        this.activePanelByAmmoId.delete(id);
        this.expandedAmmoIds.delete(id);
        this.otherNameInput.delete(id);
        this.weaponSearchByAmmoId.delete(id);
      }
    }
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

  // ---- Weapon Association Attachments (system slot) ----------------------

  onAttachmentFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) return;

    const incoming = Array.from(input.files).filter(f => f instanceof File && f.size > 0);
    const merged = [...(this.attachmentFiles ?? []), ...incoming];
    this.attachmentFilesChange.emit(merged);

    input.value = '';
  }

  onRemoveAttachmentFile(index: number): void {
    if (index < 0 || index >= (this.attachmentFiles?.length ?? 0)) return;
    const next = [...this.attachmentFiles];
    next.splice(index, 1);
    this.attachmentFilesChange.emit(next);
  }

  formatFileSize(file: File): string {
    if (!file || !file.size) return '0 B';
    const bytes = file.size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  trackByFileIndex(index: number, _file: File): number {
    return index;
  }
}

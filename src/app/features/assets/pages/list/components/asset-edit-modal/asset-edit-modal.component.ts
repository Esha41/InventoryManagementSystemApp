import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { AssetType, AssetImageState, Asset } from '@models/asset-list.model';
import { AmmunitionReadDto, AmmunitionCreateDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { ItemType } from '@models/inventory.model';
import { createAssetEditForm } from '@utils/asset-list-form.utils';
import { unwrapDropdownOption } from '@utils/dropdown.utils';
import { getLookupDropdownLabel, filterRenderableLookupItems } from '@utils/asset-list.utils';
import { createInitialImageState } from '@utils/asset-list.state';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';

/**
 * API uses JsonStringEnumConverter (e.g. "Small"); edit dropdowns use '1' | '2' | '3'.
 */
function parseSmallMediumLargeEnum(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3) {
    return value;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^[1-3]$/.test(t)) return parseInt(t, 10);
    const lower = t.toLowerCase();
    if (lower === 'small') return 1;
    if (lower === 'medium') return 2;
    if (lower === 'large') return 3;
    const n = parseInt(t, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 3) return n;
  }
  return null;
}

function caliberClassApiToFormSelectValue(value: unknown): string {
  const n = parseSmallMediumLargeEnum(value);
  return n != null ? String(n) : '';
}

@Component({
  selector: 'app-asset-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    ButtonComponent,
    DropdownComponent
  ],
  templateUrl: './asset-edit-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetEditModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() activeTab: AssetType = 'ammunition';
  @Input() selectedAsset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null = null;
  @Input() loading = false;
  @Input() units: LookupItem[] = [];
  @Input() caseTypeList: LookupItem[] = [];
  @Input() propellantList: LookupItem[] = [];
  @Input() compatibilityList: LookupItem[] = [];
  @Input() hazardDivisionList: LookupItem[] = [];
  @Input() natureOptions: LookupItem[] = [];
  @Input() primaryPurposes: LookupItem[] = [];
  @Input() projectileColors: LookupItem[] = [];
  @Input() projectailMaterials: LookupItem[] = [];
  @Input() classifications: LookupItem[] = [];
  @Input() itemTypes: LookupItem[] = [];
  @Input() countries: LookupItem[] = [];
  @Input() calibersWeapon: LookupItem[] = [];
  @Input() calibersAmmunition: LookupItem[] = [];
  @Input() imageState: AssetImageState = createInitialImageState();

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ dto: AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto; imageFile: File | null; imageFileId: number | null; removeImageRequested: boolean }>();
  @Output() imageFileSelected = new EventEmitter<File>();
  @Output() imageDropped = new EventEmitter<File>();

  readonly X = X;
  readonly explosiveTypeOptions = getExplosiveTypeOptions();

  editForm!: FormGroup;
  imageStateLocal: AssetImageState = createInitialImageState();
  removeImageRequested = false;

  @ViewChild('editFileInput') editFileInputRef!: ElementRef<HTMLInputElement>;

  readonly linkedOptions = [
    { label: 'assetList.editModal.notLinked', value: false },
    { label: 'assetList.editModal.linked', value: true }
  ];

  /** AmmunitionType / WeaponCaliberCategory (Small=1, Medium=2, Large=3) */
  readonly ammunitionTypeClassOptions: { label: string; value: string }[] = [
    { label: 'newIssueRequest.ammunitionTypeSmall', value: '1' },
    { label: 'newIssueRequest.ammunitionTypeMedium', value: '2' },
    { label: 'newIssueRequest.ammunitionTypeLarge', value: '3' }
  ];

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) =>
    getLookupDropdownLabel(unwrapDropdownOption(option), this.translateService);

  get caliberOptionsForTab(): LookupItem[] {
    const raw = this.activeTab === 'weapon' ? this.calibersWeapon : this.calibersAmmunition;
    return filterRenderableLookupItems(raw, this.translateService);
  }

  constructor(
    private fb: FormBuilder,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.editForm = createAssetEditForm(this.fb);
    this.updateCaliberCategoryValidators();
  }

  /** Ammunition: ammunitionType required. Weapon: caliberCategory required. Explosive: neither. */
  private updateCaliberCategoryValidators(): void {
    const at = this.editForm?.get('ammunitionType');
    const cc = this.editForm?.get('caliberCategory');
    if (!at || !cc) return;
    at.clearValidators();
    cc.clearValidators();
    if (this.activeTab === 'ammunition') {
      at.setValidators([Validators.required]);
    } else if (this.activeTab === 'weapon') {
      cc.setValidators([Validators.required]);
    }
    at.updateValueAndValidity({ emitEvent: false });
    cc.updateValueAndValidity({ emitEvent: false });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeTab'] && this.editForm) {
      this.updateCaliberCategoryValidators();
    }
    if (changes['selectedAsset'] && this.selectedAsset && this.editForm) {
      // Use originalData when available (Asset from table) for correct IDs and entity-specific fields
      const source = ('originalData' in this.selectedAsset && this.selectedAsset.originalData)
        ? this.selectedAsset.originalData
        : this.selectedAsset;
      this.editForm.patchValue(source || {});
      if ((this.activeTab === 'ammunition' || this.activeTab === 'explosive' || this.activeTab === 'weapon') && source) {
        const catalog = source as AmmunitionReadDto | ExplosiveDto | WeaponDto;
        const fromList = catalog.primaryPurposes?.map(p => p.id).filter((id): id is number => id != null);
        const ids =
          fromList && fromList.length > 0
            ? fromList
            : catalog.primaryPurpos?.id != null
              ? [catalog.primaryPurpos.id]
              : [];
        this.editForm.patchValue({ primaryPurposIds: ids });
      }
      if (this.activeTab === 'ammunition' || this.activeTab === 'weapon') {
        const cid =
          this.activeTab === 'weapon'
            ? (source as WeaponDto).caliberId ?? (source as WeaponDto).caliber?.id ?? null
            : (source as AmmunitionReadDto).caliberId ?? (source as AmmunitionReadDto).caliber?.id ?? null;
        this.editForm.patchValue({ caliberId: cid }, { emitEvent: false });
      }
      if (this.activeTab === 'ammunition' && source) {
        const at = (source as AmmunitionReadDto).ammunitionType;
        this.editForm.patchValue({
          ammunitionType: caliberClassApiToFormSelectValue(at) || '1',
          caliberCategory: '1'
        });
      } else if (this.activeTab === 'weapon' && source) {
        const cc = (source as WeaponDto).caliberCategory;
        this.editForm.patchValue({
          caliberCategory: caliberClassApiToFormSelectValue(cc) || '1',
          ammunitionType: ''
        });
      } else {
        this.editForm.patchValue({ ammunitionType: '', caliberCategory: '1' });
      }
      this.updateCaliberCategoryValidators();
      this.cdr.markForCheck();
    }
    if (changes['imageState'] && this.imageState) {
      // Deep copy to ensure change detection triggers
      this.imageStateLocal = {
        editImageUrl: this.imageState.editImageUrl,
        editImageFile: this.imageState.editImageFile,
        editImagePreview: this.imageState.editImagePreview,
        editImageFileId: this.imageState.editImageFileId
      };
      // Reset the remove flag when new image state comes in
      this.removeImageRequested = false;
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.editForm.reset();
    this.imageStateLocal = createInitialImageState();
    this.removeImageRequested = false;
    this.closed.emit();
  }

  save(): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) {
      this.cdr.markForCheck();
      return;
    }

    const formData = { ...this.editForm.value };

    let dto: AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto;

    if (this.activeTab === 'ammunition') {
      const raw = formData as Record<string, unknown>;
      delete raw['primaryPurposId'];
      const primaryPurposIds = raw['primaryPurposIds'] as number[] | undefined;
      if (!primaryPurposIds?.length) {
        delete raw['primaryPurposIds'];
      }
      delete raw['caliberCategory'];
      const atParsed = parseSmallMediumLargeEnum(raw['ammunitionType']);
      if (atParsed != null) {
        raw['ammunitionType'] = atParsed;
      } else {
        delete raw['ammunitionType'];
      }
      delete raw['caliber'];
      const cid = raw['caliberId'];
      if (cid === '' || cid === undefined || cid === null) {
        delete raw['caliberId'];
      } else if (typeof cid === 'string') {
        raw['caliberId'] = parseInt(cid, 10);
      }
      dto = raw as unknown as AmmunitionCreateDto;
    } else if (this.activeTab === 'weapon') {
      const raw = formData as Record<string, unknown>;
      delete raw['ammunitionType'];
      const ccParsed = parseSmallMediumLargeEnum(raw['caliberCategory']);
      if (ccParsed != null) {
        raw['caliberCategory'] = ccParsed;
      } else {
        delete raw['caliberCategory'];
      }
      delete raw['primaryPurposId'];
      const primaryPurposIds = raw['primaryPurposIds'] as number[] | undefined;
      if (!primaryPurposIds?.length) {
        delete raw['primaryPurposIds'];
      }
      delete raw['caliber'];
      const cid = raw['caliberId'];
      if (cid === '' || cid === undefined || cid === null) {
        delete raw['caliberId'];
      } else if (typeof cid === 'string') {
        raw['caliberId'] = parseInt(cid, 10);
      }
      dto = raw as unknown as CreateUpdateWeaponDto;
    } else {
      const raw = formData as Record<string, unknown>;
      delete raw['ammunitionType'];
      delete raw['caliberCategory'];
      delete raw['caliber'];
      delete raw['caliberId'];
      delete raw['primaryPurposId'];
      const primaryPurposIds = raw['primaryPurposIds'] as number[] | undefined;
      if (!primaryPurposIds?.length) {
        delete raw['primaryPurposIds'];
      }
      dto = raw as unknown as CreateUpdateExplosiveDto;
    }

    this.saved.emit({
      dto,
      imageFile: this.imageStateLocal.editImageFile,
      imageFileId: this.imageStateLocal.editImageFileId,
      removeImageRequested: this.removeImageRequested
    });
  }

  triggerFileInput(): void {
    this.editFileInputRef.nativeElement.click();
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.imageStateLocal.editImageFile = file;
      this.imageStateLocal.editImagePreview = URL.createObjectURL(file);
      this.imageFileSelected.emit(file);
      this.cdr.markForCheck();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /** Prevents + and - keys in numeric fields (bullet diameter, total weight). */
  blockSignKeys(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === '+') {
      event.preventDefault();
    }
  }

  /** Sanitizes pasted text: removes + and - from numeric fields. */
  onPasteNumber(event: ClipboardEvent, field: 'bulletDiameter' | 'totalWeight'): void {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/[+-]/g, '');
    if (pasted !== (event.clipboardData?.getData('text') ?? '')) {
      event.preventDefault();
      this.editForm.get(field)?.setValue(pasted, { emitEvent: true });
      this.cdr.markForCheck();
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.imageStateLocal.editImageFile = file;
      this.imageStateLocal.editImagePreview = URL.createObjectURL(file);
      this.imageDropped.emit(file);
      this.cdr.markForCheck();
    }
  }

  removeImage(): void {
    // Clear all image state
    this.imageStateLocal.editImageUrl = null;
    this.imageStateLocal.editImageFile = null;
    this.imageStateLocal.editImagePreview = null;
    // Set flag to indicate user wants to remove the image
    this.removeImageRequested = true;
    this.cdr.markForCheck();
  }

  get editImagePreview(): string | null {
    return this.imageStateLocal.editImagePreview || this.imageStateLocal.editImageUrl;
  }

  /**
   * Helper method to filter item types by category
   */
  private getFilteredItemTypes(itemType: ItemType): LookupItem[] {
    if (!this.itemTypes?.length) return [];
    const typeName = ItemType[itemType];
    const filtered = this.itemTypes.filter(item => {
      const value = item.itemType as string | number | undefined;
      return value != null && (typeof value === 'string' ? value : ItemType[Number(value)]) === typeName;
    });
    return filtered.length > 0 ? filtered : this.itemTypes;
  }

  /**
   * Get filtered item types for ammunition (itemType === ItemType.Ammunition)
   */
  get ammunitionItemTypes(): LookupItem[] {
    return this.getFilteredItemTypes(ItemType.Ammunition);
  }

  /**
   * Get filtered item types for weapons (itemType === ItemType.Weapon)
   */
  get weaponItemTypes(): LookupItem[] {
    return this.getFilteredItemTypes(ItemType.Weapon);
  }

  /**
   * Get filtered item types for explosives (itemType === ItemType.Explosive)
   */
  get explosiveItemTypes(): LookupItem[] {
    return this.getFilteredItemTypes(ItemType.Explosive);
  }
}

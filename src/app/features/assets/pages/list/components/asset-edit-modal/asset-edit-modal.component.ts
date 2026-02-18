import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { AssetType, AssetImageState, Asset } from '@models/asset-list.model';
import { AmmunitionReadDto, AmmunitionCreateDto, LookupDto } from '@models/ammunition.model';
import { WeaponDto, CreateUpdateWeaponDto } from '@models/weapon.model';
import { ExplosiveDto, CreateUpdateExplosiveDto } from '@models/explosive.model';
import { LookupItem } from '@models/lookup.model';
import { ItemType } from '@models/inventory.model';
import { createAssetEditForm } from '@utils/asset-list-form.utils';
import { unwrapDropdownOption } from '@utils/dropdown.utils';
import { getLookupDisplayName } from '@utils/asset-list.utils';
import { createInitialImageState } from '@utils/asset-list.state';
import { getExplosiveTypeOptions } from '@utils/explosive.utils';

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

  readonly lookupOptionLabel = (option: DropdownOption<LookupItem> | LookupItem) =>
    getLookupDisplayName(unwrapDropdownOption(option), this.translateService);

  constructor(
    private fb: FormBuilder,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.editForm = createAssetEditForm(this.fb);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedAsset'] && this.selectedAsset && this.editForm) {
      // Use originalData when available (Asset from table) for correct IDs and entity-specific fields
      const source: any = (this.selectedAsset as any)?.originalData ?? this.selectedAsset;
      this.editForm.patchValue(source || {});
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
    if (this.editForm.invalid) return;

    const formData = { ...this.editForm.value };

    let dto: AmmunitionCreateDto | CreateUpdateWeaponDto | CreateUpdateExplosiveDto;

    if (this.activeTab === 'ammunition') {
      dto = formData as AmmunitionCreateDto;
    } else if (this.activeTab === 'weapon') {
      dto = formData as CreateUpdateWeaponDto;
    } else {
      // For explosives
      dto = formData as CreateUpdateExplosiveDto;
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

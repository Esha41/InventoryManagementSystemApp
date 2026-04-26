import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, OnInit, Optional, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Cartridge } from '@models/cartridge.model';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { CartridgeMapperService } from '@assets/services/cartridge-mapper.service';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, catchError, switchMap, of, takeUntil } from 'rxjs';
import { Asset } from '@models/asset-list.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';

export type ItemDetailsData = Cartridge | Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | InventoryDetailDto | null;

@Component({
  selector: 'app-item-details',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './item-details.component.html',
  styleUrls: ['./item-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemDetailsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() item: ItemDetailsData = null;
  @Input() showActions: boolean = true; // Control whether to show action buttons
  @Input() isModal: boolean = false; // Whether this is displayed as a modal
  @Input() isPage: boolean = false; // Whether this is used as a standalone page
  @Input() itemType?: 'ammunition' | 'weapon' | 'explosive'; // Explicit item type for Asset/InventoryDetailDto
  @Output() select = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  // Page mode properties
  loading = false;
  error: string | null = null;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  get backIcon(): typeof ArrowLeft {
    return this.translationService?.isRTL() ? ArrowRight : ArrowLeft;
  }
  private destroy$ = new Subject<void>();

  imageUrl: string | null = null;
  private blobUrls: Set<string> = new Set();

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private cartridgeMapper: CartridgeMapperService,
    private fileUploadService: FileUploadService,
    private http: HttpClient,
    public propertyAccessor: AssetPropertyAccessor,
    @Optional() private route?: ActivatedRoute,
    @Optional() private router?: Router,
    @Optional() private translationService?: TranslationService,
    private cdr?: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // If used as a page component (route params exist), load data from route params
    if (this.route && this.route.snapshot.params['id']) {
      this.isPage = true;
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        const itemId = parseInt(params['id'], 10);
        
        // Get item type from query params
        const tabParam = this.route!.snapshot.queryParams['tab'];
        if (tabParam && (tabParam === 'ammunition' || tabParam === 'weapon' || tabParam === 'explosive')) {
          this.itemType = tabParam;
        }

        if (itemId) {
          this.loadItemFromRoute(itemId);
        } else {
          this.loading = false;
          this.error = 'Invalid item ID';
          this.cdr?.markForCheck();
        }
      });
    }
  }

  private loadItemFromRoute(itemId: number): void {
    this.loading = true;
    this.error = null;
    this.cdr?.markForCheck();

    let service$: Observable<AmmunitionReadDto | WeaponDto | ExplosiveDto>;
    
    if (this.itemType === 'weapon') {
      service$ = this.weaponService.getById<WeaponDto>(itemId);
    } else if (this.itemType === 'explosive') {
      service$ = this.explosiveService.getById<ExplosiveDto>(itemId);
    } else {
      service$ = this.ammunitionService.getById<AmmunitionReadDto>(itemId);
    }

    service$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: AmmunitionReadDto | WeaponDto | ExplosiveDto) => {
        this.item = data;
        this.loading = false;
        // Load image after item data is loaded
        const itemId = this.getItemId();
        if (itemId) {
          this.loadImage(itemId);
        }
        this.cdr?.markForCheck();
      },
      error: () => {
        this.error = 'Failed to load item details';
        this.loading = false;
        this.cdr?.markForCheck();
      }
    });
  }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  onBack(): void {
    if (this.router && this.itemType) {
      // Navigate back to asset-list with tab query param
      this.router.navigate(['/assets/asset-list'], {
        queryParams: { tab: this.itemType }
      });
    } else {
      this.cancel.emit();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] && this.item) {
      const itemId = this.getItemId();
      if (itemId) {
        this.loadImage(itemId);
      }
    }
  }

  ngOnDestroy(): void {
    // Clean up all blob URLs to prevent memory leaks
    this.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking blob URL:', e);
      }
    });
    this.blobUrls.clear();
  }

  getItemId(): number | null {
    if (!this.item) return null;
    
    // Check if it's a Cartridge
    if ('id' in this.item && typeof (this.item as any).id === 'number') {
      return (this.item as any).id;
    }
    
    // Check if it's InventoryDetailDto
    if ('itemId' in this.item && typeof (this.item as any).itemId === 'number') {
      return (this.item as any).itemId;
    }
    
    // Check if it's a direct DTO (AmmunitionReadDto, WeaponDto, ExplosiveDto)
    if (this.isDirectDto && 'id' in this.item && typeof (this.item as any).id === 'number') {
      return (this.item as any).id;
    }
    
    return null;
  }

  get isWeapon(): boolean {
    if (this.itemType === 'weapon') return true;
    if (this.isInventoryDetail) {
      const item = (this.item as InventoryDetailDto).item;
      return item?.itemType === 2; // 2 = Weapon
    }
    if (this.isDirectDto && this.item && 'caliber' in this.item && !('armNumber' in this.item) && !('explosiveType' in this.item)) {
      return true;
    }
    return this.cartridgeMapper.isWeapon(this.item as Cartridge);
  }

  get isExplosive(): boolean {
    if (this.itemType === 'explosive') return true;
    if (this.isInventoryDetail) {
      const item = (this.item as InventoryDetailDto).item;
      return item?.itemType === 3; // 3 = Explosive
    }
    if (this.isDirectDto && this.item && 'explosiveType' in this.item) {
      return true;
    }
    return this.cartridgeMapper.isExplosive(this.item as Cartridge);
  }

  get isAmmunition(): boolean {
    if (this.itemType === 'ammunition') return true;
    if (this.isInventoryDetail) {
      const item = (this.item as InventoryDetailDto).item;
      return item?.itemType === 1; // 1 = Ammunition
    }
    if (this.isDirectDto && this.item && 'armNumber' in this.item) {
      return true;
    }
    return this.cartridgeMapper.isAmmunition(this.item as Cartridge);
  }

  get isInventoryDetail(): boolean {
    return this.item !== null && 'itemId' in this.item;
  }

  get isCartridge(): boolean {
    return this.item !== null && !this.isInventoryDetail && 'itemType' in this.item;
  }

  get isAsset(): boolean {
    return this.item !== null && !this.isInventoryDetail && !this.isCartridge && 'originalData' in this.item;
  }

  get isDirectDto(): boolean {
    // Check if item is directly AmmunitionReadDto, WeaponDto, or ExplosiveDto (not wrapped in Asset)
    if (!this.item) return false;
    // Must have one of the type-specific properties
    const hasTypeProperty = 'armNumber' in this.item || 'caliber' in this.item || 'explosiveType' in this.item;
    // Must NOT be wrapped in Asset (no originalData)
    const notWrapped = !('originalData' in this.item);
    // Must NOT be InventoryDetailDto (no itemId)
    const notInventory = !('itemId' in this.item);
    // Must NOT be Cartridge (Cartridge has itemType as string)
    const notCartridge = !('itemType' in this.item && typeof (this.item as any).itemType === 'string');
    
    return hasTypeProperty && notWrapped && notInventory && notCartridge;
  }

  // Getter methods for different data types
  getItemName(): string {
    if (!this.item) return '';
    
    if (this.isInventoryDetail) {
      const invItem = this.item as InventoryDetailDto;
      if (invItem.item) {
        // BaseItemDto can be safely cast to AssetUnion since it's the base type
        // We need to cast through any to satisfy TypeScript
        const itemAsAsset = invItem.item as unknown as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null;
        if (itemAsAsset) {
          return this.propertyAccessor.getAssetName(itemAsAsset) || invItem.item.itemNo || '';
        }
        return invItem.item.itemNo || '';
      }
      return '';
    }
    
    if (this.isCartridge) {
      return (this.item as Cartridge).name || '';
    }
    
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getAssetName(this.item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto);
    }
    
    return '';
  }

  getProductId(): string {
    if (!this.item) return '';
    
    if (this.isInventoryDetail) {
      const invItem = this.item as InventoryDetailDto;
      return invItem.item?.itemNo || '';
    }
    
    if (this.isCartridge) {
      const cartridge = this.item as Cartridge;
      return cartridge.productId || cartridge.itemNo || '';
    }
    
    if (this.isAsset || this.isDirectDto) {
      return (this.item as any).itemNo || '';
    }
    
    return '';
  }

  getNSN(): string {
    if (!this.item) return '';
    
    if (this.isInventoryDetail) {
      const invItem = this.item as InventoryDetailDto;
      return invItem.item?.nsn || '';
    }
    
    if (this.isCartridge) {
      return (this.item as Cartridge).ncn || '';
    }
    
    if (this.isAsset || this.isDirectDto) {
      return (this.item as any).nsn || '';
    }
    
    return '';
  }

  getPrimaryPurpose(): string {
    if (this.isCartridge) {
      const primaryPurpose = (this.item as Cartridge).primaryPurpose;
      return typeof primaryPurpose === 'string' ? primaryPurpose : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getPrimaryPurpose(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getWeaponType(): string {
    if (this.isCartridge) {
      const weaponType = (this.item as Cartridge).weaponType;
      return typeof weaponType === 'string' ? weaponType : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getTypeForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getExplosiveType(): string {
    if (this.isCartridge) {
      const explosiveType = (this.item as Cartridge).explosiveType;
      return typeof explosiveType === 'string' ? explosiveType : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isExplosive) {
      return this.propertyAccessor.getExplosiveTypeName(this.item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getProjectileColor(): string {
    if (this.isCartridge) {
      const projectileColor = (this.item as Cartridge).projectileColor;
      return typeof projectileColor === 'string' ? projectileColor : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getProjectileColor(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getTotalWeight(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).totalWeight || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getTotalWeight(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getProjectileMaterial(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).projectileMaterial || '';
    }
    // Asset doesn't have this directly accessible
    return '';
  }

  getCaseType(): string {
    if (this.isCartridge) {
      const caseType = (this.item as Cartridge).caseType;
      return typeof caseType === 'string' ? caseType : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getCaseType(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getPrimer(): string {
    if (this.isCartridge) {
      const primer = (this.item as Cartridge).primer;
      return typeof primer === 'string' ? primer : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getPrimer(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getPropellant(): string {
    if (this.isCartridge) {
      const propellant = (this.item as Cartridge).propellant;
      return typeof propellant === 'string' ? propellant : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getPropellant(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getHazardDivision(): string {
    if (this.isCartridge) {
      const hazardDivision = (this.item as Cartridge).hazardDivision;
      return typeof hazardDivision === 'string' ? hazardDivision : '';
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getHazardDivision(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    return '';
  }

  getCapabilityGroup(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).capabilityGroup || '';
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getCompatibility(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    return '';
  }

  getCaliber(): string {
    if (this.isCartridge) {
      const caliber = (this.item as Cartridge).caliber;
      return typeof caliber === 'string' ? caliber : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getCaliber(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getActionType(): string {
    if (this.isCartridge) {
      const actionType = (this.item as Cartridge).actionType;
      return typeof actionType === 'string' ? actionType : '';
    }
    return '';
  }

  getBarrelLengthLabel(): string {
    if (this.isCartridge) {
      const barrelLengthLabel = (this.item as Cartridge).barrelLengthLabel;
      return typeof barrelLengthLabel === 'string' ? barrelLengthLabel : '';
    }
    return '';
  }

  getOverallLengthLabel(): string {
    if (this.isCartridge) {
      const overallLengthLabel = (this.item as Cartridge).overallLengthLabel;
      return typeof overallLengthLabel === 'string' ? overallLengthLabel : '';
    }
    return '';
  }

  getWeightLabel(): string {
    if (this.isCartridge) {
      const weightLabel = (this.item as Cartridge).weightLabel;
      return typeof weightLabel === 'string' ? weightLabel : '';
    }
    return '';
  }

  getCapacity(): number | undefined {
    if (this.isCartridge) {
      return (this.item as Cartridge).capacity;
    }
    return undefined;
  }

  getUnNumber(): string {
    if (this.isCartridge) {
      const unNumber = (this.item as Cartridge).unNumber;
      return typeof unNumber === 'string' ? unNumber : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isExplosive) {
      return this.propertyAccessor.getUnNumber(this.item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getNetExplosiveQuantityLabel(): string {
    if (this.isCartridge) {
      const netExplosiveQuantityLabel = (this.item as Cartridge).netExplosiveQuantityLabel;
      return typeof netExplosiveQuantityLabel === 'string' ? netExplosiveQuantityLabel : '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isExplosive) {
      return this.propertyAccessor.getNetExplosiveQuantity(this.item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  getTotalWeightLabel(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).totalWeightLabel || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isExplosive) {
      return this.propertyAccessor.getTotalWeight(this.item as Asset | ExplosiveDto) || '';
    }
    return '';
  }

  // Additional getter methods for all fields
  getArmNumber(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).armNumber || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getArmNumber(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getBulletDiameter(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).bulletDiameterLabel || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getBulletDiameter(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getPartNo(): string {
    if (!this.item) return '';
    if (this.isInventoryDetail) {
      return (this.item as InventoryDetailDto).item?.partNo || '';
    }
    // Cartridge doesn't have partNo property
    if (this.isCartridge) {
      return '';
    }
    if (this.isAsset || this.isDirectDto) {
      return (this.item as any).partNo || '';
    }
    return '';
  }

  getBatchNo(): string {
    if (!this.item) return '';
    if (this.isInventoryDetail) {
      return (this.item as InventoryDetailDto).batchNo || '';
    }
    // Cartridge doesn't have batchNo property
    if (this.isCartridge) {
      return '';
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getBatchNo(this.item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto) || '';
    }
    return '';
  }

  getPrice(): string {
    if (!this.item) return '';
    if (this.isInventoryDetail) {
      return (this.item as InventoryDetailDto).item?.price?.toString() || '';
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getPrice(this.item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto) || '';
    }
    return '';
  }

  getMinimumQuantity(): string {
    if (!this.item) return '';
    if (this.isInventoryDetail) {
      return (this.item as InventoryDetailDto).item?.minimumQuantity?.toString() || '';
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getMinimumQuantity(this.item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto) || '';
    }
    return '';
  }

  getExpiryDate(): string {
    if (!this.item) return '';
    if (this.isInventoryDetail) {
      const expiryDate = (this.item as InventoryDetailDto).expiryDate;
      if (!expiryDate) return '';
      try {
        const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
        return date.toLocaleDateString();
      } catch {
        return '';
      }
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getExpiryDate(this.item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto) || '';
    }
    return '';
  }

  getReadyForIssue(): string {
    if (!this.item) return '';
    if (this.isInventoryDetail) {
      return (this.item as InventoryDetailDto).readyForIssue ? 'Yes' : 'No';
    }
    if (this.isAsset || this.isDirectDto) {
      return this.propertyAccessor.getReadyForIssue(this.item as Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto) || '';
    }
    return '';
  }

  // Ammunition specific additional fields
  getDistribution(): string {
    // Cartridge doesn't have distribution property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && (this.isAmmunition || this.isExplosive)) {
      return this.propertyAccessor.getDistribution(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    return '';
  }

  getReferenceNo(): string {
    // Cartridge doesn't have referenceNo property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && (this.isAmmunition || this.isExplosive)) {
      return this.propertyAccessor.getReferenceNo(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getReferenceNoForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getClassification(): string {
    if ((this.isAsset || this.isDirectDto) && (this.isAmmunition || this.isExplosive)) {
      return this.propertyAccessor.getClassification(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getClassificationForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getCaliberCategory(): string {
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getAmmunitionCaliberCategory(this.item as Asset | AmmunitionReadDto) || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getWeaponCaliberCategory(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getType(): string {
    if ((this.isAsset || this.isDirectDto) && (this.isAmmunition || this.isExplosive)) {
      return this.propertyAccessor.getType(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getTypeForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getNotes(): string {
    // Cartridge doesn't have notes property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && (this.isAmmunition || this.isExplosive)) {
      return this.propertyAccessor.getNotes(this.item as Asset | AmmunitionReadDto | ExplosiveDto) || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getNotesForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getUnNumberForAmmunition(): string {
    if (this.isCartridge) {
      return (this.item as Cartridge).unNumber || '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getUnNumberForAmmunition(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getNature(): string {
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getNature(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  getLinked(): string {
    if ((this.isAsset || this.isDirectDto) && this.isAmmunition) {
      return this.propertyAccessor.getLinked(this.item as Asset | AmmunitionReadDto) || '';
    }
    return '';
  }

  // Weapon specific additional fields
  getModel(): string {
    // Cartridge doesn't have model property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getModel(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getYearOfManufacture(): string {
    // Cartridge doesn't have yearOfManufacture property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getYearOfManufacture(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getCountryOfManufacture(): string {
    // Cartridge doesn't have countryOfManufacture property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getCountryOfManufacture(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getCaliberUnit(): string {
    // Cartridge doesn't have caliberUnit property
    if (this.isCartridge) {
      return '';
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getCaliberUnit(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getDistributionForWeapon(): string {
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getDistributionForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  getUnNumberForWeapon(): string {
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      return this.propertyAccessor.getUnNumberForWeapon(this.item as Asset | WeaponDto) || '';
    }
    return '';
  }

  // Helper method to get lookup name
  private getLookupDisplayName(lookup: any): string {
    if (!lookup) return '';
    if (typeof lookup === 'string') return lookup;
    if (typeof lookup === 'object' && 'nameAr' in lookup && 'nameEn' in lookup) {
      return this.translationService?.isRTL() ? lookup.nameAr : lookup.nameEn;
    }
    return '';
  }

  // Helper methods to get weapon dimensions with units
  getBarrelLengthWithUnit(): string {
    if (this.isCartridge) {
      return this.getBarrelLengthLabel();
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      const weapon = this.item as Asset | WeaponDto;
      if (weapon && 'barrelLength' in weapon && weapon.barrelLength != null) {
        const unit = this.getLookupDisplayName(weapon.barrelLengthUnit);
        return `${weapon.barrelLength}${unit ? ' ' + unit : ''}`.trim();
      }
    }
    return '';
  }

  getOverallLengthWithUnit(): string {
    if (this.isCartridge) {
      return this.getOverallLengthLabel();
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      const weapon = this.item as Asset | WeaponDto;
      if (weapon && 'overallLength' in weapon && weapon.overallLength != null) {
        const unit = this.getLookupDisplayName(weapon.overallLengthUnit);
        return `${weapon.overallLength}${unit ? ' ' + unit : ''}`.trim();
      }
    }
    return '';
  }

  getWeightWithUnit(): string {
    if (this.isCartridge) {
      return this.getWeightLabel();
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      const weapon = this.item as Asset | WeaponDto;
      if (weapon && 'weight' in weapon && weapon.weight != null) {
        const unit = this.getLookupDisplayName(weapon.weightUnit);
        return `${weapon.weight}${unit ? ' ' + unit : ''}`.trim();
      }
    }
    return '';
  }

  getCapacityForWeapon(): number | undefined {
    if (this.isCartridge) {
      return this.getCapacity();
    }
    if ((this.isAsset || this.isDirectDto) && this.isWeapon) {
      const weapon = this.item as Asset | WeaponDto;
      return weapon && 'capacity' in weapon ? weapon.capacity : undefined;
    }
    return undefined;
  }

  private loadImage(itemId: number): void {
    // Clean up previous image URL
    if (this.imageUrl) {
      try {
        URL.revokeObjectURL(this.imageUrl);
        this.blobUrls.delete(this.imageUrl);
      } catch (e) {
        console.warn('Error revoking previous image blob URL:', e);
      }
    }
    this.imageUrl = null;

    // Determine entity type based on item type
    let entityType: FileEntityType;
    if (this.isWeapon) {
      entityType = FileEntityType.Weapon;
    } else if (this.isExplosive) {
      entityType = FileEntityType.Explosive;
    } else {
      entityType = FileEntityType.Ammunition;
    }

    // Get all files to find the latest one
    this.fileUploadService.getFilesByEntity(entityType, itemId)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((files: any[]) => {
          if (!files || files.length === 0) {
            return of(null);
          }

          // Get main images (there might be multiple with isMain: true)
          const mainImages = files.filter((img: any) => img.isMain);
          let latestImage: any;
          
          if (mainImages.length > 0) {
            // If multiple main images exist, get the one with highest ID (latest uploaded)
            latestImage = mainImages.reduce((latest: any, current: any) => 
              (current.id > latest.id) ? current : latest
            );
          } else {
            // If no main image, get the image with highest ID (latest uploaded)
            latestImage = files.reduce((latest: any, current: any) => 
              (current.id > latest.id) ? current : latest
            );
          }
          
          if (!latestImage?.id) {
            return of(null);
          }

          // Get the download URL for the latest image
          const imageUrl = this.fileUploadService.getFileDownloadUrl(latestImage.id);
          
          // Fetch image as blob with authentication
          return this.http.get(imageUrl, { responseType: 'blob' }).pipe(
            switchMap((blob) => {
              if (blob.type && blob.type.startsWith('image/')) {
                const blobUrl = URL.createObjectURL(blob);
                this.blobUrls.add(blobUrl);
                this.imageUrl = blobUrl;
                this.cdr?.markForCheck();
              }
              return of(null);
            }),
            catchError((err) => {
              console.warn('Failed to load image blob:', err);
              return of(null);
            })
          );
        }),
        catchError((err) => {
          console.warn('Failed to get files:', err);
          return of(null);
        })
      )
      .subscribe();
  }

  onSelect(): void {
    this.select.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}

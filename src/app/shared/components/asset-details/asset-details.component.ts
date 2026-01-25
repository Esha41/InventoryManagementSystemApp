import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AmmunitionService } from '@services/ammunition.service';
import { WeaponService } from '@services/weapon.service';
import { ExplosiveService } from '@services/explosive.service';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, catchError, switchMap, of, takeUntil } from 'rxjs';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';
import { getLookupDisplayName } from '@utils/asset-list.utils';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';
import { TranslateService } from '@ngx-translate/core';

export type AssetDetailsData = AmmunitionReadDto | WeaponDto | ExplosiveDto | null;

@Component({
  selector: 'app-asset-details',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './asset-details.component.html',
  styleUrls: ['./asset-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetDetailsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() asset: AssetDetailsData = null;
  @Input() assetType?: 'ammunition' | 'weapon' | 'explosive';
  @Input() assetId?: number;
  @Input() isPage: boolean = true; // Whether this is used as a standalone page (default) or inline component
  @Input() showBackButton: boolean = true; // Whether to show back button (only in page mode)
  @Input() showInlineHeader: boolean = false; // Whether to show header in inline mode (for new issue request)
  @Output() close = new EventEmitter<void>(); // Emit when close button is clicked (for inline mode)

  loading = false;
  error: string | null = null;
  readonly ArrowLeft = ArrowLeft;
  private destroy$ = new Subject<void>();

  imageUrl: string | null = null;
  private blobUrls: Set<string> = new Set();

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private fileUploadService: FileUploadService,
    private http: HttpClient,
    public propertyAccessor: AssetPropertyAccessor,
    private translateService: TranslateService,
    @Optional() private route?: ActivatedRoute,
    @Optional() private router?: Router,
    @Optional() private translationService?: TranslationService,
    private cdr?: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // If used as a page component (isPage=true and route params exist), load data from route params
    if (this.isPage && this.route && this.route.snapshot.params['id']) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        const itemId = parseInt(params['id'], 10);
        
        // Get item type from query params
        const tabParam = this.route!.snapshot.queryParams['tab'];
        if (tabParam && (tabParam === 'ammunition' || tabParam === 'weapon' || tabParam === 'explosive')) {
          this.assetType = tabParam;
        }

        if (itemId) {
          this.loadAssetFromRoute(itemId);
        } else {
          this.loading = false;
          this.error = 'Invalid asset ID';
          this.cdr?.markForCheck();
        }
      });
    } else {
      // For inline mode, try to load if inputs are available
      this.tryLoadFromInputs();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle input changes for inline mode
    if (!this.isPage && (changes['assetId'] || changes['assetType'] || changes['asset'])) {
      this.tryLoadFromInputs();
    }
  }

  private tryLoadFromInputs(): void {
    if (this.assetId && this.assetType) {
      // If assetId and assetType are provided as inputs (inline mode)
      this.loadAssetFromRoute(this.assetId);
    } else if (this.asset) {
      // If asset is provided directly, just load the image
      const assetId = this.getAssetId();
      if (assetId) {
        this.loadImage(assetId);
      }
    } else if (!this.isPage) {
      // For inline mode, don't show error if inputs aren't ready yet
      // They might be set asynchronously
      this.loading = true;
      this.cdr?.markForCheck();
    }
  }

  private loadAssetFromRoute(assetId: number): void {
    this.loading = true;
    this.error = null;
    this.cdr?.markForCheck();

    let service$: Observable<AmmunitionReadDto | WeaponDto | ExplosiveDto>;
    
    if (this.assetType === 'weapon') {
      service$ = this.weaponService.getById<WeaponDto>(assetId);
    } else if (this.assetType === 'explosive') {
      service$ = this.explosiveService.getById<ExplosiveDto>(assetId);
    } else {
      service$ = this.ammunitionService.getById<AmmunitionReadDto>(assetId);
    }

    service$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (data: AmmunitionReadDto | WeaponDto | ExplosiveDto) => {
        this.asset = data;
        this.loading = false;
        // Load image after asset data is loaded
        if (assetId) {
          this.loadImage(assetId);
        }
        this.cdr?.markForCheck();
      },
      error: () => {
        this.error = 'Failed to load asset details';
        this.loading = false;
        this.cdr?.markForCheck();
      }
    });
  }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  onBack(): void {
    if (this.router && this.assetType) {
      // Navigate back to asset-list with tab query param
      this.router.navigate(['/asset-list'], {
        queryParams: { tab: this.assetType }
      });
    }
  }

  onClose(): void {
    // Emit close event for inline mode
    this.close.emit();
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
    this.destroy$.next();
    this.destroy$.complete();
  }

  getAssetId(): number | null {
    if (!this.asset) return null;
    if ('id' in this.asset && typeof (this.asset as any).id === 'number') {
      return (this.asset as any).id;
    }
    return null;
  }

  get isWeapon(): boolean {
    return this.assetType === 'weapon' || (this.asset !== null && 'caliber' in this.asset && !('armNumber' in this.asset) && !('explosiveType' in this.asset));
  }

  get isExplosive(): boolean {
    return this.assetType === 'explosive' || (this.asset !== null && 'explosiveType' in this.asset);
  }

  get isAmmunition(): boolean {
    return this.assetType === 'ammunition' || (this.asset !== null && 'armNumber' in this.asset);
  }

  // Getter methods for all fields
  getAssetName(): string {
    return this.propertyAccessor.getAssetName(this.asset) || '-';
  }

  getProductId(): string {
    return this.asset?.itemNo || '-';
  }

  getNSN(): string {
    return this.asset?.nsn || '-';
  }

  getPartNo(): string {
    return this.asset?.partNo || '-';
  }

  getBatchNo(): string {
    return this.propertyAccessor.getBatchNo(this.asset) || '-';
  }

  getPrice(): string {
    return this.propertyAccessor.getPrice(this.asset) || '-';
  }

  getMinimumQuantity(): string {
    return this.propertyAccessor.getMinimumQuantity(this.asset) || '-';
  }

  getExpiryDate(): string {
    return this.propertyAccessor.getExpiryDate(this.asset) || '-';
  }

  getReadyForIssue(): string {
    return this.propertyAccessor.getReadyForIssue(this.asset) || '-';
  }

  // Ammunition specific fields
  getArmNumber(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getArmNumber(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getPrimaryPurpose(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getPrimaryPurpose(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getProjectileColor(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getProjectileColor(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getBulletDiameter(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getBulletDiameter(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getTotalWeight(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getTotalWeight(this.asset as AmmunitionReadDto) || '-';
    }
    if (this.isExplosive) {
      return this.propertyAccessor.getTotalWeight(this.asset as ExplosiveDto) || '-';
    }
    return '-';
  }

  getProjectileMaterial(): string {
    if (this.isAmmunition && this.asset) {
      const ammo = this.asset as AmmunitionReadDto;
      return getLookupDisplayName(ammo.projectailMaterial, this.translateService) || '-';
    }
    return '-';
  }

  getCaseType(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getCaseType(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getPrimer(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getPrimer(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getPropellant(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getPropellant(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getNature(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getNature(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getLinked(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getLinked(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getDistribution(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getDistribution(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    return '-';
  }

  getReferenceNo(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getReferenceNo(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    if (this.isWeapon) {
      return this.propertyAccessor.getReferenceNoForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getUnNumberForAmmunition(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getUnNumberForAmmunition(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
  }

  getClassification(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getClassification(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    if (this.isWeapon) {
      return this.propertyAccessor.getClassificationForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getType(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getType(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    if (this.isWeapon) {
      return this.propertyAccessor.getTypeForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getItemType(): string {
    if (this.isWeapon && this.asset) {
      const weapon = this.asset as WeaponDto;
      if (weapon.itemType !== undefined && weapon.itemType !== null) {
        // Handle both number and string types
        let itemType: number | null = null;
        
        if (typeof weapon.itemType === 'number') {
          itemType = weapon.itemType;
        } else if (typeof weapon.itemType === 'string') {
          const typeMap: { [key: string]: number } = {
            'Weapon': 2,
            '2': 2,
            'Ammunition': 1,
            '1': 1,
            'Explosive': 3,
            '3': 3
          };
          itemType = typeMap[weapon.itemType] || null;
        }
        
        if (itemType === 2) {
          return this.translateService.instant('warehouseInventory.tabs.weapon') || 'Weapon';
        } else if (itemType === 1) {
          return this.translateService.instant('warehouseInventory.tabs.ammunition') || 'Ammunition';
        } else if (itemType === 3) {
          return this.translateService.instant('warehouseInventory.tabs.explosive') || 'Explosive';
        }
      }
    }
    return '-';
  }

  getPriceForWeapon(): string {
    if (this.isWeapon) {
      return this.getPrice();
    }
    return '-';
  }

  getMinimumQuantityForWeapon(): string {
    if (this.isWeapon) {
      return this.getMinimumQuantity();
    }
    return '-';
  }

  getCountryOfManufactureForWeapon(): string {
    if (this.isWeapon) {
      return this.getCountryOfManufacture();
    }
    return '-';
  }

  getNotes(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getNotes(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    if (this.isWeapon) {
      return this.propertyAccessor.getNotesForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  // Weapon specific fields
  getWeaponType(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getTypeForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getCaliber(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getCaliber(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getCaliberUnit(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getCaliberUnit(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getModel(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getModel(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getYearOfManufacture(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getYearOfManufacture(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getCountryOfManufacture(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getCountryOfManufacture(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getDistributionForWeapon(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getDistributionForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getUnNumberForWeapon(): string {
    if (this.isWeapon) {
      return this.propertyAccessor.getUnNumberForWeapon(this.asset as WeaponDto) || '-';
    }
    return '-';
  }

  getBarrelLengthWithUnit(): string {
    // WeaponDto doesn't have barrelLength property
    // These properties exist in Asset interface but not in WeaponDto
    return '-';
  }

  getOverallLengthWithUnit(): string {
    // WeaponDto doesn't have overallLength property
    // These properties exist in Asset interface but not in WeaponDto
    return '-';
  }

  getWeightWithUnit(): string {
    // WeaponDto doesn't have weight property
    // These properties exist in Asset interface but not in WeaponDto
    return '-';
  }

  getCapacity(): number | undefined {
    // WeaponDto doesn't have capacity property
    // These properties exist in Asset interface but not in WeaponDto
    return undefined;
  }

  // Explosive specific fields
  getExplosiveType(): string {
    if (this.isExplosive) {
      return this.propertyAccessor.getExplosiveTypeName(this.asset as ExplosiveDto) || '-';
    }
    return '-';
  }

  getUnNumber(): string {
    if (this.isExplosive) {
      return this.propertyAccessor.getUnNumber(this.asset as ExplosiveDto) || '-';
    }
    return '-';
  }

  getNetExplosiveQuantity(): string {
    if (this.isExplosive) {
      return this.propertyAccessor.getNetExplosiveQuantity(this.asset as ExplosiveDto) || '-';
    }
    return '-';
  }

  getTotalWeightForExplosive(): string {
    if (this.isExplosive) {
      return this.propertyAccessor.getTotalWeight(this.asset as ExplosiveDto) || '-';
    }
    return '-';
  }

  // Shared fields (Ammunition & Explosive)
  getHazardDivision(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getHazardDivision(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    return '-';
  }

  getCapabilityGroup(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getCompatibility(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    return '-';
  }

  getCompatibility(): string {
    if (this.isAmmunition || this.isExplosive) {
      return this.propertyAccessor.getCompatibility(this.asset as AmmunitionReadDto | ExplosiveDto) || '-';
    }
    return '-';
  }

  getUnit(): string {
    if (this.isAmmunition) {
      return this.propertyAccessor.getUnit(this.asset as AmmunitionReadDto) || '-';
    }
    return '-';
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

  private loadImage(assetId: number): void {
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

    // Determine entity type based on asset type
    let entityType: FileEntityType;
    if (this.isWeapon) {
      entityType = FileEntityType.Weapon;
    } else if (this.isExplosive) {
      entityType = FileEntityType.Explosive;
    } else {
      entityType = FileEntityType.Ammunition;
    }

    // Get all files to find the latest one
    this.fileUploadService.getFilesByEntity(entityType, assetId)
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
            switchMap((blob: Blob) => {
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
}

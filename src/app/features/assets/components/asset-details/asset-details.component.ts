import {
  Component,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
  effect,
  signal,
  inject,
  Input,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { LucideAngularModule, ArrowLeft, ArrowRight, X } from 'lucide-angular';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';
import { AssetDetailsService } from './asset-details.service';
import { AssetDetailsFormatterService } from './asset-details-formatter.service';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { AccessoryDto } from '@models/accessory.model';
import { isAccessory, isAmmunition, isExplosive, isWeapon } from '@utils/asset-property.utils';

export type AssetDetailsData = AmmunitionReadDto | WeaponDto | ExplosiveDto | AccessoryDto | null;

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
  providers: [AssetDetailsService, AssetDetailsFormatterService],
  templateUrl: './asset-details.component.html',
  styleUrls: ['./asset-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetDetailsComponent implements OnInit, OnChanges, OnDestroy {

  private readonly assetDetailsService = inject(AssetDetailsService);
  private readonly formatterService = inject(AssetDetailsFormatterService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly translationService = inject(TranslationService, { optional: true });
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);

  // Internal signals - Angular 21 best practice
  private readonly _asset = signal<AssetDetailsData>(null);
  private readonly _assetType = signal<'ammunition' | 'weapon' | 'explosive' | 'accessory' | undefined>(undefined);
  private readonly _assetId = signal<number | undefined>(undefined);
  private readonly _isPage = signal<boolean>(true);
  private readonly _showBackButton = signal<boolean>(true);
  private readonly _showInlineHeader = signal<boolean>(false);

  // State signals
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  imageUrl = signal<SafeUrl | string | null>(null);
  showFullImage = signal<boolean>(false);

  /**
   * RTL for layout/icons. Must be a signal updated from language events — a `computed()` that only
   * read `TranslationService.isRTL()` had no signal dependencies, so it never refreshed after navigation.
   */
  private readonly rtlDirection = signal(false);

  /** Reactive RTL for templates / consumers (read-only view of `rtlDirection`). */
  readonly isRTL = this.rtlDirection.asReadonly();

  readonly isWeapon = computed(() => {
    const type = this._assetType();
    const asset = this._asset();
    if (type === 'weapon') return true;
    if (asset === null) return false;
    return isWeapon(asset);
  });

  readonly isExplosive = computed(() => {
    const type = this._assetType();
    const asset = this._asset();
    if (type === 'explosive') return true;
    if (asset === null) return false;
    return isExplosive(asset);
  });

  readonly isAmmunition = computed(() => {
    const type = this._assetType();
    const asset = this._asset();
    if (type === 'ammunition') return true;
    if (asset === null) return false;
    return isAmmunition(asset);
  });

  readonly isAccessory = computed(() => {
    const type = this._assetType();
    const asset = this._asset();
    if (type === 'accessory') return true;
    if (asset === null) return false;
    return isAccessory(asset);
  });

  readonly currentAssetId = computed(() => {
    const asset = this._asset();
    return this.assetDetailsService.getAssetId(asset);
  });

  // Formatted fields - all getter methods replaced with computed signals
  readonly fields = this.formatterService.createFormattedFields(
    this._asset,
    this.isAmmunition,
    this.isWeapon,
    this.isExplosive
  );

  // Icons
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly X = X; // For modal close button

  /** Back navigation chevron: points toward reading start (LTR=left, RTL=right). */
  get backIcon(): typeof ArrowLeft {
    return this.rtlDirection() ? ArrowRight : ArrowLeft;
  }

  // Cleanup
  private readonly destroy$ = new Subject<void>();
  private readonly blobUrls = new Set<string>();
  private loadingImageFor: { assetId: number; assetType: string } | null = null;
  private imageLoadedFor: { assetId: number; assetType: string } | null = null;
  private requestId: number | null = null; // For back navigation to workflow approval
  private returnToUrl: string | null = null; // For back navigation (e.g. item assignment)

  private syncRtlDirection(): void {
    if (this.translationService) {
      this.rtlDirection.set(this.translationService.isRTL());
      return;
    }
    const fromLang = this.translate.currentLang === 'ar';
    const fromDoc =
      typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl';
    this.rtlDirection.set(fromLang || fromDoc);
  }

  constructor() {
    // Effect to handle asset type detection from asset data
    effect(() => {
      const asset = this._asset();
      if (asset && !this._assetType()) {
        const detectedType = this.assetDetailsService.detectAssetType(asset);
        if (detectedType) {
          this._assetType.set(detectedType);
        }
      }
    });

    // Effect to load image when asset or asset type changes
    // This ensures image loads when asset is set via @Input or route
    effect(() => {
      const assetId = this.currentAssetId();
      const type = this._assetType();

      // Only load if we have all required data
      if (assetId && type) {
        this.loadImage(assetId, type);
      }
    });
  }

  // Legacy @Input support... (skipped for brevity)
  @Input()
  set asset(value: AssetDetailsData) {
    this._asset.set(value);
  }
  get asset(): AssetDetailsData {
    return this._asset();
  }

  @Input()
  set assetType(value: 'ammunition' | 'weapon' | 'explosive' | 'accessory' | undefined) {
    this._assetType.set(value);
  }
  get assetType(): 'ammunition' | 'weapon' | 'explosive' | 'accessory' | undefined {
    return this._assetType();
  }

  @Input()
  set assetId(value: number | undefined) {
    this._assetId.set(value);
  }
  get assetId(): number | undefined {
    return this._assetId();
  }

  @Input()
  set isPage(value: boolean) {
    this._isPage.set(value);
  }
  get isPage(): boolean {
    return this._isPage();
  }

  @Input()
  set showBackButton(value: boolean) {
    this._showBackButton.set(value);
  }
  get showBackButton(): boolean {
    return this._showBackButton();
  }

  @Input()
  set showInlineHeader(value: boolean) {
    this._showInlineHeader.set(value);
  }
  get showInlineHeader(): boolean {
    return this._showInlineHeader();
  }

  // Legacy @Output support
  @Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    this.syncRtlDirection();
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.syncRtlDirection();
      this.cdr.markForCheck();
    });

    // If used as a page component, load data from route params
    if (this._isPage() && this.route?.snapshot.params['id']) {
      // Combine params and queryParams to get all route information at once
      combineLatest([this.route.params, this.route.queryParams])
        .pipe(takeUntil(this.destroy$))
        .subscribe(([params, queryParams]) => {
          const itemId = parseInt(params['id'] || '', 10);

          // Get item type from query params (support both 'tab' and 'itemType')
          const tabParam = queryParams['tab'] || queryParams['itemType'];
          if (tabParam && (tabParam === 'ammunition' || tabParam === 'weapon' || tabParam === 'explosive' || tabParam === 'accessory')) {
            this._assetType.set(tabParam);
          }

          // Get requestId from query params for back navigation
          const requestIdParam = queryParams['requestId'];
          if (requestIdParam) {
            this.requestId = parseInt(requestIdParam, 10);
            if (isNaN(this.requestId) || this.requestId <= 0) {
              this.requestId = null;
            }
          }

          // Get returnTo from query params for back navigation (e.g. from item assignment)
          const returnToParam = queryParams['returnTo'];
          this.returnToUrl = returnToParam && typeof returnToParam === 'string' ? returnToParam : null;

          // Include deleted items when viewing from deleted ammunition list
          const includeDeleted = queryParams['includeDeleted'] === 'true' || queryParams['includeDeleted'] === true;

          if (itemId) {
            // Optimization: Start loading image immediately if type is known from query params
            if (this._assetType()) {
              this.loadImage(itemId, this._assetType()!);
            }
            this.loadAssetFromRoute(itemId, includeDeleted);
          } else {
            this.loading.set(false);
            this.error.set('Invalid asset ID');
          }
        });
    } else {
      // For inline mode, try to load if inputs are available
      this.tryLoadFromInputs();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle input changes for inline mode
    if (!this._isPage() && (changes['assetId'] || changes['assetType'] || changes['asset'])) {
      this.tryLoadFromInputs();
    }
  }

  private tryLoadFromInputs(): void {
    const assetId = this._assetId();
    const assetType = this._assetType();

    if (assetId && assetType) {
      // If assetId and assetType are provided as inputs (inline mode)
      this.loadAssetFromRoute(assetId, false);
    } else if (this._asset()) {
      // If asset is provided directly, image will be loaded via effect
      // No action needed
    } else if (!this._isPage()) {
      // For inline mode, don't show error if inputs aren't ready yet
      this.loading.set(true);
    }
  }

  private loadAssetFromRoute(assetId: number, includeDeleted = false): void {
    this.loading.set(true);
    this.error.set(null);

    const assetType = this._assetType();

    this.assetDetailsService
      .loadAsset(assetId, assetType, includeDeleted)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this._asset.set(data);
          this.loading.set(false);

          // Detect type if not set
          let finalAssetType = assetType;
          if (!assetType && data) {
            const detectedType = this.assetDetailsService.detectAssetType(data);
            if (detectedType) {
              this._assetType.set(detectedType);
              finalAssetType = detectedType;
            }
          }

          // Manually trigger image loading after asset is loaded
          // The effect should handle this, but we ensure it happens
          if (finalAssetType && this.currentAssetId()) {
            this.loadImage(this.currentAssetId()!, finalAssetType);
          }
        },
        error: () => {
          this.error.set('Failed to load asset details');
          this.loading.set(false);
        }
      });
  }

  private loadImage(assetId: number, assetType: 'ammunition' | 'weapon' | 'explosive' | 'accessory'): void {
    // Prevent duplicate concurrent loads for the same asset
    const loadKey = `${assetId}-${assetType}`;
    if (this.loadingImageFor && `${this.loadingImageFor.assetId}-${this.loadingImageFor.assetType}` === loadKey) {
      return; // Already loading this image
    }

    // Check if we already have this image loaded to avoid reloading it
    if (this.imageLoadedFor && this.imageLoadedFor.assetId === assetId && this.imageLoadedFor.assetType === assetType && this.imageUrl()) {
      return; // Already loaded and displayed
    }

    this.loadingImageFor = { assetId, assetType };

    // Only clear if we are loading a different asset
    if (!this.imageLoadedFor || this.imageLoadedFor.assetId !== assetId || this.imageLoadedFor.assetType !== assetType) {
      this.imageUrl.set(null);
      this.imageLoadedFor = null;
    }

    this.cdr.markForCheck(); // Ensure change detection runs

    this.assetDetailsService
      .loadAssetImage(assetId, assetType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blobUrl) => {
          this.loadingImageFor = null; // Clear loading flag
          if (blobUrl) {
            this.blobUrls.add(blobUrl);
            const safeUrl = this.createSafeBlobUrl(blobUrl);
            this.imageUrl.set(safeUrl);
            this.imageLoadedFor = { assetId, assetType }; // Mark as loaded
            this.cdr.detectChanges(); // Force immediate update
          } else {
            // No image found - this is normal, don't log as error
            this.imageUrl.set(null);
            this.imageLoadedFor = { assetId, assetType }; // Mark as loaded (empty) to avoid retry loops
          }
        },
        error: (error) => {
          this.loadingImageFor = null; // Clear loading flag
          console.warn('Failed to load asset image:', error);
          this.imageUrl.set(null);
        }
      });
  }

  openFullImage(): void {
    if (this.imageUrl()) {
      this.showFullImage.set(true);
    }
  }

  closeFullImage(): void {
    this.showFullImage.set(false);
  }

  onBack(): void {
    if (!this.router) return;

    // If returnTo URL was passed (e.g. from item assignment), go back there
    if (this.returnToUrl) {
      this.router.navigateByUrl(this.returnToUrl);
      return;
    }
    // If requestId is available, navigate back to workflow approval page
    if (this.requestId) {
      this.router.navigate(['/requests/requests-management', this.requestId, 'workflow-approval']);
    } else {
      // Navigate back to asset-list, preserving tab, page, and view mode from query params
      const tab = this._assetType();
      const qp = this.route?.snapshot.queryParams ?? {};
      const pageParam = qp['page'];
      const page = pageParam ? parseInt(pageParam, 10) : NaN;
      const queryParams: Record<string, string | number> = {};
      if (tab) queryParams['tab'] = tab;
      if (!isNaN(page) && page >= 1) queryParams['page'] = page;
      if (qp['ammunitionView'] === 'deleted') queryParams['ammunitionView'] = 'deleted';
      if (qp['explosivesView'] === 'deleted') queryParams['explosivesView'] = 'deleted';
      if (qp['weaponsView'] === 'deleted') queryParams['weaponsView'] = 'deleted';
      this.router.navigate(['/assets/asset-list'], { queryParams });
    }
  }

  onClose(): void {
    this.close.emit();
  }

  private createSafeBlobUrl(url: string): SafeUrl {
    if (!url.startsWith('blob:')) {
      throw new Error(`Security violation: expected a blob URL, got: ${url.substring(0, 30)}`);
    }
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  ngOnDestroy(): void {
    // Clean up all blob URLs to prevent memory leaks
    this.blobUrls.forEach((url) => {
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

  // Legacy getter methods for backward compatibility with template
  // These delegate to computed signals for better performance
  getAssetName(): string {
    return this.fields.assetName();
  }

  getAssetNameAr(): string {
    const asset = this._asset() as { nameAr?: string | null; nameAR?: string | null } | null;
    return asset?.nameAr || asset?.nameAR || '-';
  }

  getProductId(): string {
    return this.fields.productId();
  }

  getNSN(): string {
    return this.fields.nsn();
  }

  getPartNo(): string {
    return this.fields.partNo();
  }

  getBatchNo(): string {
    return this.fields.batchNo();
  }

  getPrice(): string {
    return this.fields.price();
  }

  getMinimumQuantity(): string {
    return this.fields.minimumQuantity();
  }

  getCriticalQuantity(): string {
    return this.fields.criticalQuantity();
  }

  getExpiryDate(): string {
    return this.fields.expiryDate();
  }

  getReadyForIssue(): string {
    return this.fields.readyForIssue();
  }

  getArmNumber(): string {
    return this.fields.armNumber();
  }

  getPrimaryPurpose(): string {
    return this.fields.primaryPurpose();
  }

  getProjectileColor(): string {
    return this.fields.projectileColor();
  }

  getBulletDiameter(): string {
    return this.fields.bulletDiameter();
  }

  getTotalWeight(): string {
    return this.fields.totalWeight();
  }

  getProjectileMaterial(): string {
    return this.fields.projectileMaterial();
  }

  getCaseType(): string {
    return this.fields.caseType();
  }

  getPrimer(): string {
    return this.fields.primer();
  }

  getPropellant(): string {
    return this.fields.propellant();
  }

  getLinked(): string {
    return this.fields.linked();
  }

  getDistribution(): string {
    return this.fields.distribution();
  }

  getReferenceNo(): string {
    return this.fields.referenceNo();
  }

  getUnNumberForAmmunition(): string {
    return this.fields.unNumberForAmmunition();
  }

  getClassification(): string {
    return this.fields.classification();
  }

  getType(): string {
    return this.fields.type();
  }

  getNotes(): string {
    return this.fields.notes();
  }

  getWeaponType(): string {
    return this.fields.weaponType();
  }

  getAmmunitionCaliber(): string {
    return this.fields.ammunitionCaliber();
  }

  getCaliber(): string {
    return this.fields.caliber();
  }

  getUnit(): string {
    return this.fields.unit();
  }

  getCompatibility(): string {
    return this.fields.compatibility();
  }

  getPriceForWeapon(): string {
    return this.fields.priceForWeapon();
  }

  getMinimumQuantityForWeapon(): string {
    return this.fields.minimumQuantityForWeapon();
  }

  getCountryOfManufactureForWeapon(): string {
    return this.fields.countryOfManufactureForWeapon();
  }

  getItemType(): string {
    return this.fields.itemType();
  }

  getCaliberUnit(): string {
    return this.fields.caliberUnit();
  }

  getModel(): string {
    return this.fields.model();
  }

  getYearOfManufacture(): string {
    return this.fields.yearOfManufacture();
  }

  getCountryOfManufacture(): string {
    return this.fields.countryOfManufacture();
  }

  getDistributionForWeapon(): string {
    return this.fields.distributionForWeapon();
  }

  getUnNumberForWeapon(): string {
    return this.fields.unNumberForWeapon();
  }

  getBarrelLengthWithUnit(): string {
    return this.fields.barrelLengthWithUnit();
  }

  getOverallLengthWithUnit(): string {
    return this.fields.overallLengthWithUnit();
  }

  getWeightWithUnit(): string {
    return this.fields.weightWithUnit();
  }

  getCapacity(): number | undefined {
    return this.fields.capacity();
  }

  getExplosiveType(): string {
    return this.fields.explosiveType();
  }

  getExplosiveTypeDisplay(): string {
    return this.fields.explosiveTypeDisplay();
  }

  getUnNumber(): string {
    return this.fields.unNumber();
  }

  getNetExplosiveQuantity(): string {
    return this.fields.netExplosiveQuantity();
  }

  getTotalWeightForExplosive(): string {
    return this.fields.totalWeightForExplosive();
  }

  getHazardDivision(): string {
    return this.fields.hazardDivision();
  }

  getCapabilityGroup(): string {
    return this.fields.capabilityGroup();
  }

  getCaliberCategory(): string {
    return this.fields.caliberCategory();
  }
}

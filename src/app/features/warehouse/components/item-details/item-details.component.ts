import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectionStrategy,
  OnInit,
  Optional,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { FileUploadService, FileEntityType } from '@services/file-upload.service';
import { FileUploadDto } from '@models/file-upload.model';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, catchError, switchMap, of, takeUntil } from 'rxjs';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { TranslationService } from '@services/translation.service';
import { ItemDetailsData, ItemTypeHint } from './models/item-details-types';
import { ItemDetailsResolvedContext } from './models/item-details-resolved-context';
import { ItemTypeDetectorService } from './services/item-type-detector.service';
import { ItemPropertyMapperService } from './services/item-property-mapper.service';
import {
  AmmunitionDetailsComponent,
  WeaponDetailsComponent,
  ExplosiveDetailsComponent,
  CartridgeDetailsComponent
} from './sub-components';

@Component({
  selector: 'app-item-details',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent,
    AmmunitionDetailsComponent,
    WeaponDetailsComponent,
    ExplosiveDetailsComponent,
    CartridgeDetailsComponent
  ],
  templateUrl: './item-details.component.html',
  styleUrls: ['./item-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ItemTypeDetectorService, ItemPropertyMapperService]
})
export class ItemDetailsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() item: ItemDetailsData = null;
  @Input() showActions = true;
  @Input() isModal = false;
  @Input() isPage = false;
  @Input() itemType?: ItemTypeHint;
  @Output() select = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  loading = false;
  error: string | null = null;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  ctx: ItemDetailsResolvedContext | null = null;
  imageUrl: string | null = null;

  private destroy$ = new Subject<void>();
  private blobUrls = new Set<string>();

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private fileUploadService: FileUploadService,
    private http: HttpClient,
    private detector: ItemTypeDetectorService,
    public mapper: ItemPropertyMapperService,
    @Optional() private route?: ActivatedRoute,
    @Optional() private router?: Router,
    @Optional() private translationService?: TranslationService,
    private cdr?: ChangeDetectorRef
  ) {}

  get backIcon(): typeof ArrowLeft {
    return this.translationService?.isRTL() ? ArrowRight : ArrowLeft;
  }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  ngOnInit(): void {
    if (this.route && this.route.snapshot.params['id']) {
      this.isPage = true;
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        const itemId = parseInt(params['id'], 10);
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] || changes['itemType']) {
      this.refreshContext();
    }
    if (changes['item'] && this.item) {
      const itemId = this.detector.getItemId(this.item, this.ctx);
      if (itemId) {
        this.loadImage(itemId);
      }
    }
  }

  ngOnDestroy(): void {
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

  onBack(): void {
    if (this.router && this.itemType) {
      this.router.navigate(['/assets/asset-list'], {
        queryParams: { tab: this.itemType }
      });
    } else {
      this.cancel.emit();
    }
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

  private refreshContext(): void {
    this.ctx = this.detector.detect(this.item, this.itemType) ?? null;
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
        this.refreshContext();
        this.loading = false;
        const id = this.detector.getItemId(this.item, this.ctx);
        if (id) {
          this.loadImage(id);
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

  private loadImage(itemId: number): void {
    if (this.imageUrl) {
      try {
        URL.revokeObjectURL(this.imageUrl);
        this.blobUrls.delete(this.imageUrl);
      } catch (e) {
        console.warn('Error revoking previous image blob URL:', e);
      }
    }
    this.imageUrl = null;

    let entityType: FileEntityType;
    if (this.ctx?.isWeapon) {
      entityType = FileEntityType.Weapon;
    } else if (this.ctx?.isExplosive) {
      entityType = FileEntityType.Explosive;
    } else {
      entityType = FileEntityType.Ammunition;
    }

    this.fileUploadService
      .getFilesByEntity(entityType, itemId)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((files: FileUploadDto[]) => {
          if (!files || files.length === 0) {
            return of(null);
          }
          const mainImages = files.filter(img => img.isMain);
          let latestImage: FileUploadDto;
          if (mainImages.length > 0) {
            latestImage = mainImages.reduce((latest, current) =>
              current.id > latest.id ? current : latest
            );
          } else {
            latestImage = files.reduce((latest, current) =>
              current.id > latest.id ? current : latest
            );
          }
          if (!latestImage?.id) {
            return of(null);
          }
          const imageUrl = this.fileUploadService.getFileDownloadUrl(latestImage.id);
          return this.http.get(imageUrl, { responseType: 'blob' }).pipe(
            switchMap(blob => {
              if (blob.type && blob.type.startsWith('image/')) {
                const blobUrl = URL.createObjectURL(blob);
                this.blobUrls.add(blobUrl);
                this.imageUrl = blobUrl;
                this.cdr?.markForCheck();
              }
              return of(null);
            }),
            catchError(err => {
              console.warn('Failed to load image blob:', err);
              return of(null);
            })
          );
        }),
        catchError(err => {
          console.warn('Failed to get files:', err);
          return of(null);
        })
      )
      .subscribe();
  }
}

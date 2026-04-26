import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil, catchError, combineLatest } from 'rxjs';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { CartridgeMapperService } from '@assets/services/cartridge-mapper.service';
import { Cartridge } from '@models/cartridge.model';
import { CartridgeDetailsComponent } from '@requests/pages/new-issue/components/cartridge-details/cartridge-details.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';

type ItemDto = AmmunitionReadDto | WeaponDto | ExplosiveDto;

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CartridgeDetailsComponent,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemDetailComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;

  private readonly destroy$ = new Subject<void>();

  itemId: number = 0;
  requestId: number | null = null;
  cartridge: Cartridge | null = null;
  loading: boolean = true;
  error: string | null = null;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private cartridgeMapper: CartridgeMapperService,
    private toastService: ToastService,
    private translationService: TranslationService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Combine params and queryParams to get all route information at once
    combineLatest([this.route.params, this.route.queryParams])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, queryParams]) => {
        const id = params['id'];
        if (id) {
          this.itemId = parseInt(id, 10);
          if (!isNaN(this.itemId) && this.itemId > 0) {
            // Get request ID from query params
            const requestIdParam = queryParams['requestId'];
            if (requestIdParam) {
              this.requestId = parseInt(requestIdParam, 10);
              if (isNaN(this.requestId) || this.requestId <= 0) {
                this.requestId = null;
              }
            }
            // Get item type from query params
            const itemType = queryParams['itemType'];
            this.loadItemDetails(itemType);
          } else {
            this.error = 'Invalid item ID';
            this.loading = false;
            this.cdr.markForCheck();
          }
        } else {
          this.error = 'Item ID not provided';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadItemDetails(itemType?: string): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    // If itemType is provided, use the specific service
    if (itemType) {
      this.loadItemByType(itemType);
      return;
    }

    // Otherwise, try all three services in sequence
    this.tryLoadItem();
  }

  private tryLoadItem(): void {
    // Try ammunition first
    this.ammunitionService.getById<AmmunitionReadDto>(this.itemId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          // If ammunition fails, try weapon
          return this.weaponService.getById<WeaponDto>(this.itemId).pipe(
            catchError(() => {
              // If weapon fails, try explosive
              return this.explosiveService.getById<ExplosiveDto>(this.itemId).pipe(
                catchError((err) => {
                  // All three failed
                  throw err;
                })
              );
            })
          );
        })
      )
      .subscribe({
        next: (data) => {
          if (data) {
            const currentLang = this.translationService?.getCurrentLanguage() || 'en';
            // Determine which mapper to use based on the data structure
            if (this.isWeapon(data)) {
              this.cartridge = this.cartridgeMapper.mapWeaponToCartridge(data, currentLang);
            } else if (this.isExplosive(data)) {
              this.cartridge = this.cartridgeMapper.mapExplosiveToCartridge(data, currentLang);
            } else {
              // Default to ammunition mapper
              this.cartridge = this.cartridgeMapper.mapAmmunitionToCartridge(data, currentLang);
            }
            this.loading = false;
            this.cdr.markForCheck();
          } else {
            this.error = 'Item not found';
            this.loading = false;
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.error = 'Failed to load item details. Please try again.';
          this.loading = false;
          this.cdr.markForCheck();
          this.translateService.get(['toast.failedToLoadItemDetails', 'toast.error']).subscribe(translations => {
            this.toastService.error(translations['toast.failedToLoadItemDetails'], translations['toast.error']);
          });
        }
      });
  }

  private loadItemByType(itemType: string): void {
    const normalizedType = itemType.toLowerCase();

    if (normalizedType === 'weapon' || normalizedType === '2') {
      this.weaponService.getById<WeaponDto>(this.itemId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            if (data) {
              const currentLang = this.translationService?.getCurrentLanguage() || 'en';
              this.cartridge = this.cartridgeMapper.mapWeaponToCartridge(data, currentLang);
              this.loading = false;
              this.cdr.markForCheck();
            } else {
              this.error = 'Item not found';
              this.loading = false;
              this.cdr.markForCheck();
            }
          },
          error: (err) => {
            this.error = 'Failed to load item details. Please try again.';
            this.loading = false;
            this.cdr.markForCheck();
            this.translateService.get(['toast.failedToLoadItemDetails', 'toast.error']).subscribe(translations => {
              this.toastService.error(translations['toast.failedToLoadItemDetails'], translations['toast.error']);
            });
          }
        });
    } else if (normalizedType === 'explosive' || normalizedType === '3') {
      this.explosiveService.getById<ExplosiveDto>(this.itemId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            if (data) {
              const currentLang = this.translationService?.getCurrentLanguage() || 'en';
              this.cartridge = this.cartridgeMapper.mapExplosiveToCartridge(data, currentLang);
              this.loading = false;
              this.cdr.markForCheck();
            } else {
              this.error = 'Item not found';
              this.loading = false;
              this.cdr.markForCheck();
            }
          },
          error: (err) => {
            this.error = 'Failed to load item details. Please try again.';
            this.loading = false;
            this.cdr.markForCheck();
            this.translateService.get(['toast.failedToLoadItemDetails', 'toast.error']).subscribe(translations => {
              this.toastService.error(translations['toast.failedToLoadItemDetails'], translations['toast.error']);
            });
          }
        });
    } else {
      // Default to ammunition
      this.ammunitionService.getById<AmmunitionReadDto>(this.itemId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => {
            if (data) {
              const currentLang = this.translationService?.getCurrentLanguage() || 'en';
              this.cartridge = this.cartridgeMapper.mapAmmunitionToCartridge(data, currentLang);
              this.loading = false;
              this.cdr.markForCheck();
            } else {
              this.error = 'Item not found';
              this.loading = false;
              this.cdr.markForCheck();
            }
          },
          error: (err) => {
            this.error = 'Failed to load item details. Please try again.';
            this.loading = false;
            this.cdr.markForCheck();
            this.translateService.get(['toast.failedToLoadItemDetails', 'toast.error']).subscribe(translations => {
              this.toastService.error(translations['toast.failedToLoadItemDetails'], translations['toast.error']);
            });
          }
        });
    }
  }

  private isWeapon(data: ItemDto): data is WeaponDto {
    return data !== null && 'weaponType' in data && 'caliber' in data && 'actionType' in data;
  }

  private isExplosive(data: ItemDto): data is ExplosiveDto {
    return data !== null && ('explosiveType' in data || 'unNumber' in data || 'netExplosiveQuantity' in data);
  }

  goBack(): void {
    // Navigate back to the approval page if requestId is available, otherwise go to requests list
    if (this.requestId) {
      this.router.navigate(['/requests/requests-management', this.requestId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests/requests-management']);
    }
  }
}


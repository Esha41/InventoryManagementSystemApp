import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil, combineLatest, EMPTY, throwError, Observable } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
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
    combineLatest([this.route.params, this.route.queryParams])
      .pipe(
        switchMap(([params, queryParams]) => {
          const id = params['id'];
          if (!id) {
            this.error = 'Item ID not provided';
            this.loading = false;
            this.cdr.markForCheck();
            return EMPTY;
          }
          const parsedId = parseInt(id, 10);
          if (isNaN(parsedId) || parsedId <= 0) {
            this.error = 'Invalid item ID';
            this.loading = false;
            this.cdr.markForCheck();
            return EMPTY;
          }
          this.itemId = parsedId;
          const requestIdParam = queryParams['requestId'];
          if (requestIdParam) {
            this.requestId = parseInt(requestIdParam, 10);
            if (isNaN(this.requestId) || this.requestId <= 0) {
              this.requestId = null;
            }
          } else {
            this.requestId = null;
          }
          const itemType = queryParams['itemType'];
          this.loading = true;
          this.error = null;
          this.cdr.markForCheck();

          const detail$ = itemType ? this.fetchByItemType$(itemType) : this.tryLoadItem$();
          return detail$.pipe(
            tap((data) => {
              if (data) {
                const currentLang = this.translationService?.getCurrentLanguage() || 'en';
                if (this.isWeapon(data)) {
                  this.cartridge = this.cartridgeMapper.mapWeaponToCartridge(data, currentLang);
                } else if (this.isExplosive(data)) {
                  this.cartridge = this.cartridgeMapper.mapExplosiveToCartridge(data, currentLang);
                } else {
                  this.cartridge = this.cartridgeMapper.mapAmmunitionToCartridge(data, currentLang);
                }
                this.loading = false;
                this.cdr.markForCheck();
              } else {
                this.error = 'Item not found';
                this.loading = false;
                this.cdr.markForCheck();
              }
            }),
            catchError(() => {
              this.error = 'Failed to load item details. Please try again.';
              this.loading = false;
              this.cdr.markForCheck();
              this.translateService
                .get(['toast.failedToLoadItemDetails', 'toast.error'])
                .pipe(takeUntil(this.destroy$))
                .subscribe(translations => {
                  this.toastService.error(
                    translations['toast.failedToLoadItemDetails'],
                    translations['toast.error']
                  );
                });
              return EMPTY;
            }),
            map(() => void 0)
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchByItemType$(itemType: string): Observable<ItemDto | null | undefined> {
    const normalizedType = itemType.toLowerCase();

    if (normalizedType === 'weapon' || normalizedType === '2') {
      return this.weaponService.getById<WeaponDto>(this.itemId);
    }
    if (normalizedType === 'explosive' || normalizedType === '3') {
      return this.explosiveService.getById<ExplosiveDto>(this.itemId);
    }
    return this.ammunitionService.getById<AmmunitionReadDto>(this.itemId);
  }

  private tryLoadItem$(): Observable<ItemDto> {
    return this.ammunitionService.getById<AmmunitionReadDto>(this.itemId).pipe(
      catchError(() =>
        this.weaponService.getById<WeaponDto>(this.itemId).pipe(
          catchError(() =>
            this.explosiveService.getById<ExplosiveDto>(this.itemId).pipe(
              catchError((err) => throwError(() => err))
            )
          )
        )
      )
    );
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


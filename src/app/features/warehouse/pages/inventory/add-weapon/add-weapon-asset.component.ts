import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Save, X, ArrowLeft, ArrowRight } from 'lucide-angular';

import { LookupItem } from '@services/lookup.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { PERMISSIONS } from '@constants/permissions.constants';

import { WeaponDto } from '@models/weapon.model';

import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { LoadingStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

import {
  WeaponAssetCatalogLoaderService,
  type WeaponAssetCatalogLoaded
} from './services/weapon-asset-catalog-loader.service';
import { WeaponAssetSubmissionService } from './services/weapon-asset-submission.service';
import { WeaponAssetBulkProgressOverlayComponent } from './components/weapon-asset-bulk-progress-overlay.component';
import { buildCreateBulkAssetsFromTemplateDto, type BulkFormValue } from './utils/weapon-asset-dto.mapper';
import { createBulkWeaponAssetForm } from './utils/weapon-asset-form.factory';
import {
  WEAPON_ASSET_MAX_BULK_QUANTITY,
  WEAPON_ASSET_MAX_FILL_IDENTIFIERS_QUANTITY
} from './utils/weapon-asset.constants';
import { fieldErrorFromControl } from './utils/weapon-asset-form-errors.util';
import { formatFileSizeHuman, mergeUploadedFilesDeduped } from './utils/weapon-asset-files.util';
import { validateAttachments, showAttachmentValidationToast } from '@utils/file.utils';
import {
  departmentOrLookupDropdownLabelFactory,
  weaponDropdownLabel
} from './utils/weapon-asset-dropdown-labels.util';
import { WeaponAssetPrimaryPurposeOptionsCache } from './utils/weapon-asset-primary-purpose-cache';

@Component({
  selector: 'app-add-weapon-asset',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    LoadingStateComponent,
    HasPermissionDirective,
    WeaponAssetBulkProgressOverlayComponent
  ],
  templateUrl: './add-weapon-asset.component.html',
  styleUrls: ['./add-weapon-asset.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddWeaponAssetComponent implements OnInit {
  readonly PERMISSIONS = PERMISSIONS;

  readonly Save = Save;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly weaponOptionLabel = weaponDropdownLabel;

  warehouseId!: number;
  warehouseName = '';
  currentDepot: LookupItem | null = null;
  availableWeapons: WeaponDto[] = [];
  suppliers: LookupItem[] = [];
  manufacturers: LookupItem[] = [];
  allPrimaryPurposes: LookupItem[] = [];

  loading = true;
  submitting = false;
  errorMessage: string | null = null;

  bulkForm!: FormGroup;
  isProcessingBulk = false;
  deliveryReceiptFiles: File[] = [];
  bulkProgressPercent = 0;
  bulkProgressCount = 0;
  bulkProgressTotal = 0;
  bulkProgressElapsedSeconds = 0;
  private bulkProgressInterval?: number;

  private quantityTierSub?: Subscription;
  private readonly purposeOptionsCache = new WeaponAssetPrimaryPurposeOptionsCache();

  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly translationService = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly catalogLoader = inject(WeaponAssetCatalogLoaderService);
  private readonly submission = inject(WeaponAssetSubmissionService);

  readonly lookupOptionLabel = departmentOrLookupDropdownLabelFactory((e) =>
    getLocalizedName(e, getCurrentLang(this.translateService)) || ''
  );

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  readonly maxQuantityForFillIdentifiers = WEAPON_ASSET_MAX_FILL_IDENTIFIERS_QUANTITY;
  readonly maxBulkQuantity = WEAPON_ASSET_MAX_BULK_QUANTITY;

  get isBulkFillIdentifiersDisabled(): boolean {
    const qty = this.bulkForm?.get('quantity')?.value;
    return qty != null && qty > this.maxQuantityForFillIdentifiers;
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.quantityTierSub?.unsubscribe());

    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        filter((id): id is string => !!id?.trim()),
        map((id) => Number.parseInt(id, 10)),
        filter((wid) => !Number.isNaN(wid)),
        distinctUntilChanged(),
        tap((wid) => {
          this.warehouseId = wid;
          this.purposeOptionsCache.clear();
          this.initializeForm();
          this.loading = true;
          this.errorMessage = null;
          this.cdr.markForCheck();
        }),
        switchMap((wid) => this.catalogLoader.loadCatalog(wid)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data: WeaponAssetCatalogLoaded) => {
          this.applyCatalogData(data);
        },
        error: () => {
          this.errorMessage = this.translateService.instant('addWeaponAsset.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });

    this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.currentDepot) {
        this.warehouseName =
          getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) ||
          `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;
      }
      this.purposeOptionsCache.clear();
      this.cdr.markForCheck();
    });
  }

  private applyCatalogData(data: WeaponAssetCatalogLoaded): void {
    this.currentDepot = data.currentDepot;
    this.warehouseName =
      getLocalizedName(this.currentDepot, getCurrentLang(this.translateService)) ||
      `${this.translateService.instant('addWeaponAsset.warehouse')} ${this.warehouseId}`;

    this.availableWeapons = data.availableWeapons;
    this.suppliers = data.suppliers;
    this.manufacturers = data.manufacturers;
    this.allPrimaryPurposes = data.allPrimaryPurposes;

    this.purposeOptionsCache.clear();

    this.loading = false;
    this.cdr.markForCheck();
  }

  private initializeForm(): void {
    this.quantityTierSub?.unsubscribe();

    this.bulkForm = createBulkWeaponAssetForm(this.fb);

    this.quantityTierSub = this.bulkForm.get('quantity')!.valueChanges.subscribe((qty) => {
      const ctrl = this.bulkForm.get('fillIdentifiers')!;
      if (qty != null && qty > this.maxQuantityForFillIdentifiers) {
        ctrl.setValue(false, { emitEvent: false });
        ctrl.disable({ emitEvent: false });
      } else {
        ctrl.enable({ emitEvent: false });
      }
    });
  }

  getBulkFieldError(fieldPath: string): string | null {
    const c = this.bulkForm?.get(fieldPath) ?? null;
    return fieldErrorFromControl(c, this.translateService);
  }

  getPrimaryPurposeOptionsForBulk(): LookupItem[] {
    const itemId = this.bulkForm.get('itemId')?.value as number | null;
    return this.purposeOptionsCache.get(itemId, this.availableWeapons, this.allPrimaryPurposes);
  }

  onBulkWeaponSelected(): void {
    this.purposeOptionsCache.clear();
    this.bulkForm.patchValue({ primaryPurposId: null });
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    this.bulkForm.markAllAsTouched();
    if (this.bulkForm.invalid) {
      this.toastService.error(
        this.translateService.instant('addWeaponAsset.validationError'),
        this.translateService.instant('toast.error')
      );
      return;
    }
    if (this.bulkForm.getRawValue().fillIdentifiers) {
      void this.navigateToBulkEntry();
      return;
    }

    this.submitBulkFromTemplate();
  }

  private submitBulkFromTemplate(): void {
    const val = this.bulkForm.getRawValue() as BulkFormValue;
    const dto = buildCreateBulkAssetsFromTemplateDto(val, this.warehouseId);

    this.submitting = true;
    this.isProcessingBulk = true;
    this.errorMessage = null;

    this.bulkProgressTotal = dto.quantity || 0;
    this.bulkProgressCount = 0;
    this.bulkProgressPercent = 0;
    this.bulkProgressElapsedSeconds = 0;

    const startTime = Date.now();

    this.bulkProgressInterval = window.setInterval(() => {
      this.bulkProgressElapsedSeconds = Math.round((Date.now() - startTime) / 1000);

      const estimatedTotalSeconds = Math.max(10, this.bulkProgressTotal / 15_000);
      const estimatedPercent = Math.min(95, (this.bulkProgressElapsedSeconds / estimatedTotalSeconds) * 100);
      this.bulkProgressPercent = Math.round(estimatedPercent);

      this.cdr.markForCheck();
    }, 200);

    this.cdr.markForCheck();

    this.submission
      .createWeaponAssetsBulkFromTemplate(dto, this.deliveryReceiptFiles)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.clearBulkProgress();
          this.bulkProgressPercent = 100;
          this.cdr.markForCheck();

          setTimeout(() => {
            this.isProcessingBulk = false;
            void this.onSubmitSuccessFinalize();
          }, 500);
        },
        error: (error: unknown) => {
          this.clearBulkProgress();
          this.isProcessingBulk = false;
          void this.onSubmitError(error);
        }
      });
  }

  private clearBulkProgress(): void {
    if (this.bulkProgressInterval !== undefined) {
      clearInterval(this.bulkProgressInterval);
      this.bulkProgressInterval = undefined;
    }
  }

  private async onSubmitSuccessFinalize(): Promise<void> {
    this.submitting = false;
    this.cdr.markForCheck();
    await this.submission.finalizeSuccessNavigation(this.warehouseId);
  }

  private async onSubmitError(error: unknown): Promise<void> {
    const fallbackMessage = this.translateService.instant('addWeaponAsset.createError');
    const errorMsg = ErrorHandler.extractErrorMessage(error, fallbackMessage);
    this.errorMessage = errorMsg;
    this.submitting = false;
    this.cdr.markForCheck();
    await this.submission.showErrorToast(errorMsg);
  }

  onAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newlySelected = input.files ? Array.from(input.files) : [];
    if (newlySelected.length) {
      const check = validateAttachments(newlySelected);
      if (!check.valid) {
        showAttachmentValidationToast(this.translateService, this.toastService, check.errorMessage);
        input.value = '';
        this.cdr.markForCheck();
        return;
      }
      this.deliveryReceiptFiles = mergeUploadedFilesDeduped(this.deliveryReceiptFiles, newlySelected);
    }
  }

  removeAttachment(index: number): void {
    if (index >= 0 && index < this.deliveryReceiptFiles.length) {
      this.deliveryReceiptFiles.splice(index, 1);
    }
  }

  getFileSize(file: File): string {
    return formatFileSizeHuman(file.size);
  }

  private async navigateToBulkEntry(): Promise<void> {
    await this.submission.goToBulkIdentifierEntry(this.warehouseId, this.bulkForm.value as BulkFormValue);
  }

  get shouldShowNextButton(): boolean {
    return !!this.bulkForm.getRawValue().fillIdentifiers;
  }

  onCancel(): void {
    void this.submission.navigateBackToWarehouseInventory(this.warehouseId);
  }

  getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}

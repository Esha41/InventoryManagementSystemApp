import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, ArrowLeft, ArrowRight, Package, Plus, Trash2 } from 'lucide-angular';
import { ReturnService, ProcessReturnItemsDto, ReturnAmmoExplosiveItemDto, ReturnWeaponItemDto } from '@services/return.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

interface AmmoExplosiveRow {
  itemId: number;
  itemName: string;
  quantity: number | null;
  lot: string;
}

interface WeaponRow {
  itemId: number;
  itemName: string;
  serialNumber: string;
  batchNumber: string;
}

@Component({
  selector: 'app-process-return-items',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './process-return-items.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessReturnItemsComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly Package = Package;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;

  private destroy$ = new Subject<void>();

  requestId = 0;
  loading = true;
  error: string | null = null;
  processing = false;
  requestNo = '';

  ammoExplosiveRows: AmmoExplosiveRow[] = [];
  weaponRows: WeaponRow[] = [];

  // Raw request items for reference
  requestItems: any[] = [];

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  get hasAmmoExplosiveItems(): boolean {
    return this.requestItems.some(i => i.itemType === 1 || i.itemType === 3 || i.itemType === 'Ammunition' || i.itemType === 'Explosive');
  }

  get hasWeaponItems(): boolean {
    return this.requestItems.some(i => i.itemType === 2 || i.itemType === 'Weapon');
  }

  get canSubmit(): boolean {
    const hasAmmoData = this.ammoExplosiveRows.length > 0 &&
      this.ammoExplosiveRows.every(r => r.itemId && r.quantity && r.quantity > 0 && r.lot?.trim());
    const hasWeaponData = this.weaponRows.length > 0 &&
      this.weaponRows.every(r => r.itemId && r.serialNumber?.trim() && r.batchNumber?.trim());
    return hasAmmoData || hasWeaponData;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private returnService: ReturnService,
    private toastService: ToastService,
    private translateService: TranslateService,
    public translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = parseInt(this.route.snapshot.params['id'], 10);
    if (isNaN(id)) {
      this.error = 'Invalid request ID';
      this.loading = false;
      return;
    }
    this.requestId = id;
    this.loadReturnData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadReturnData(): void {
    this.returnService.getReturnById(this.requestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (returnData: any) => {
          this.requestNo = returnData.requestNo || '';
          this.requestItems = returnData.requestItems || [];
          this.initializeRows();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = ErrorHandler.extractErrorMessage(err, 'Failed to load return request');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private initializeRows(): void {
    for (const item of this.requestItems) {
      const type = item.itemType;
      const isAmmoOrExplosive = type === 1 || type === 3 || type === 'Ammunition' || type === 'Explosive';
      const isWeapon = type === 2 || type === 'Weapon';
      const itemName = item.itemName || item.name || 'Unknown Item';
      const itemId = item.itemId || item.id;

      if (isAmmoOrExplosive) {
        this.ammoExplosiveRows.push({
          itemId,
          itemName,
          quantity: item.quantity || null,
          lot: ''
        });
      } else if (isWeapon) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
          this.weaponRows.push({
            itemId,
            itemName,
            serialNumber: '',
            batchNumber: ''
          });
        }
      }
    }
  }

  addAmmoRow(): void {
    this.ammoExplosiveRows.push({ itemId: 0, itemName: '', quantity: null, lot: '' });
    this.cdr.markForCheck();
  }

  removeAmmoRow(index: number): void {
    this.ammoExplosiveRows.splice(index, 1);
    this.cdr.markForCheck();
  }

  addWeaponRow(): void {
    this.weaponRows.push({ itemId: 0, itemName: '', serialNumber: '', batchNumber: '' });
    this.cdr.markForCheck();
  }

  removeWeaponRow(index: number): void {
    this.weaponRows.splice(index, 1);
    this.cdr.markForCheck();
  }

  getItemName(item: any): string {
    const lang = getCurrentLang(this.translateService);
    return getLocalizedName(item, lang) || item.itemName || item.name || '';
  }

  goBack(): void {
    this.router.navigate(['/requests-management', this.requestId, 'workflow-approval']);
  }

  submit(): void {
    if (this.processing || !this.canSubmit) return;

    this.processing = true;

    const dto: ProcessReturnItemsDto = {
      ammoExplosiveItems: this.ammoExplosiveRows
        .filter(r => r.itemId && r.quantity && r.quantity > 0 && r.lot?.trim())
        .map(r => ({
          itemId: r.itemId,
          quantity: r.quantity!,
          lot: r.lot.trim()
        })),
      weaponItems: this.weaponRows
        .filter(r => r.itemId && r.serialNumber?.trim() && r.batchNumber?.trim())
        .map(r => ({
          itemId: r.itemId,
          serialNumber: r.serialNumber.trim(),
          batchNumber: r.batchNumber.trim()
        }))
    };

    this.returnService.processReturnItems(this.requestId, dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processing = false;
          this.translateService.get(['toast.success', 'processReturnItems.success'])
            .pipe(takeUntil(this.destroy$))
            .subscribe(t => {
              this.toastService.success(
                t['processReturnItems.success'] || 'Return items processed successfully',
                t['toast.success'] || 'Success'
              );
            });
          this.router.navigate(['/requests-management', this.requestId, 'workflow-approval']);
        },
        error: (error) => {
          this.processing = false;
          const msg = ErrorHandler.extractErrorMessage(error, 'Failed to process return items');
          this.translateService.get('toast.error')
            .pipe(takeUntil(this.destroy$))
            .subscribe(title => {
              this.toastService.error(msg, title);
            });
          this.cdr.markForCheck();
        }
      });
  }
}

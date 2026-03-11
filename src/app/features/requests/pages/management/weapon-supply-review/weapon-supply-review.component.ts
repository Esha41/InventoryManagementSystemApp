import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight, ChevronDown, ChevronUp,ChevronRight, CheckCircle, AlertTriangle, Package, Clock, User, 
  Shield, FileText, Warehouse, Building2, Users, ClipboardList,ListOrdered, Check, X, Search, Info, Paperclip,Plus, Trash2, Pencil } from 'lucide-angular';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AssetService } from '@services/asset.service';
import { OrderService } from '@services/order.service';
import { FileUploadService } from '@services/file-upload.service';
import { FileEntityType } from '@models/file-upload.model';
import { OrderDto } from '@models/order.model';
import { AssetDto } from '@core/models/asset.model';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getFileSizeFromFile, removeFile, MAX_FILE_SIZE_MB, validateFile, showFileValidationErrors } from '@utils/file.utils';
import { TranslationService } from '@services/translation.service';
import { WeaponSupplyReviewService, BatchWithSelection, ReceiverInfo } from './services/weapon-supply-review.service';
import { WeaponSupplyLookupService } from './services/weapon-supply-lookup.service';
import { WeaponSupplyDisplayService } from './services/weapon-supply-display.service';

import { LoadingStateComponent } from '@components/loading-state/loading-state.component';
import { EmployeeFormModalComponent } from '@components/employee-form-modal/employee-form-modal.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';

@Component({
  selector: 'app-weapon-supply-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    LoadingStateComponent,
    EmployeeFormModalComponent,
    DropdownComponent
  ],
  providers: [
    WeaponSupplyReviewService,
    WeaponSupplyLookupService,
    WeaponSupplyDisplayService
  ],
  templateUrl: './weapon-supply-review.component.html',
  styleUrls: ['./weapon-supply-review.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponSupplyReviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly CheckCircle = CheckCircle;
  readonly AlertTriangle = AlertTriangle;
  readonly Package = Package;
  readonly Clock = Clock;
  readonly User = User;
  readonly Shield = Shield;
  readonly FileText = FileText;
  readonly Warehouse = Warehouse;
  readonly Building2 = Building2;
  readonly Users = Users;
  readonly ClipboardList = ClipboardList;
  readonly ListOrdered = ListOrdered;
  readonly Check = Check;
  readonly X = X;
  readonly Search = Search;
  readonly Info = Info;
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly Pencil = Pencil;
  readonly ChevronRight = ChevronRight;
  readonly Paperclip = Paperclip;

  // File upload
  selectedFiles: File[] = [];
  private fileInputElement: HTMLInputElement | null = null;
  getFileSize = getFileSizeFromFile;
  MAX_FILE_SIZE_MB = MAX_FILE_SIZE_MB;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon(): typeof ArrowRight | typeof ArrowLeft {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  orderId: number = 0;
  orderData: OrderDto | null = null;
  batches: BatchWithSelection[] = [];

  isRequestInfoExpanded = true;
  isRequestItemsExpanded = true;
  isBatchesExpanded = true;
  isReceiverInfoExpanded = true;

  loading = true;
  loadingBatches = false;
  submitting = false;

  receiverName = '';
  receiverMilitaryId = '';
  receiverRankId: number | undefined = undefined;
  location = '';
  expectedReturnDate = '';
  notes = '';

  isEmployeeModalOpen = false;

  addSerialBatchId: number | null = null;
  addSerialValue = '';

  editingSerialAssetId: number | null = null;
  editingSerialValue = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetService: AssetService,
    private orderService: OrderService,
    private translationService: TranslationService,
    private toastService: ToastService,
    public translate: TranslateService,
    private config: ConfigService,
    public reviewService: WeaponSupplyReviewService,
    public lookupService: WeaponSupplyLookupService,
    public displayService: WeaponSupplyDisplayService,
    private fileUploadService: FileUploadService,
    private cdr: ChangeDetectorRef
  ) {}

  get rankDropdownOptions(): DropdownOption<number>[] {
    return this.lookupService.rankDropdownOptions;
  }

  get employeeDropdownOptions(): DropdownOption<number>[] {
    return this.lookupService.employeeDropdownOptions;
  }

  get requestItems(): Array<{ itemId: number; itemName: string; itemNo?: string; nsn?: string; quantity: number }> {
    const items = this.orderData?.requestItems ?? [];
    const requested = this.reviewService.getRequestedItems();
    return items
      .filter(ri => ri.itemId != null)
      .map(ri => ({
        itemId: ri.itemId,
        itemName: requested.get(ri.itemId)?.itemName ?? ri.itemName ?? 'Unknown Item',
        itemNo: ri.itemNo,
        nsn: ri.nsn,
        quantity: ri.quantity
      }));
  }

  ngOnInit(): void {
    this.initializeRoute();
    this.loadAllData();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeRoute(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);
    if (isNaN(this.orderId)) {
      this.toastService.error(
        this.translate.instant('weaponSupplyReview.invalidOrderId'),
        this.translate.instant('toast.error')
      );
      this.router.navigate(['/requests-management']);
    }
  }

  private loadAllData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    forkJoin({
      order: this.orderService.getOrderById(this.orderId),
      employees: this.lookupService.loadEmployees(),
      ranks: this.lookupService.loadRanks()
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ order }) => {
          this.orderData = order;
          this.reviewService.initializeFromOrder(order);
          this.loading = false;
          this.cdr.markForCheck();
          this.loadBatches();
        },
        error: (error) => {
          this.handleError('Failed to load data', error, 'weaponSupplyReview.failedToLoadOrderDetails');
          this.loading = false;
          this.cdr.markForCheck();
          this.goBack();
        }
      });
  }

  private loadBatches(): void {
    this.loadingBatches = true;
    this.cdr.markForCheck();

    forkJoin({
      batches: this.reviewService.loadBatchesFromApi(this.orderId).pipe(catchError(() => of([]))),
      selections: this.reviewService.loadSelections(this.orderId).pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ batches, selections }) => {
          this.reviewService.applySelections(selections);
          this.reviewService.applyBatchData(batches);
          this.loadingBatches = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError('Failed to load batches', error, 'weaponSupplyReview.failedToLoadAssets');
          this.loadingBatches = false;
          this.cdr.markForCheck();
        }
      });
  }

  private setupSubscriptions(): void {
    this.reviewService.batches$
      .pipe(takeUntil(this.destroy$))
      .subscribe(batches => {
        this.batches = batches;
        this.cdr.markForCheck();
      });

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.lookupService.refreshDepotOptionsOnLangChange();
      this.cdr.markForCheck();
    });
  }

  // ==================== BATCH ACCORDION ====================

  toggleBatch(batchId: number): void {
    this.reviewService.toggleBatchExpanded(batchId);
  }

  // ==================== ASSET MANAGEMENT ====================

  removeAsset(batchId: number, assetId: number): void {
    this.reviewService.removeAsset(batchId, assetId);
  }

  openAddSerial(batchId: number): void {
    this.addSerialBatchId = batchId;
    this.addSerialValue = '';
    this.cdr.markForCheck();
  }

  cancelAddSerial(): void {
    this.addSerialBatchId = null;
    this.addSerialValue = '';
    this.cdr.markForCheck();
  }

  confirmAddSerial(batchId: number): void {
    const serial = this.addSerialValue.trim();
    if (!serial) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.enterSerialNumber'),
        this.translate.instant('toast.warning')
      );
      return;
    }

    const batch = this.batches.find(b => b.id === batchId);
    if (batch) {
      const existing = batch.assets.find(a => a.serialNumber?.toLowerCase() === serial.toLowerCase());
      if (existing) {
        this.toastService.warning(
          this.translate.instant('weaponSupplyReview.assetAlreadyInBatch')
        );
        this.cancelAddSerial();
        return;
      }
    }

    this.reviewService.searchAssetBySerial(serial)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.toastService.error(this.translate.instant('weaponSupplyReview.assetNotFound'));
          return of(null);
        })
      )
      .subscribe(asset => {
        if (!asset) {
          this.toastService.error(this.translate.instant('weaponSupplyReview.assetNotFound'));
          return;
        }

        // eslint-disable-next-line eqeqeq
        if (asset.batchId != batchId) {
          this.toastService.warning(
            this.translate.instant('weaponSupplyReview.assetNotInBatch')
          );
          return;
        }

        const alreadyInAnyBatch = this.batches.some(b =>
          b.assets.some(a => a.id === asset.id)
        );
        if (alreadyInAnyBatch) {
          this.toastService.warning(
            this.translate.instant('weaponSupplyReview.assetAlreadyInBatch')
          );
          return;
        }

        this.reviewService.addAssetToBatch(batchId, asset);
        this.cancelAddSerial();
        this.cdr.markForCheck();
      });
  }

  onCustodianChange(batchId: number, assetId: number, custodianId: number): void {
    this.reviewService.setCustodian(batchId, assetId, custodianId || undefined);
  }

  onNotesChange(batchId: number, assetId: number, notes: string): void {
    this.reviewService.setNotes(batchId, assetId, notes);
  }

  // ==================== SERIAL NUMBER EDITING ====================

  startEditingSerial(asset: AssetDto): void {
    this.editingSerialAssetId = asset.id;
    this.editingSerialValue = asset.serialNumber ?? '';
  }

  cancelEditingSerial(): void {
    this.editingSerialAssetId = null;
    this.editingSerialValue = '';
  }

  saveSerial(asset: AssetDto): void {
    const value = this.editingSerialValue.trim() || null;
    this.assetService.updateSerialNumber(asset.id, value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          asset.serialNumber = value ?? undefined;
          this.editingSerialAssetId = null;
          this.editingSerialValue = '';
          this.toastService.success(
            this.translate.instant('weaponSupplyReview.serialNumberUpdated'),
            this.translate.instant('toast.success')
          );
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError('Failed to update serial number', error, 'weaponSupplyReview.failedToUpdateSerialNumber');
        }
      });
  }
 // ==================== FILE UPLOAD ====================

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      const invalidFiles: string[] = [];
      const validFiles: File[] = [];

      newFiles.forEach(file => {
        const validation = validateFile(file);
        if (!validation.isValid) {
          invalidFiles.push(validation.errorMessage);
        } else {
          validFiles.push(file);
        }
      });

      if (invalidFiles.length > 0) {
        showFileValidationErrors(this.translate, this.toastService, invalidFiles, 'weaponSupplyReview');
      }

      validFiles.forEach(newFile => {
        const isDuplicate = this.selectedFiles.some(
          existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size
        );
        if (!isDuplicate) {
          this.selectedFiles.push(newFile);
        }
      });

      this.fileInputElement = input;
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  removeFile(index: number): void {
    removeFile(this.selectedFiles, index, this.fileInputElement);
    this.cdr.markForCheck();
  }

  // ==================== SUBMISSION ====================

  canSubmit(): boolean {
    if (this.selectedFiles.length === 0) {
      return false;
    }
    return this.reviewService.canSubmit(this.receiverName, this.receiverMilitaryId, this.receiverRankId);
  }

  onSubmit(): void {
    const quantityErrors = this.reviewService.validateQuantities();
    if (quantityErrors) {
      quantityErrors.forEach(msg =>
        this.toastService.error(msg, this.translate.instant('toast.error'))
      );
      return;
    }

    if (!this.canSubmit()) {
      this.toastService.warning(
        this.translate.instant('weaponSupplyReview.cannotSubmit'),
        this.translate.instant('toast.warning')
      );
      return;
    }

    const receiverInfo: ReceiverInfo = {
      receiverName: this.receiverName,
      receiverMilitaryId: this.receiverMilitaryId,
      receiverRankId: this.receiverRankId!,
      location: this.location || undefined,
      expectedReturnDate: this.expectedReturnDate || undefined,
      notes: this.notes || undefined
    };

    const dto = this.reviewService.createSupplyDto(this.orderId, receiverInfo);

    this.submitting = true;
    this.cdr.markForCheck();

    this.reviewService.submitSupply(dto)
      .pipe(
        takeUntil(this.destroy$),
        switchMap((supplyId: number) => {
          // Upload files linked to the created asset supply
          if (this.selectedFiles.length > 0 && supplyId) {
            return this.fileUploadService.uploadFilesForEntity(
              this.selectedFiles,
              FileEntityType.AssetSupply,
              supplyId
            ).pipe(
              catchError((error) => {
                this.config.logError('Failed to upload files for asset supply', error);
                this.toastService.warning(
                  this.translate.instant('weaponSupplyReview.fileUploadFailed'),
                  this.translate.instant('toast.warning')
                );
                // Don't fail the whole submission if file upload fails
                return of([]);
              })
            );
          }
          return of([]);
        }),
        catchError((error) => {
          this.handleError('Failed to submit asset supply', error, 'weaponSupplyReview.failedToSubmit');
          this.submitting = false;
          this.cdr.markForCheck();
          return [];
        })
      )
      .subscribe({
        next: () => {
          this.submitting = false;
          this.selectedFiles = [];
          this.cdr.markForCheck();
          this.toastService.success(
            this.translate.instant('weaponSupplyReview.submitSuccess'),
            this.translate.instant('toast.success')
          );
          setTimeout(() => {
            this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
          }, 1500);
        }
      });
  }

  // ==================== NAVIGATION ====================

  goBack(): void {
    if (this.orderId) {
      this.router.navigate(['/requests-management', this.orderId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }

  goToSelectionPage(): void {
    this.router.navigate(['/requests-management', this.orderId, 'weapon-supply-selection']);
  }

  openAddEmployeeModal(): void {
    this.isEmployeeModalOpen = true;
    this.cdr.markForCheck();
  }

  onEmployeeModalClosed(): void {
    this.isEmployeeModalOpen = false;
    this.cdr.markForCheck();
  }

  onEmployeeSaved(): void {
    this.lookupService.loadEmployees().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isEmployeeModalOpen = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ==================== DISPLAY HELPERS ====================

  getDepotName(batch: BatchWithSelection): string {
    if (!batch.depot) return '—';
    const lang = this.displayService.getCurrentLang();
    return lang === 'ar'
      ? (batch.depot.nameAr || batch.depot.nameEn || '—')
      : (batch.depot.nameEn || batch.depot.nameAr || '—');
  }

  getAssetDepotName(asset: AssetDto): string {
    if (!asset.depot) return '—';
    const lang = this.displayService.getCurrentLang();
    return lang === 'ar'
      ? (asset.depot.nameAr || asset.depot.nameEn || '—')
      : (asset.depot.nameEn || asset.depot.nameAr || '—');
  }

  getItemName(asset: AssetDto): string {
    if (asset.item?.name) {
      return asset.item.name;
    }
    const requested = this.reviewService.getRequestedItems().get(asset.itemId);
    return requested?.itemName ?? `Item ${asset.itemId}`;
  }

  formatNumber(num: number): string {
    return this.displayService.formatNumber(num);
  }

  formatDate(date: Date | string | undefined): string {
    return this.displayService.formatDate(date);
  }

  getDepartmentName(): string {
    return this.displayService.getDepartmentName(this.orderData);
  }

  getRequesterName(): string {
    return this.displayService.getRequesterName(this.orderData);
  }

  getCustodianId(batch: BatchWithSelection, assetId: number): number | undefined {
    return batch.custodianMap.get(assetId);
  }

  getNotes(batch: BatchWithSelection, assetId: number): string {
    return batch.notesMap.get(assetId) ?? '';
  }

  trackByBatchId(_index: number, batch: BatchWithSelection): number {
    return batch.id;
  }

  trackByAssetId(_index: number, asset: AssetDto): number {
    return asset.id;
  }

  // ==================== ERROR HANDLING ====================

  private handleError(logMessage: string, error: unknown, translationKey: string): void {
    this.config.logError(logMessage, error);
    const errorMessage = ErrorHandler.extractErrorMessage(error, this.translate.instant(translationKey));
    this.toastService.error(errorMessage, this.translate.instant('toast.error'));
  }
}

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Warehouse, Edit3 } from 'lucide-angular';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { RequestDetail } from '@models/workflow-approval.model';
import { DepotDto } from '@models/depot.model';
import { LookupService } from '@services/lookup.service';
import { ReturnService } from '@requests/services/return.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { WorkflowApprovalPermissionsService } from '../../services/workflow-approval-permissions.service';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { hasPendingStep } from '../../utils/workflow-approval-helpers';

@Component({
  selector: 'app-workflow-return-depot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent
  ],
  templateUrl: './workflow-return-depot.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowReturnDepotComponent implements OnInit, OnChanges {
  readonly Warehouse = Warehouse;
  readonly Edit3 = Edit3;

  @Input() requestId!: number;
  @Input() requestDetail: RequestDetail | null = null;
  @Input() destroy$!: Subject<void>;

  @Output() depotSet = new EventEmitter<void>();

  depots: DepotDto[] = [];
  selectedDepotId: number | null = null;
  processing = false;
  loadingDepots = false;
  isEditMode = false;

  get isAlreadySet(): boolean {
    return !!this.requestDetail?.returnToDepotId;
  }

  get canShow(): boolean {
    if (!this.requestDetail || this.requestDetail.requestType !== 'Return') return false;
    if (this.stateService.canSetReturnDepot()) return true;
    return this.isAlreadySet;
  }

  get isApproved(): boolean {
    return !hasPendingStep(this.requestDetail);
  }

  get canEdit(): boolean {
    return !this.isApproved && this.stateService.canSetReturnDepot();
  }

  /**
   * Update / first-time set — hidden after current user approved, rejected, or returned for review
   * (unless they are the active approver again), same as pickup date confirm.
   */
  get canChangeReturnDepot(): boolean {
    if (!this.requestDetail) return false;
    if (!this.canEdit) return false;
    return this.permissionsService.canUpdateReturnWorkflowFields(this.requestDetail);
  }

  get depotDisplayName(): string {
    if (!this.requestDetail?.returnToDepotId) return '';
    const lang = getCurrentLang(this.translateService);
    if (lang === 'ar' && this.requestDetail.returnToDepotNameAr) {
      return this.requestDetail.returnToDepotNameAr;
    }
    if (this.requestDetail.returnToDepotNameEn) {
      return this.requestDetail.returnToDepotNameEn;
    }
    const depot = this.depots.find(d => d.id === this.requestDetail?.returnToDepotId);
    return depot ? (getLocalizedName(depot, lang) || `Depot ${depot.id}`) : '';
  }

  depotLabelFn = (option: any): string => {
    if (!option) return '';
    const depot = option?.value ?? option;
    return getLocalizedName(depot, getCurrentLang(this.translateService)) || depot?.code || '';
  };

  constructor(
    private lookupService: LookupService,
    private returnService: ReturnService,
    private stateService: WorkflowApprovalStateService,
    private permissionsService: WorkflowApprovalPermissionsService,
    private translateService: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDepots();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestDetail'] && this.requestDetail) {
      if (this.requestDetail.returnToDepotId) {
        this.selectedDepotId = this.requestDetail.returnToDepotId;
      }
      if (!this.canChangeReturnDepot) {
        this.isEditMode = false;
      }
    }
  }

  private loadDepots(): void {
    this.loadingDepots = true;
    this.lookupService.getDepotList()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (depots) => {
          this.depots = depots || [];
          this.loadingDepots = false;
          if (this.requestDetail?.returnToDepotId) {
            this.selectedDepotId = this.requestDetail.returnToDepotId;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.depots = [];
          this.loadingDepots = false;
          this.cdr.markForCheck();
        }
      });
  }

  enableEdit(): void {
    if (!this.canChangeReturnDepot) return;
    this.isEditMode = true;
    this.cdr.markForCheck();
  }

  setDepot(): void {
    if (this.processing || !this.selectedDepotId) return;

    this.processing = true;
    this.returnService.setDepot(this.requestId, this.selectedDepotId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.processing = false;
          this.isEditMode = false;
          this.depotSet.emit();
          this.translateService.get(['toast.success', 'workflowApprovalDetail.success.returnDepotSet'])
            .pipe(takeUntil(this.destroy$))
            .subscribe(t => {
              this.toastService.success(
                t['workflowApprovalDetail.success.returnDepotSet'] || 'Return depot set successfully',
                t['toast.success'] || 'Success'
              );
            });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.processing = false;
          const msg = ErrorHandler.extractErrorMessage(error, 'Failed to set return depot');
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

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { LucideAngularModule, Clock, CheckCircle } from 'lucide-angular';
import { RequestDetail } from '@models/workflow-approval.model';
import { WorkflowApprovalSupplyService } from '../../services/workflow-approval-supply.service';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-workflow-pickup-date',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './workflow-pickup-date.component.html',
  styleUrls: ['./workflow-pickup-date.component.css']
})
export class WorkflowPickupDateComponent implements OnChanges, OnDestroy {
  readonly Clock = Clock;
  readonly CheckCircle = CheckCircle;

  @Input() requestId!: number;
  @Input() requestDetail: RequestDetail | null = null;
  @Input() pickupDate: string = '';
  @Input() destroy$!: Subject<void>;

  @Output() pickupDateChange = new EventEmitter<string>();
  @Output() pickupDateSet = new EventEmitter<void>();
  @Output() pickupDateConfirmed = new EventEmitter<void>();
  @Output() pickupDateChanged = new EventEmitter<void>(); // Emit when data needs to be reloaded

  // Local state
  localPickupDate: string = '';
  pickupDateProcessing: boolean = false;
  confirmPickupDateProcessing: boolean = false;

  // State from service
  get isPickupDateAlreadySet(): boolean {
    return this.stateService.getState().isPickupDateAlreadySet;
  }

  get isWeaponOrder(): boolean {
    return this.stateService.getState().isWeaponOrder;
  }

  canSet(): boolean {
    return this.stateService.canSetSupplyPickupDate();
  }

  canConfirm(): boolean {
    return this.stateService.canConfirmSupplyPickupDate();
  }

  isPickupDateEditable(): boolean {
    return this.stateService.isPickupDateEditable();
  }

  hasPendingStep(): boolean {
    return this.stateService.hasPendingStep();
  }

  constructor(
    private supplyServiceHelper: WorkflowApprovalSupplyService,
    private stateService: WorkflowApprovalStateService,
    private translateService: TranslateService,
    private toastService: ToastService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Sync local pickupDate when parent updates it
    if (changes['pickupDate'] && changes['pickupDate'].currentValue !== this.localPickupDate) {
      this.localPickupDate = changes['pickupDate'].currentValue || '';
    }
  }

  ngOnDestroy(): void {
    // Component cleanup if needed
  }

  /**
   * Update pickup date and emit to parent
   */
  onPickupDateChange(value: string): void {
    this.localPickupDate = value;
    this.pickupDateChange.emit(value);
  }

  /**
   * Set supply pickup date
   */
  setSupplyPickupDate(): void {
    if (this.pickupDateProcessing || !this.requestDetail || !this.localPickupDate) {
      if (!this.localPickupDate) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.selectPickupDate']).subscribe(translations => {
          this.toastService.error(
            translations['workflowApprovalDetail.errors.selectPickupDate'] || 'Please select a pickup date',
            translations['toast.error']
          );
        });
      }
      return;
    }

    // Prevent changes if date already set
    if (this.isPickupDateAlreadySet) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.pickupDateAlreadySet']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.pickupDateAlreadySet'] || 'Pickup date has already been set and cannot be modified',
          translations['toast.error']
        );
      });
      return;
    }

    this.pickupDateProcessing = true;

    this.supplyServiceHelper.setSupplyPickupDate({
      requestId: this.requestId,
      pickupDate: this.localPickupDate,
      isWeaponOrder: this.isWeaponOrder
    }, this.destroy$)
      .subscribe({
        next: () => {
          this.pickupDateProcessing = false;
          this.pickupDateSet.emit();
          this.pickupDateChanged.emit();
        },
        error: () => {
          this.pickupDateProcessing = false;
        }
      });
  }

  /**
   * Confirm supply pickup date
   */
  confirmSupplyPickupDate(): void {
    if (this.confirmPickupDateProcessing || !this.requestDetail || !this.localPickupDate) {
      if (!this.localPickupDate) {
        this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.selectPickupDate']).subscribe(translations => {
          this.toastService.error(
            translations['workflowApprovalDetail.errors.selectPickupDate'] || 'Please select a pickup date',
            translations['toast.error']
          );
        });
      }
      return;
    }

    this.confirmPickupDateProcessing = true;

    this.supplyServiceHelper.confirmSupplyPickupDate({
      requestId: this.requestId,
      pickupDate: this.localPickupDate,
      isWeaponOrder: this.isWeaponOrder
    }, this.destroy$)
      .subscribe({
        next: () => {
          this.confirmPickupDateProcessing = false;
          this.pickupDateConfirmed.emit();
          this.pickupDateChanged.emit();
        },
        error: () => {
          this.confirmPickupDateProcessing = false;
        }
      });
  }
}

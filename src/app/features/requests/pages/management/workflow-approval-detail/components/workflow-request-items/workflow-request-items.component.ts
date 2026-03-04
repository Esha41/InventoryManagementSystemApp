import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package, History as HistoryIcon } from 'lucide-angular';
import { RequestDetail } from '@models/workflow-approval.model';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { WorkflowApprovalNavigationService } from '../../services/workflow-approval-navigation.service';

@Component({
  selector: 'app-workflow-request-items',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule
  ],
  templateUrl: './workflow-request-items.component.html',
  styleUrls: ['./workflow-request-items.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowRequestItemsComponent {
  readonly Package = Package;
  readonly HistoryIcon = HistoryIcon;

  @Input() requestDetail: RequestDetail | null = null;
  @Output() reviewClick = new EventEmitter<void>();
  @Output() historyClick = new EventEmitter<any>();

  constructor(
    private stateService: WorkflowApprovalStateService,
    private navigationService: WorkflowApprovalNavigationService
  ) { }

  onHistoryClick(event: MouseEvent, item: any): void {
    event.stopPropagation();
    this.historyClick.emit(item);
  }


  // Helper getter for safe access to requestItems
  get requestItems() {
    return this.requestDetail?.requestItems || [];
  }

  get hasItems(): boolean {
    return this.requestItems.length > 0;
  }

  // Permission check methods using state service
  canReviewWeaponSupply(): boolean {
    return this.stateService.canReviewWeaponSupply();
  }

  canReviewSupply(): boolean {
    return this.stateService.canReviewSupply();
  }

  canUpdateRequestAndSupply(): boolean {
    return this.stateService.canUpdateRequestAndSupply();
  }

  hasPendingStep(): boolean {
    return this.stateService.hasPendingStep();
  }

  isWeaponOrder(): boolean {
    const state = this.stateService.getState();
    return state.isWeaponOrder || false;
  }

  getReviewButtonText(): string {
    return this.isWeaponOrder()
      ? 'workflowApprovalDetail.reviewItems'
      : 'workflowApprovalDetail.review';
  }

  // Navigation methods
  navigateToWeaponSupplyReview(): void {
    const state = this.stateService.getState();
    if (state.requestId) {
      this.navigationService.navigateToWeaponSupplyReview(state.requestId, state.isWeaponOrder);
    }
  }

  navigateToSupplyReview(): void {
    const state = this.stateService.getState();
    // For weapon orders, open modal instead of navigating
    if (state.isWeaponOrder) {
      this.reviewClick.emit();
    } else {
      // For non-weapon orders, navigate as before
      if (state.requestId) {
        this.navigationService.navigateToSupplyReview(state.requestId, state.isWeaponOrder);
      }
    }
  }

  navigateToSupplyOrder(): void {
    const state = this.stateService.getState();
    if (state.requestId) {
      this.navigationService.navigateToSupplyOrder(state.requestId);
    }
  }

  navigateToItemDetails(itemId: number | undefined): void {
    if (!itemId || itemId <= 0) {
      return;
    }
    const state = this.stateService.getState();
    if (state.requestId) {
      // Try to get itemType from the request item
      const item = this.requestItems.find(i => (i.itemId || i.id) === itemId);
      const itemType = item && 'itemType' in item ? (item as any).itemType : undefined;
      this.navigationService.navigateToItemDetails(itemId, state.requestId, itemType);
    }
  }
}

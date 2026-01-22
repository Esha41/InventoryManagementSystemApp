import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package } from 'lucide-angular';
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
  styleUrls: ['./workflow-request-items.component.css']
})
export class WorkflowRequestItemsComponent {
  readonly Package = Package;

  @Input() requestDetail: RequestDetail | null = null;

  constructor(
    private stateService: WorkflowApprovalStateService,
    private navigationService: WorkflowApprovalNavigationService
  ) {}

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

  // Navigation methods
  navigateToWeaponSupplyReview(): void {
    const state = this.stateService.getState();
    if (state.requestId) {
      this.navigationService.navigateToWeaponSupplyReview(state.requestId, state.isWeaponOrder);
    }
  }

  navigateToSupplyReview(): void {
    const state = this.stateService.getState();
    if (state.requestId) {
      this.navigationService.navigateToSupplyReview(state.requestId, state.isWeaponOrder);
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
      this.navigationService.navigateToItemDetails(itemId, state.requestId);
    }
  }
}

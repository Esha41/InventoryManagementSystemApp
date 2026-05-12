import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Package, History as HistoryIcon } from 'lucide-angular';
import { RequestDetail, RequestItem } from '@models/workflow-approval.model';
import { WorkflowApprovalStateService } from '../../services/workflow-approval-state.service';
import { WorkflowApprovalNavigationService } from '../../services/workflow-approval-navigation.service';
import { TableClampTooltipDirective } from '@components/table-clamp-tooltip/table-clamp-tooltip.directive';
import { WeaponAssociationListComponent } from '@components/weapon-association-list/weapon-association-list.component';
import { hasWeaponAssociations as itemHasWeaponAssociations } from '@utils/weapon-association-label.utils';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';
import { ItemType } from '@models/inventory.model';

@Component({
  selector: 'app-workflow-request-items',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    TableClampTooltipDirective,
    WeaponAssociationListComponent
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
  @Output() historyClick = new EventEmitter<RequestItem>();

  constructor(
    private stateService: WorkflowApprovalStateService,
    private navigationService: WorkflowApprovalNavigationService
  ) { }

  onHistoryClick(event: MouseEvent, item: RequestItem): void {
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

  hasWeaponAssociations(item: RequestItem): boolean {
    return itemHasWeaponAssociations(item);
  }

  /** Order item tracking history applies only to issue orders, not returns/discards. */
  get showViewHistory(): boolean {
    return this.requestDetail?.requestType === 'Order';
  }

  // Permission check methods using state service
  canReviewWeaponSupply(): boolean {
    return this.stateService.canReviewWeaponSupply();
  }

  canSelectDepots(): boolean {
    return this.stateService.canSelectDepots();
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
  navigateToSelectDepo(): void {
    const state = this.stateService.getState();
    if (state.requestId) {
      this.navigationService.navigateToWeaponSupplySelection(state.requestId, state.isWeaponOrder);
    }
  }

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

  navigateToItemDetails(itemId: number | undefined, itemType?: number | string): void {
    if (!itemId || itemId <= 0) {
      return;
    }

    const state = this.stateService.getState();
    if (!state.requestId) {
      return;
    }

    const resolvedItemType = itemType ?? this.requestItems.find(
      item => (item.itemId ?? item.id) === itemId
    )?.itemType;

    this.navigationService.navigateToItemDetails(itemId, state.requestId, resolvedItemType);
  }

  onItemNameClick(event: MouseEvent, item: RequestItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.navigateToItemDetails(item.itemId ?? item.id, item.itemType);
  }

  onCatalogWeaponAssociationClick(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): void {
    this.navigateToItemDetails(association.associatedWeaponItemId ?? undefined, ItemType.Weapon);
  }
}

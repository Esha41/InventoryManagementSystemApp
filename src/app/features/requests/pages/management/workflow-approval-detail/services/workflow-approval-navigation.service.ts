import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class WorkflowApprovalNavigationService {
  constructor(
    private router: Router,
    private translateService: TranslateService,
    private toastService: ToastService
  ) {}

  /**
   * Navigate back to requests management page
   */
  goBack(): void {
    this.router.navigate(['/requests-management']);
  }

  /**
   * Navigate to supply review page
   */
  navigateToSupplyReview(requestId: number, isWeaponOrder: boolean): void {
    if (!requestId) {
      return;
    }

    if (isWeaponOrder) {
      this.router.navigate(['/requests-management', requestId, 'weapon-supply-review']);
    } else {
      this.router.navigate(['/requests-management', requestId, 'supply-request-detail']);
    }
  }

  /**
   * Navigate to supply order page
   */
  navigateToSupplyOrder(requestId: number): void {
    if (!requestId) {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.invalidRequestData']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.invalidRequestData'] || 'Invalid request data',
          translations['toast.error']
        );
      });
      return;
    }

    // Navigate with query param to indicate this is an orderId, not a supplyId
    this.router.navigate(['/supply-order', requestId], { queryParams: { byOrder: true } });
  }

  /**
   * Navigate directly to weapon supply review page
   * This is separate from the general Review button
   */
  navigateToWeaponSupplyReview(requestId: number, isWeaponOrder: boolean): void {
    if (!requestId) {
      return;
    }

    if (isWeaponOrder) {
      this.router.navigate(['/requests-management', requestId, 'weapon-supply-review']);
    } else {
      this.translateService.get(['toast.error', 'workflowApprovalDetail.errors.notWeaponOrder']).subscribe(translations => {
        this.toastService.error(
          translations['workflowApprovalDetail.errors.notWeaponOrder'] || 'This order does not contain weapon items',
          translations['toast.error']
        );
      });
    }
  }

  /**
   * Navigate to item detail page to view item details (same view as new issue request)
   */
  navigateToItemDetails(itemId: number, requestId: number, itemType?: number | string): void {
    if (itemId && itemId > 0) {
      const queryParams: any = { requestId: requestId };
      
      // Convert itemType to tab query param if available
      if (itemType !== undefined && itemType !== null) {
        let tabValue: string | undefined;
        if (typeof itemType === 'number') {
          if (itemType === 1) tabValue = 'ammunition';
          else if (itemType === 2) tabValue = 'weapon';
          else if (itemType === 3) tabValue = 'explosive';
        } else if (typeof itemType === 'string') {
          const normalizedType = itemType.toLowerCase();
          if (normalizedType === 'ammunition' || normalizedType === '1') {
            tabValue = 'ammunition';
          } else if (normalizedType === 'weapon' || normalizedType === '2') {
            tabValue = 'weapon';
          } else if (normalizedType === 'explosive' || normalizedType === '3') {
            tabValue = 'explosive';
          }
        }
        if (tabValue) {
          queryParams.tab = tabValue;
        }
      }
      
      // Pass requestId and tab (itemType) as query parameters
      this.router.navigate(['/item-detail', itemId], {
        queryParams: queryParams
      });
    }
  }
}

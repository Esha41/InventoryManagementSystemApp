import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '@services/toast.service';
import { take } from 'rxjs/operators';

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
    this.router.navigate(['/requests/requests-management']);
  }

  /**
   * Navigate to supply review page
   */
  navigateToSupplyReview(requestId: number, isWeaponOrder: boolean): void {
    if (!requestId) {
      return;
    }

    if (isWeaponOrder) {
      this.router.navigate(['/requests/requests-management', requestId, 'weapon-supply-selection']);
    } else {
      this.router.navigate(['/requests/requests-management', requestId, 'supply-request-detail']);
    }
  }

  /**
   * Navigate to supply order page
   */
  navigateToSupplyOrder(requestId: number): void {
    if (!requestId) {
      this.showErrorToastKeys(
        'workflowApprovalDetail.errors.invalidRequestData',
        'toast.error',
        'Invalid request data'
      );
      return;
    }

    // Navigate with query param to indicate this is an orderId, not a supplyId
    this.router.navigate(['/requests/supply-order', requestId], { queryParams: { byOrder: true } });
  }

  /**
   * Navigate to weapon supply selection (depot + batch selection)
   */
  navigateToWeaponSupplySelection(requestId: number, isWeaponOrder: boolean): void {
    if (!requestId) {
      return;
    }

    if (isWeaponOrder) {
      this.router.navigate(['/requests/requests-management', requestId, 'weapon-supply-selection']);
    } else {
      this.showErrorToastKeys(
        'workflowApprovalDetail.errors.notWeaponOrder',
        'toast.error',
        'This order does not contain weapon items'
      );
    }
  }

  /**
   * Navigate directly to weapon supply review page (asset selection, receiver info, submit)
   */
  navigateToWeaponSupplyReview(requestId: number, isWeaponOrder: boolean): void {
    if (!requestId) {
      return;
    }

    if (isWeaponOrder) {
      this.router.navigate(['/requests/requests-management', requestId, 'weapon-supply-review']);
    } else {
      this.showErrorToastKeys(
        'workflowApprovalDetail.errors.notWeaponOrder',
        'toast.error',
        'This order does not contain weapon items'
      );
    }
  }

  /**
   * Navigate to process return items page
   */
  navigateToProcessReturnItems(requestId: number): void {
    if (!requestId) return;
    this.router.navigate(['/requests/requests-management', requestId, 'process-return-items']);
  }

  /**
   * Navigate to item detail page to view item details (same view as new issue request)
   */
  navigateToItemDetails(itemId: number, requestId: number, itemType?: number | string): void {
    if (itemId && itemId > 0) {
      const queryParams: Record<string, string | number> = { requestId };
      
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
          queryParams['tab'] = tabValue;
        }
      }
      
      // Pass requestId and tab (itemType) as query parameters
      this.router.navigate(['/assets/asset-list', itemId], {
        queryParams: queryParams
      });
    }
  }

  private showErrorToastKeys(bodyKey: string, titleKey: string, fallbackBody: string): void {
    this.translateService
      .get([titleKey, bodyKey])
      .pipe(take(1))
      .subscribe(translations => {
        this.toastService.error(translations[bodyKey] || fallbackBody, translations[titleKey]);
      });
  }
}

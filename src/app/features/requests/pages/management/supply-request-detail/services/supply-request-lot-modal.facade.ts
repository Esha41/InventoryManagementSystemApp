import { Injectable } from '@angular/core';
import { Observable, EMPTY, of } from 'rxjs';
import { map, tap, mergeMap, catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { LotDetailDto } from '@inventory/services/inventory.service';
import { mapLotDetailsToLotItems } from '@utils/lot.utils';
import type { OrderItem } from '@models/supply-request.model';
import { ConfigService } from '@services/config.service';
import { ToastService } from '@services/toast.service';
import { SupplyRequestDetailService } from './supply-request-detail.service';
import { LotSelectionService } from './lot-selection.service';

@Injectable({ providedIn: 'root' })
export class SupplyRequestLotModalFacade {
  constructor(
    private readonly detailService: SupplyRequestDetailService,
    private readonly lotSelectionService: LotSelectionService,
    private readonly translate: TranslateService,
    private readonly toastService: ToastService,
    private readonly config: ConfigService
  ) {}

  loadAvailableLotsForQuantityIntoItem(
    item: OrderItem,
    tempSelections: Map<string, number>,
    excludeSupplyId?: number
  ): Observable<void> {
    const selectionsCopy = new Map(tempSelections);
    return this.detailService.loadAvailableLotsForQuantity(item.itemId, item.approvedQuantity, excludeSupplyId).pipe(
      map((lots: LotDetailDto[]) => mapLotDetailsToLotItems(lots, selectionsCopy)),
      tap((mapped) => {
        item.availableLots = mapped;
        if (mapped.length > 0) {
          const message = this.translate.instant('supplyRequestDetail.loadedAvailableLots', {
            count: mapped.length,
            quantity: item.approvedQuantity
          });
          this.toastService.success(message, this.translate.instant('toast.success'));
        } else {
          const message = this.translate.instant('supplyRequestDetail.noAvailableLotsFound');
          this.toastService.warning(message, this.translate.instant('toast.warning'));
        }
      }),
      map(() => undefined),
      catchError((error) => {
        this.config.logError('Failed to load available lots', error);
        const message = this.translate.instant('supplyRequestDetail.failedToLoadAvailableLots');
        this.toastService.error(message, this.translate.instant('toast.error'));
        return EMPTY;
      })
    );
  }

  loadAllLotsIntoItem(item: OrderItem, tempSelections: Map<string, number>): Observable<void> {
    const selectionsCopy = new Map(tempSelections);
    return this.detailService.loadAllLotsForItem(item.itemId).pipe(
      map((lots: LotDetailDto[]) => mapLotDetailsToLotItems(lots, selectionsCopy, true)),
      tap((mapped) => {
        item.availableLots = mapped;
        if (mapped.length > 0) {
          const message = this.translate.instant('supplyRequestDetail.loadedAllLots', {
            count: mapped.length
          });
          this.toastService.success(message, this.translate.instant('toast.success'));
        } else {
          const message = this.translate.instant('supplyRequestDetail.noLotsFound');
          this.toastService.warning(message, this.translate.instant('toast.warning'));
        }
      }),
      map(() => undefined),
      catchError((error) => {
        this.config.logError('Failed to load lots', error);
        const message = this.translate.instant('supplyRequestDetail.failedToLoadLots');
        this.toastService.error(message, this.translate.instant('toast.error'));
        return EMPTY;
      })
    );
  }

  lookupManualLotByNumber(rawLotNumber: string, item: OrderItem): Observable<void> {
    const validation = this.lotSelectionService.validateLotNumber(rawLotNumber);
    if (!validation.isValid || !validation.parsedLot) {
      const title = validation.error?.includes('invalid')
        ? this.translate.instant('toast.error')
        : this.translate.instant('toast.warning');
      this.toastService.warning(validation.error!, title);
      return EMPTY;
    }

    return this.lotSelectionService.getLotByNumberAndValidate(validation.parsedLot, item).pipe(
      mergeMap(({ lot, isValid, error }) => {
        if (!isValid) {
          const title = error?.includes('different')
            ? this.translate.instant('toast.error')
            : this.translate.instant('toast.warning');
          this.toastService.warning(error!, title);
          return EMPTY;
        }
        const newLot = this.lotSelectionService.convertLotDetailToLotItem(lot);
        this.lotSelectionService.addLotToItem(item, newLot);
        const message = this.translate.instant('supplyRequestDetail.lotAddedSuccessfully', {
          lotNumber: validation.parsedLot
        });
        this.toastService.success(message, this.translate.instant('toast.success'));
        return of(undefined);
      }),
      catchError((error) => {
        this.config.logError('Failed to load lot details', error);
        const message = this.translate.instant('supplyRequestDetail.lotNotFoundOrError');
        this.toastService.error(message, this.translate.instant('toast.error'));
        return EMPTY;
      })
    );
  }
}

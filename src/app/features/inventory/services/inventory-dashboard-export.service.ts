import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs/operators';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ExcelColumn, ExcelService } from '@services/excel.service';
import { ToastService } from '@services/toast.service';
import { ItemInventorySummaryDto, ItemType } from '@models/inventory.model';
import { localizedItemSummaryDisplayName } from '@inventory/pages/overview/inventory-dashboard.helpers';
import { getCurrentLang } from '@utils/localization.utils';

export interface InventoryDashboardExportContext {
  depotLabel: string;
  activeTab: 'ammunition' | 'explosive' | 'weapon';
  filters: {
    searchText?: string;
    caliberText?: string;
    selectedItemCount?: number;
  };
  totals: {
    itemCount: number;
    totalQuantity: number;
    usedQuantity?: number;
    reservedQuantity?: number;
    remainingQuantity?: number;
    totalLots?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class InventoryDashboardExportService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly translate: TranslateService,
    private readonly toastService: ToastService
  ) {}

  exportItemSummariesToExcel(items: ItemInventorySummaryDto[], context: InventoryDashboardExportContext): void {
    if (!items?.length) {
      this.showWarningToast('common.noData');
      return;
    }

    try {
      const fileName = this.buildFileName(context.depotLabel, context.activeTab);
      const sheetName = this.translate.instant('inventoryDashboard.itemSummary.title') || 'Inventory Summary';

      const itemColumns = this.buildItemColumns(context.activeTab);
      const exportRows = items.map(i => this.mapItemRow(i, context.depotLabel));
      exportRows.push(this.buildTotalsRow(context));

      // Match existing export services style (single-sheet exportToExcel).
      this.excelService.exportToExcel({
        fileName,
        sheetName,
        columns: itemColumns,
        data: exportRows,
        includeTimestamp: true
      });

      this.showSuccessToast();
    } catch (_err: unknown) {
      this.showErrorToast(_err, 'Export failed');
    }
  }

  private showSuccessToast(messageKey = 'common.exportSuccess', titleKey = 'toast.success'): void {
    this.translate
      .get([messageKey, titleKey])
      .pipe(take(1))
      .subscribe(t => {
        this.toastService.success(t[messageKey], t[titleKey]);
      });
  }

  private showWarningToast(messageKey: string, titleKey = 'toast.warning'): void {
    this.translate
      .get([messageKey, titleKey])
      .pipe(take(1))
      .subscribe(t => {
        this.toastService.warning(t[messageKey], t[titleKey]);
      });
  }

  private showErrorToast(error: unknown, defaultMsg: string): void {
    const msg = ErrorHandler.extractAndTranslateErrorMessage(error, defaultMsg, this.translate);
    this.translate
      .get('toast.error')
      .pipe(take(1))
      .subscribe(t => {
        this.toastService.error(msg, t['toast.error']);
      });
  }

  private buildItemColumns(activeTab: InventoryDashboardExportContext['activeTab']): ExcelColumn[] {
    const columns: ExcelColumn[] = [
      {
        header: this.translate.instant('inventoryDashboard.itemSummary.cols.itemNo'),
        key: 'itemNo',
        width: 15,
        format: (v: string) => v || '-'
      },
      {
        header: this.translate.instant('inventoryDashboard.itemSummary.cols.itemName'),
        key: 'itemName',
        width: 30,
        format: (v: string) => v || '-'
      },
      {
        header: this.translate.instant('inventoryDashboard.itemSummary.cols.type'),
        key: 'itemTypeLabel',
        width: 16,
        format: (v: string) => v || '-'
      },
      {
        header: this.translate.instant('inventoryDashboard.itemSummary.cols.totalQty'),
        key: 'totalQuantity',
        width: 14
      }
    ];

    // The table hides these columns for weapons. Match the UI.
    if (activeTab !== 'weapon') {
      columns.push(
        {
          header: this.translate.instant('inventoryDashboard.itemSummary.cols.usedQty'),
          key: 'usedQuantity',
          width: 14
        },
        {
          header: this.translate.instant('inventoryDashboard.itemSummary.cols.reservedQty'),
          key: 'reservedQuantityByOrdersOnProcessing',
          width: 16
        },
        {
          header: this.translate.instant('inventoryDashboard.itemSummary.cols.remainingQty'),
          key: 'remainingQuantity',
          width: 16
        },
        {
          header: this.translate.instant('inventoryDashboard.itemSummary.cols.lots'),
          key: 'totalLots',
          width: 12
        }
      );
    }

    columns.push(
      {
        header: this.translate.instant('inventoryDashboard.itemSummary.filters.depot'),
        key: 'depotLabel',
        width: 24,
        format: (v: string) => v || '-'
      }
    );

    return columns;
  }

  private mapItemRow(item: ItemInventorySummaryDto, depotLabel: string): Record<string, unknown> {
    const lang = getCurrentLang(this.translate);
    return {
      itemName: localizedItemSummaryDisplayName(item, lang),
      itemNo: item.itemNo || '-',
      itemTypeLabel: this.getItemTypeLabel(item.itemType),
      totalQuantity: item.totalQuantity ?? 0,
      usedQuantity: item.usedQuantity ?? 0,
      reservedQuantityByOrdersOnProcessing: item.reservedQuantityByOrdersOnProcessing ?? 0,
      remainingQuantity: item.remainingQuantity ?? 0,
      totalLots: item.totalLots ?? 0,
      depotLabel: depotLabel || '-'
    };
  }

  private buildTotalsRow(context: InventoryDashboardExportContext): Record<string, unknown> {
    const totalsLabel =
      this.translate.instant('inventoryDashboard.itemSummary.totalsRow') ||
      this.translate.instant('common.total') ||
      'Totals';

    const row: Record<string, unknown> = {
      itemName: totalsLabel,
      itemNo: '-',
      itemTypeLabel: '-',
      totalQuantity: context.totals.totalQuantity ?? 0,
      depotLabel: '-'
    };

    if (context.activeTab !== 'weapon') {
      row['usedQuantity'] = context.totals.usedQuantity ?? 0;
      row['reservedQuantityByOrdersOnProcessing'] = context.totals.reservedQuantity ?? 0;
      row['remainingQuantity'] = context.totals.remainingQuantity ?? 0;
      row['totalLots'] = context.totals.totalLots ?? 0;
    }

    return row;
  }

  private getItemTypeLabel(type: number): string {
    switch (type) {
      case ItemType.Ammunition: return this.translate.instant('inventoryDashboard.itemType.ammunition');
      case ItemType.Weapon: return this.translate.instant('inventoryDashboard.itemType.weapon');
      case ItemType.Explosive: return this.translate.instant('inventoryDashboard.itemType.explosive');
      default: return this.translate.instant('common.unknown');
    }
  }


  private buildFileName(
    depotLabel: string,
    activeTab: InventoryDashboardExportContext['activeTab']
  ): string {
    const raw = (depotLabel || 'AllDepots').trim() || 'AllDepots';
    // Keep filename safe on Windows, while still showing depot names.
    const safe = raw
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return `${safe}_Inventory_Summary_${activeTab}`;
  }
}


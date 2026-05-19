import {
    Component,
    Input,
    Output,
    EventEmitter,
    ChangeDetectionStrategy,
    OnChanges,
    SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Eye, ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Download, Upload } from 'lucide-angular';
import { BatchSummaryDto, BatchAssetItemCountDto } from '@models/batch.model';
import { AssetDto } from '@models/asset.model';
import { trackById } from '@utils/trackby.utils';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { defaultPageSize } from '@constants/app.constants';
import { getCurrentLang, getLocalizedName } from '@utils/localization.utils';

export type BatchTableSortColumn = 'batchNumber' | 'quantity';

/** One row per catalog item in the expanded batch (counts from API; assets = current page slice). */
export interface BatchAssetGroupRow {
    itemId: number;
    itemName: string;
    itemNameAr?: string | null;
    /** Item / catalog number from API counts or assets in group. */
    itemNo: string;
    /** NSN from API counts or first asset in group. */
    nsn: string;
    count: number;
    assets: AssetDto[];
}

@Component({
    selector: 'app-batch-table',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule,
        PaginationComponent,
        RowsPerPageComponent,
        HasPermissionDirective
    ],
    templateUrl: './batch-table.component.html',
    styles: [`.batch-row-expanded { background-color: var(--color-background-hover) !important; }`],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BatchTableComponent implements OnChanges {
    @Input() batches: BatchSummaryDto[] = [];
    @Input() expandedBatchId: number | null = null;
    @Input() expandedBatchAssets: AssetDto[] = [];
    /** Per-item totals for the whole batch (from API; not limited to the current assets page). */
    @Input() expandedBatchAssetItemCounts: BatchAssetItemCountDto[] = [];
    /** Which item group's detail accordion is open (UI only; asset list is not filtered by item on the server). */
    @Input() expandedBatchDetailItemId: number | null = null;
    @Input() loadingBatchAssets = false;
    @Input() batchAssetsPage = 1;
    @Input() batchAssetsPageSize = defaultPageSize;
    @Input() batchAssetsTotalPages = 1;
    @Input() batchAssetsTotalCount = 0;
    @Input() getAssetItemName: (asset: AssetDto) => string = () => '';
    @Input() getAssetStatusLabel: (asset: AssetDto) => string = () => '';
    @Input() formatDate: (date?: Date | string) => string = () => '';
    @Input() getAssetDepartmentLabel: (asset: AssetDto) => string = () => '-';
    @Input() getAssetCustodianLabel: (asset: AssetDto) => string = () => '-';
    @Input() getAssetSupplierLabel: (asset: AssetDto) => string = () => '-';
    @Input() getAssetManufacturerLabel: (asset: AssetDto) => string = () => '-';
    @Input() getAssetPrimaryPurposeLabel: (asset: AssetDto) => string = () => '-';
    @Input() formatAssetPurchasePrice: (price?: number | null) => string = () => '-';
    @Input() truncateAssetNotes: (asset: AssetDto) => string = () => '-';

    /** When set, enables Export / Import Excel for expanded batch (uses warehouse permissions). */
    @Input() batchAssetExcelExportPerms: string[] = [];
    @Input() batchAssetExcelImportPerms: string[] = [];

    @Output() rowClick = new EventEmitter<BatchSummaryDto>();
    @Output() editBatch = new EventEmitter<BatchSummaryDto>();
    @Output() deleteBatch = new EventEmitter<BatchSummaryDto>();
    @Output() exportBatchAssetsExcel = new EventEmitter<BatchSummaryDto>();
    @Output() importBatchAssetsExcel = new EventEmitter<BatchSummaryDto>();
    @Output() sortChange = new EventEmitter<BatchTableSortColumn>();
    @Output() batchAssetsPageChange = new EventEmitter<number>();
    @Output() batchAssetsPageSizeChange = new EventEmitter<number>();
    @Output() batchAssetsDetailItemChange = new EventEmitter<number | null>();

    @Input() sortColumn: BatchTableSortColumn = 'batchNumber';
    @Input() sortDirection: 'asc' | 'desc' = 'asc';

    readonly Edit2 = Edit2;
    readonly Eye = Eye;
    readonly ChevronDown = ChevronDown;
    readonly ChevronRight = ChevronRight;
    readonly Trash2 = Trash2;
    readonly ArrowUp = ArrowUp;
    readonly ArrowDown = ArrowDown;
    readonly ArrowUpDown = ArrowUpDown;
    readonly Download = Download;
    readonly Upload = Upload;
    readonly trackById = trackById;

    groupedExpandedBatchAssets: BatchAssetGroupRow[] = [];

    constructor(private readonly translateService: TranslateService) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (
            changes['expandedBatchAssets'] ||
            changes['expandedBatchAssetItemCounts'] ||
            changes['getAssetItemName']
        ) {
            this.rebuildGroupedExpandedBatchAssets();
        }
    }

    private rebuildGroupedExpandedBatchAssets(): void {
        const counts = this.expandedBatchAssetItemCounts;
        if (counts?.length) {
            this.groupedExpandedBatchAssets = counts.map((c) => ({
                itemId: c.itemId,
                itemName: c.itemName,
                itemNameAr: c.itemNameAr ?? this.expandedBatchAssets.find((a) => a.itemId === c.itemId)?.item?.nameAr ?? null,
                itemNo: (c.itemNo ?? '').trim(),
                nsn: (c.nsn ?? '').trim(),
                count: c.count,
                assets: this.expandedBatchAssets.filter((a) => a.itemId === c.itemId)
            }));
            return;
        }

        const assets = this.expandedBatchAssets;
        if (!assets?.length) {
            this.groupedExpandedBatchAssets = [];
            return;
        }
        const map = new Map<string, { itemId: number; itemName: string; assets: AssetDto[] }>();
        const order: string[] = [];
        for (const asset of assets) {
            const raw = (this.getAssetItemName(asset) || '').trim();
            const key = raw || '-';
            if (!map.has(key)) {
                map.set(key, { itemId: asset.itemId, itemName: key, assets: [] });
                order.push(key);
            }
            map.get(key)!.assets.push(asset);
        }
        this.groupedExpandedBatchAssets = order.map((itemName) => {
            const g = map.get(itemName)!;
            const itemNo =
                g.assets.map((a) => (a.item?.itemNo ?? '').trim()).find((s) => s.length > 0) ?? '';
            const nsn =
                g.assets.map((a) => (a.item?.nsn ?? '').trim()).find((s) => s.length > 0) ?? '';
            return {
                itemId: g.itemId,
                itemName: g.itemName,
                itemNameAr: g.assets.map((a) => (a.item?.nameAr ?? '').trim()).find((s) => s.length > 0) ?? null,
                itemNo,
                nsn,
                count: g.assets.length,
                assets: g.assets
            };
        });
    }

    groupItemNoLabel(group: BatchAssetGroupRow): string {
        return group.itemNo || '—';
    }

    groupNsnLabel(group: BatchAssetGroupRow): string {
        return group.nsn || '—';
    }

    groupItemNameLabel(group: BatchAssetGroupRow): string {
        return getLocalizedName(
            {
                name: group.itemName,
                nameEn: group.itemName,
                nameAr: group.itemNameAr
            },
            getCurrentLang(this.translateService)
        ) || group.itemName || '—';
    }

    isAssetDetailExpanded(group: BatchAssetGroupRow): boolean {
        return this.expandedBatchDetailItemId === group.itemId;
    }

    toggleAssetDetail(group: BatchAssetGroupRow, event: Event): void {
        event.stopPropagation();
        const next = this.expandedBatchDetailItemId === group.itemId ? null : group.itemId;
        this.batchAssetsDetailItemChange.emit(next);
    }

    trackByGroupItemId(_index: number, row: BatchAssetGroupRow): number {
        return row.itemId;
    }

    toggleSort(column: BatchTableSortColumn): void {
        this.sortChange.emit(column);
    }

    sortIcon(column: BatchTableSortColumn): typeof ArrowUp | typeof ArrowDown | typeof ArrowUpDown {
        if (this.sortColumn !== column) {
            return ArrowUpDown;
        }
        return this.sortDirection === 'asc' ? ArrowUp : ArrowDown;
    }
}

import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Eye, ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, ArrowUpDown, Download, Upload } from 'lucide-angular';
import { BatchSummaryDto } from '@models/batch.model';
import { AssetDto } from '@models/asset.model';
import { trackById } from '@utils/trackby.utils';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';

export type BatchTableSortColumn = 'batchNumber' | 'quantity';

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
export class BatchTableComponent {
    @Input() batches: BatchSummaryDto[] = [];
    @Input() expandedBatchId: number | null = null;
    @Input() expandedBatchAssets: AssetDto[] = [];
    @Input() loadingBatchAssets = false;
    @Input() batchAssetsPage = 1;
    @Input() batchAssetsPageSize = 50;
    @Input() batchAssetsTotalPages = 1;
    @Input() batchAssetsTotalCount = 0;
    @Input() batchAssetsAllLoaded = false;
    /** Page size choices for batch assets (default 50, 100, 200, 500). */
    @Input() batchAssetsPageSizeOptions: number[] = [50, 100, 200, 500];
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
    @Output() batchAssetsLoadAll = new EventEmitter<void>();
    @Output() batchAssetsUsePagination = new EventEmitter<void>();

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

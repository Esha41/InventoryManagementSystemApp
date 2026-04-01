import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Edit2, Eye, ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-angular';
import { BatchSummaryDto } from '@models/batch.model';
import { AssetDto } from '@models/asset.model';
import { trackById } from '@utils/trackby.utils';

export type BatchTableSortColumn = 'batchNumber' | 'quantity';

@Component({
    selector: 'app-batch-table',
    standalone: true,
    imports: [
        CommonModule,
        TranslateModule,
        LucideAngularModule
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
    @Input() getAssetItemName: (asset: AssetDto) => string = () => '';
    @Input() getAssetItemNo: (asset: AssetDto) => string = () => '';
    @Input() getAssetStatusLabel: (asset: AssetDto) => string = () => '';
    @Input() formatDate: (date?: Date | string) => string = () => '';

    @Output() rowClick = new EventEmitter<BatchSummaryDto>();
    @Output() editBatch = new EventEmitter<BatchSummaryDto>();
    @Output() deleteBatch = new EventEmitter<BatchSummaryDto>();
    @Output() sortChange = new EventEmitter<BatchTableSortColumn>();

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

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ChevronDown, ChevronRight, Package, Paperclip } from 'lucide-angular';
import { ReturnService } from '@requests/services/return.service';
import { FileUploadService } from '@services/file-upload.service';
import { FileUploadDto } from '@models/file-upload.model';
import { ReturnTrackingLineDto } from '@models/return.model';
import { RequestItem } from '@models/workflow-approval.model';

export interface ReturnApprovedMasterRow {
  rowKey: string;
  requestItemId: number | null;
  itemName: string;
  itemNo: string;
  returnedQty: number;
  receivedQty: number;
  lotOrBatch: string;
  notes: string;
  isWeapon: boolean;
  detailLines: ReturnTrackingLineDto[];
  /** Non-weapon only: table column is either Lot (ammunition) or Batch (explosive). */
  nonWeaponLotHeader?: 'lot' | 'batch';
}

export interface ReturnApprovedAttachmentRow {
  file: FileUploadDto;
  source: 'request' | 'line';
  sourceDetail: string;
}

@Component({
  selector: 'app-workflow-return-approved-summary',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './workflow-return-approved-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowReturnApprovedSummaryComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) requestId!: number;
  @Input() requestItems: RequestItem[] = [];
  @Input() orderFiles: FileUploadDto[] = [];

  readonly Package = Package;
  readonly Paperclip = Paperclip;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;

  loading = false;
  loadError: string | null = null;
  masterRows: ReturnApprovedMasterRow[] = [];
  attachmentRows: ReturnApprovedAttachmentRow[] = [];
  expandedRowKey: string | null = null;

  private destroy$ = new Subject<void>();
  private cachedLines: ReturnTrackingLineDto[] = [];

  constructor(
    private returnService: ReturnService,
    private fileUploadService: FileUploadService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestId'] && this.requestId > 0) {
      this.load();
      return;
    }
    if (
      this.cachedLines.length > 0 &&
      (changes['orderFiles'] || changes['requestItems']) &&
      !changes['requestId']
    ) {
      this.masterRows = this.buildMasterRows(this.cachedLines);
      this.attachmentRows = this.buildAttachmentRows(this.orderFiles, this.cachedLines);
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleExpand(row: ReturnApprovedMasterRow): void {
    if (!row.isWeapon || row.detailLines.length === 0) {
      return;
    }
    this.expandedRowKey = this.expandedRowKey === row.rowKey ? null : row.rowKey;
    this.cdr.markForCheck();
  }

  isExpanded(row: ReturnApprovedMasterRow): boolean {
    return this.expandedRowKey === row.rowKey;
  }

  expandIcon(row: ReturnApprovedMasterRow) {
    return this.isExpanded(row) ? this.ChevronDown : this.ChevronRight;
  }

  getFileDownloadUrl(file: FileUploadDto): string {
    return this.fileUploadService.getFileDownloadUrl(file.id);
  }

  /** Weapon summary rows (serial-based tracking). */
  get weaponMasterRows(): ReturnApprovedMasterRow[] {
    return this.masterRows.filter((r) => r.isWeapon);
  }

  /** Non-weapon lines shown under a Lot column (ammunition). */
  get ammoLotRows(): ReturnApprovedMasterRow[] {
    return this.masterRows.filter((r) => !r.isWeapon && r.nonWeaponLotHeader === 'lot');
  }

  /** Non-weapon lines shown under a Batch column (explosives). */
  get explosiveBatchRows(): ReturnApprovedMasterRow[] {
    return this.masterRows.filter((r) => !r.isWeapon && r.nonWeaponLotHeader === 'batch');
  }

  private load(): void {
    this.loading = true;
    this.loadError = null;
    this.masterRows = [];
    this.attachmentRows = [];
    this.cachedLines = [];
    this.expandedRowKey = null;
    this.cdr.markForCheck();

    this.returnService
      .getReturnTrackingLines(this.requestId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.loadError = 'workflowReturnApprovedSummary.loadError';
          return of([] as ReturnTrackingLineDto[]);
        })
      )
      .subscribe((lines) => {
        const list = Array.isArray(lines) ? lines : [];
        this.cachedLines = list;
        this.masterRows = this.buildMasterRows(list);
        this.attachmentRows = this.buildAttachmentRows(this.orderFiles, list);
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  private resolveItem(requestItemId: number | null | undefined): {
    name: string;
    no: string;
    quantity: number | null;
    itemType: number | null;
  } {
    if (requestItemId == null) {
      return { name: '', no: '', quantity: null, itemType: null };
    }
    const ri = this.requestItems.find((x) => Number(x.id) === Number(requestItemId));
    if (!ri) {
      return { name: '', no: '', quantity: null, itemType: null };
    }
    const q = Number(ri.quantity);
    const it = ri.itemType != null ? Number(ri.itemType) : NaN;
    return {
      name: ri.itemName || '',
      no: ri.itemNo || '',
      quantity: Number.isFinite(q) && q > 0 ? q : null,
      itemType: Number.isFinite(it) ? it : null
    };
  }

  /** 3 = explosive → Batch column; 1 = ammunition → Lot; else infer from line fields. */
  private nonWeaponLotHeader(
    fallback: { name: string; no: string; quantity: number | null; itemType: number | null },
    l: ReturnTrackingLineDto
  ): 'lot' | 'batch' {
    const t = fallback.itemType;
    if (t === 3) {
      return 'batch';
    }
    if (t === 1) {
      return 'lot';
    }
    const hasLot = !!(l.lot && String(l.lot).trim());
    const hasBatch = !!(l.batchNumber && String(l.batchNumber).trim());
    if (hasBatch && !hasLot) {
      return 'batch';
    }
    return 'lot';
  }

  private buildMasterRows(lines: ReturnTrackingLineDto[]): ReturnApprovedMasterRow[] {
    const isWeaponLine = (l: ReturnTrackingLineDto) => !!(l.serialNumber && String(l.serialNumber).trim());

    const weaponLines = lines.filter(isWeaponLine);
    const ammoLines = lines.filter((l) => !isWeaponLine(l));

    const weaponGroupKey = (l: ReturnTrackingLineDto) =>
      l.requestItemId != null && l.requestItemId > 0 ? `ri-${l.requestItemId}` : `line-${l.id}`;

    const weaponGroups = new Map<string, ReturnTrackingLineDto[]>();
    for (const l of weaponLines) {
      const k = weaponGroupKey(l);
      if (!weaponGroups.has(k)) {
        weaponGroups.set(k, []);
      }
      weaponGroups.get(k)!.push(l);
    }

    const masters: ReturnApprovedMasterRow[] = [];

    for (const [, grp] of weaponGroups) {
      const first = grp[0];
      const rid = first.requestItemId != null && first.requestItemId > 0 ? first.requestItemId : null;
      const fallback = this.resolveItem(rid);

      // Backend: one tracking row per weapon serial. Row count = serials recorded; request item qty = declared return.
      const lineCount = grp.length;
      const sumReturned = grp.reduce((s, g) => s + Number(g.returnedQuantity ?? 0), 0);
      const sumReceived = grp.reduce((s, g) => s + Number(g.receivedQuantity ?? 0), 0);

      const returned =
        fallback.quantity != null ? fallback.quantity : sumReturned > 0 ? sumReturned : lineCount;
      const received = lineCount > 0 ? lineCount : sumReceived;

      const batches = [
        ...new Set(grp.map((g) => (g.batchNumber || '').trim()).filter(Boolean))
      ] as string[];
      const lotOrBatch =
        batches.length === 0 ? '—' : batches.length === 1 ? batches[0] : batches.join(', ');
      const notes = grp
        .map((g) => (g.notes || '').trim())
        .filter(Boolean)
        .join(' | ');
      masters.push({
        rowKey: weaponGroupKey(first),
        requestItemId: rid,
        itemName: (first.itemName || '').trim() || fallback.name || '—',
        itemNo: (first.itemNo || '').trim() || fallback.no || '—',
        returnedQty: returned,
        receivedQty: received,
        lotOrBatch,
        notes: notes || '—',
        isWeapon: true,
        detailLines: [...grp].sort((a, b) => (a.serialNumber || '').localeCompare(b.serialNumber || ''))
      });
    }

    for (const l of ammoLines.sort((a, b) => a.id - b.id)) {
      const rid = l.requestItemId != null && l.requestItemId > 0 ? l.requestItemId : null;
      const fallback = this.resolveItem(rid);
      const lotOrBatch =
        (l.lot && l.lot.trim()) || (l.batchNumber && l.batchNumber.trim()) || '—';
      masters.push({
        rowKey: `ammo-${l.id}`,
        requestItemId: rid,
        itemName: (l.itemName || '').trim() || fallback.name || '—',
        itemNo: (l.itemNo || '').trim() || fallback.no || '—',
        returnedQty: Number(l.returnedQuantity ?? 0),
        receivedQty: Number(l.receivedQuantity ?? 0),
        lotOrBatch,
        notes: (l.notes || '').trim() || '—',
        isWeapon: false,
        detailLines: [],
        nonWeaponLotHeader: this.nonWeaponLotHeader(fallback, l)
      });
    }

    return masters;
  }

  private buildAttachmentRows(
    requestFiles: FileUploadDto[] | undefined,
    lines: ReturnTrackingLineDto[]
  ): ReturnApprovedAttachmentRow[] {
    const seen = new Set<number>();
    const rows: ReturnApprovedAttachmentRow[] = [];

    for (const f of requestFiles || []) {
      if (f?.id != null && !seen.has(f.id)) {
        seen.add(f.id);
        rows.push({
          file: f,
          source: 'request',
          sourceDetail: ''
        });
      }
    }

    for (const line of lines) {
      const label =
        ((line.itemName || '').trim() || this.resolveItem(line.requestItemId).name || `#${line.id}`) as string;
      for (const f of line.files || []) {
        if (f?.id != null && !seen.has(f.id)) {
          seen.add(f.id);
          rows.push({
            file: f,
            source: 'line',
            sourceDetail: label
          });
        }
      }
    }

    return rows;
  }
}

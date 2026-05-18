import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { getCurrentLang, getLocalizedName } from '@core/utils/localization.utils';
import { LucideAngularModule, Package } from 'lucide-angular';
import { SupplyService, WorkflowSupplySummaryDto } from '@requests/services/supply.service';
import { AppDateTimePipe } from '@shared/pipes/app-date-time.pipe';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TableClampTooltipDirective } from '@components/table-clamp-tooltip/table-clamp-tooltip.directive';
import { groupAmmoSupplyLines, type AmmoSupplyLineGroup } from '../../../utils/ammo-supply-line-groups.util';

@Component({
  selector: 'app-workflow-supply-summary',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, AppDateTimePipe, TableClampTooltipDirective],
  templateUrl: './workflow-supply-summary.component.html',
  styleUrls: ['./workflow-supply-summary.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowSupplySummaryComponent implements OnInit, OnChanges {
  readonly Package = Package;

  @Input({ required: true }) orderId!: number;
  @Input({ required: true }) destroy$!: Subject<void>;
  /** Parent increments this after supply/pickup updates so the summary reloads without leaving the page. */
  @Input() refreshTick = 0;

  loading = true;
  error: string | null = null;
  summary: WorkflowSupplySummaryDto | null = null;
  /** Ammunition / explosives lines grouped by `itemId` (set when summary loads). */
  ammoGroups: AmmoSupplyLineGroup[] = [];

  constructor(
    private supplyService: SupplyService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    this.loadSummary();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] && !changes['orderId'].firstChange) {
      this.loadSummary();
      return;
    }
    if (changes['refreshTick'] && !changes['refreshTick'].firstChange) {
      this.loadSummary();
    }
  }

  private loadSummary(): void {
    this.loading = true;
    this.error = null;
    this.ammoGroups = [];
    this.cdr.markForCheck();

    this.supplyService.getWorkflowSupplySummary(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.summary = data;
          this.ammoGroups = groupAmmoSupplyLines(data.lines ?? []);
          this.loading = false;
          this.error = null;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = ErrorHandler.extractErrorMessage(err, 'workflowApprovalDetail.workflowSupplySummary.loadError');
          this.loading = false;
          this.summary = null;
          this.ammoGroups = [];
          this.cdr.markForCheck();
        }
      });
  }

  showProvisionalBanner(): boolean {
    return !!this.summary && this.summary.isOrderCompleted === false;
  }

  showSupplyDateRow(): boolean {
    return !!this.summary?.supplyDate && this.summary.isOrderCompleted === true;
  }

  isSelectionPhase(): boolean {
    return this.summary?.phase === 'Selection';
  }

  isSuppliedPhase(): boolean {
    return this.summary?.phase === 'Supplied';
  }

  isAmmoPhase(): boolean {
    return !this.summary?.isWeaponOrder || this.summary?.phase === 'None' || !this.summary?.phase;
  }

  hasWeaponSelectionLines(): boolean {
    return !!this.summary?.selectionLines?.length;
  }

  hasWeaponSuppliedLines(): boolean {
    return !!this.summary?.weaponLines?.length;
  }

  submissionLabelKey(status: number): string {
    if (status === 2) {
      return 'workflowApprovalDetail.workflowSupplySummary.submissionSubmitted';
    }
    return 'workflowApprovalDetail.workflowSupplySummary.submissionDraft';
  }

  fulfillmentLabelKey(status: number): string {
    if (status === 2) {
      return 'workflowApprovalDetail.workflowSupplySummary.fulfillmentFull';
    }
    return 'workflowApprovalDetail.workflowSupplySummary.fulfillmentPartial';
  }

  suppliedColumnKey(): string {
    return this.summary?.isOrderCompleted
      ? 'workflowApprovalDetail.workflowSupplySummary.colSupplied'
      : 'workflowApprovalDetail.workflowSupplySummary.colShouldBeSupplied';
  }

  depotDisplay(line: {
    depotName?: string | null;
    depotNameEn?: string | null;
    depotNameAr?: string | null;
    depotCode?: string | null;
  }): string {
    const name = getLocalizedName(
      {
        nameEn: line.depotNameEn ?? line.depotName ?? undefined,
        nameAr: line.depotNameAr ?? undefined
      },
      getCurrentLang(this.translate)
    ).trim();
    const code = (line.depotCode || '').trim();
    if (name && code) {
      return `${name} (${code})`;
    }
    return name || code || '—';
  }
}

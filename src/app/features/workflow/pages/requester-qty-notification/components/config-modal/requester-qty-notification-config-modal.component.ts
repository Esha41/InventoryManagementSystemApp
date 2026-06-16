import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Loader2, X } from 'lucide-angular';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { BackendWorkflowDto, WorkflowStepDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { WorkflowService } from '@workflow/services/workflow.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName } from '@utils/localization.utils';

@Component({
  selector: 'app-requester-qty-notification-config-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent],
  templateUrl: './requester-qty-notification-config-modal.component.html',
  styleUrl: './requester-qty-notification-config-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequesterQtyNotificationConfigModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) workflowId!: number;
  @Input() workflowName: string | null = null;
  @Input() workflowTypeLabel: string | null = null;

  @Output() closed = new EventEmitter<boolean>();

  readonly X = X;
  readonly Loader2 = Loader2;

  workflowDetail: BackendWorkflowDto | null = null;
  selectedStepIds: number[] = [];

  loading = true;
  loadFailed: string | null = null;
  saving = false;
  saveError: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private workflowService: WorkflowService,
    private translationService: TranslationService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get resolvedWorkflowTitle(): string {
    const fromDetail = this.workflowDetail?.workflowName?.trim();
    if (fromDetail) {
      return fromDetail;
    }
    const fromInput = this.workflowName?.trim();
    if (fromInput) {
      return fromInput;
    }
    return `#${this.workflowId}`;
  }

  get resolvedWorkflowType(): string {
    const fromDetail = this.workflowDetail?.workflowTypeName?.trim();
    if (fromDetail) {
      return fromDetail;
    }
    return this.workflowTypeLabel?.trim() ?? '';
  }

  get sortedSteps(): WorkflowStepDto[] {
    const steps = this.workflowDetail?.workflowSteps;
    if (!steps?.length) {
      return [];
    }
    return [...steps].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));
  }

  get stepDropdownOptions(): DropdownOption<number>[] {
    return this.sortedSteps.map(step => ({
      value: step.id,
      label: this.formatStepOptionLabel(step),
    }));
  }

  get saveDisabled(): boolean {
    return this.loading || !!this.loadFailed || this.saving || !this.workflowDetail;
  }

  ngOnInit(): void {
    this.loadModalData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismiss(): void {
    this.closed.emit(false);
  }

  save(): void {
    if (this.saveDisabled) {
      return;
    }

    const stepIdsInWorkflow = new Set(this.sortedSteps.map(step => step.id));
    const payload = this.selectedStepIds
      .filter(id => stepIdsInWorkflow.has(id))
      .sort((a, b) => a - b);

    this.saving = true;
    this.saveError = null;
    this.cdr.markForCheck();

    this.workflowService
      .replaceRequesterQtyNotificationStepIds(this.workflowId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.cdr.markForCheck();
          this.toastService.success(
            this.translationService.getTranslation('workflow.requesterQtyNotifySaved')
          );
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.saving = false;
          this.saveError = ErrorHandler.extractErrorMessage(
            err,
            this.translationService.getTranslation('workflow.requesterQtyNotifyLoadFailed')
          );
          this.cdr.markForCheck();
        },
      });
  }

  private loadModalData(): void {
    this.loading = true;
    this.loadFailed = null;
    this.saveError = null;
    this.cdr.markForCheck();

    forkJoin({
      detail: this.workflowService.getWorkflowDetailById(this.workflowId),
      configuredStepIds: this.workflowService.getRequesterQtyNotificationStepIds(this.workflowId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ detail, configuredStepIds }) => {
          this.workflowDetail = detail;
          const valid = new Set((detail.workflowSteps ?? []).map(step => step.id));
          const orderIdx = new Map(this.sortedSteps.map((step, index) => [step.id, index]));
          this.selectedStepIds = configuredStepIds
            .filter(id => valid.has(id))
            .sort((a, b) => (orderIdx.get(a) ?? 0) - (orderIdx.get(b) ?? 0));
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.loadFailed = ErrorHandler.extractErrorMessage(
            err,
            this.translationService.getTranslation('workflow.requesterQtyNotifyLoadDetailFailed')
          );
          this.cdr.markForCheck();
        },
      });
  }

  private formatStepOptionLabel(step: WorkflowStepDto): string {
    const orderLabel = this.translationService.getTranslation('workflow.stepOrder');
    const lang = this.translationService.getCurrentLanguage();
    const role = getLocalizedName(
      {
        nameEn: step.applicationRoleName ?? '',
        nameAr: step.applicationRoleNameAr ?? step.applicationRoleName ?? '',
      },
      lang
    );
    const entity = step.applicationEntityName ?? '';
    let line = `${orderLabel} ${step.stepOrder} — ${role}`;
    if (entity) {
      line += ` (${entity})`;
    }
    return line;
  }
}

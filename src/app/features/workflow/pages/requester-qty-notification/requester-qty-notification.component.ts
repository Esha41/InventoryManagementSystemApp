import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { WorkflowDto, BackendWorkflowDto, WorkflowStepDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { WorkflowService } from '@workflow/services/workflow.service';
import { getLocalizedName } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, forkJoin, of } from 'rxjs';
import { switchMap, map, takeUntil, catchError } from 'rxjs/operators';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ErrorStateComponent } from '@components/index';

interface RequesterQtyNotificationTableRow {
  workflowId: number;
  workflowName: string;
  workflowTypeLabel: string;
  stepNames: string[];
}

@Component({
  selector: 'app-requester-qty-notification',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    HasPermissionDirective,
    RouterLink,
    DropdownComponent,
    CardComponent,
    ButtonComponent,
    ErrorStateComponent,
  ],
  templateUrl: './requester-qty-notification.component.html',
  styleUrl: './requester-qty-notification.component.css',
})
export class RequesterQtyNotificationComponent implements OnInit, OnDestroy {
  readonly PERMISSIONS = PERMISSIONS;

  workflows: WorkflowDto[] = [];
  selectedWorkflowId: number | null = null;
  workflowDetail: BackendWorkflowDto | null = null;
  /** Step IDs selected for the current workflow (saved replaces config for that workflow only). */
  selectedStepIds: number[] = [];
  /** All saved notification steps across workflows. */
  savedTableRows: RequesterQtyNotificationTableRow[] = [];

  loading = false;
  loadingSavedTable = false;
  savedTableLoadError: string | null = null;
  loadingDetail = false;
  saving = false;
  errorMessage: string | null = null;

  @ViewChild('notificationSettingsSection')
  private notificationSettingsSection?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();

  constructor(
    private workflowService: WorkflowService,
    private toastService: ToastService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInitial();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  get workflowDropdownOptions(): DropdownOption<number>[] {
    return this.workflows.map(w => ({
      value: w.id,
      label: `${w.name ?? ''} — ${this.getWorkflowTypeLabel(w)}`,
    }));
  }

  onStepSelectionChange(): void {
    this.cdr.markForCheck();
  }

  onWorkflowSelected(id: number | null): void {
    if (id == null || !Number.isFinite(id) || id <= 0) {
      this.selectedWorkflowId = null;
      this.workflowDetail = null;
      this.selectedStepIds = [];
      this.loadingDetail = false;
      this.cdr.markForCheck();
      return;
    }
    this.selectedWorkflowId = id;
    this.loadingDetail = true;
    this.workflowDetail = null;
    this.selectedStepIds = [];
    this.workflowService
      .getWorkflowDetailById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: detail => {
          this.workflowDetail = detail;
          this.applyConfiguredStepsForWorkflow(id);
          this.loadingDetail = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingDetail = false;
          this.toastService.error(
            this.translationService.getTranslation('workflow.requesterQtyNotifyLoadDetailFailed')
          );
          this.cdr.markForCheck();
        },
      });
  }

  save(): void {
    if (this.saving) {
      return;
    }
    const wfId = this.selectedWorkflowId;
    if (wfId == null || wfId <= 0) {
      this.toastService.error(
        this.translationService.getTranslation('workflow.requesterQtyNotifySaveNeedWorkflow')
      );
      return;
    }
    this.saving = true;
    const stepIdsInWorkflow = new Set(this.sortedSteps.map(s => s.id));
    const payload = this.selectedStepIds
      .filter(id => stepIdsInWorkflow.has(id))
      .sort((a, b) => a - b);
    this.workflowService
      .replaceRequesterQtyNotificationStepIds(wfId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.loadSavedTableRows();
          this.toastService.success(
            this.translationService.getTranslation('workflow.requesterQtyNotifySaved')
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  getWorkflowTypeLabel(w: WorkflowDto): string {
    const lang = this.translationService.getCurrentLanguage();
    return this.workflowService.getWorkflowTypeNameById(w.workflowType ?? 0, lang);
  }

  roleLabel(step: WorkflowStepDto): string {
    const lang = this.translationService.getCurrentLanguage();
    const ar = step.applicationRoleNameAr ?? step.applicationRoleName ?? '';
    const en = step.applicationRoleName ?? '';
    return getLocalizedName({ nameEn: en, nameAr: ar }, lang);
  }

  entityLabel(step: WorkflowStepDto): string {
    return step.applicationEntityName ?? '';
  }

  trackByTableRow(_: number, row: RequesterQtyNotificationTableRow): number {
    return row.workflowId;
  }

  displayWorkflowType(workflow: WorkflowDto): string {
    if (workflow.workflowTypeName?.trim()) {
      return workflow.workflowTypeName.trim();
    }
    return this.getWorkflowTypeLabel(workflow);
  }

  reloadSavedTable(): void {
    this.loadSavedTableRows();
  }

  configureWorkflow(row: RequesterQtyNotificationTableRow): void {
    this.onWorkflowSelected(row.workflowId);
    this.scrollToNotificationSettings();
  }

  private scrollToNotificationSettings(): void {
    requestAnimationFrame(() => {
      this.notificationSettingsSection?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  stepNameLabel(step: WorkflowStepDto): string {
    return this.formatStepOptionLabel(step);
  }

  private sortWorkflows(workflows: WorkflowDto[]): WorkflowDto[] {
    return [...workflows].sort((a, b) => {
      const byType = (a.workflowType ?? 0) - (b.workflowType ?? 0);
      if (byType !== 0) {
        return byType;
      }
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }

  private loadSavedTableRows(): void {
    if (!this.workflows.length) {
      this.savedTableRows = [];
      this.loadingSavedTable = false;
      this.savedTableLoadError = null;
      return;
    }

    this.loadingSavedTable = true;
    this.savedTableLoadError = null;
    const sortedWorkflows = this.sortWorkflows(this.workflows);

    forkJoin(
      sortedWorkflows.map(workflow =>
        this.workflowService.getRequesterQtyNotificationStepIds(workflow.id).pipe(
          map(stepIds => ({ workflow, stepIds })),
          catchError(() => of({ workflow, stepIds: [] as number[] }))
        )
      )
    )
      .pipe(
        switchMap(results => {
          const withSteps = results.filter(r => r.stepIds.length > 0);
          if (!withSteps.length) {
            return of(
              results.map(({ workflow, stepIds }) =>
                this.buildTableRowForWorkflow(workflow, stepIds, null)
              )
            );
          }
          return forkJoin(
            withSteps.map(({ workflow }) =>
              this.workflowService.getWorkflowDetailById(workflow.id).pipe(
                map(detail => ({ workflowId: workflow.id, detail })),
                catchError(() => of({ workflowId: workflow.id, detail: null as BackendWorkflowDto | null }))
              )
            )
          ).pipe(
            map(details => {
              const detailByWorkflowId = new Map(
                details.filter(d => d.detail).map(d => [d.workflowId, d.detail!])
              );
              return results.map(({ workflow, stepIds }) =>
                this.buildTableRowForWorkflow(
                  workflow,
                  stepIds,
                  detailByWorkflowId.get(workflow.id) ?? null
                )
              );
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: rows => {
          this.savedTableRows = rows;
          this.loadingSavedTable = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loadingSavedTable = false;
          this.savedTableLoadError = ErrorHandler.extractErrorMessage(
            err,
            this.translationService.getTranslation('workflow.requesterQtyNotifyLoadFailed')
          );
          this.savedTableRows = [];
          this.cdr.markForCheck();
        },
      });
  }

  private buildTableRowForWorkflow(
    workflow: WorkflowDto,
    stepIds: number[],
    detail: BackendWorkflowDto | null
  ): RequesterQtyNotificationTableRow {
    let stepNames: string[] = [];
    if (stepIds.length > 0 && detail?.workflowSteps?.length) {
      const steps = [...detail.workflowSteps].sort(
        (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
      );
      const stepById = new Map(steps.map(step => [step.id, step]));
      const orderIdx = new Map(steps.map((step, index) => [step.id, index]));

      stepNames = [...stepIds]
        .sort((a, b) => (orderIdx.get(a) ?? 0) - (orderIdx.get(b) ?? 0))
        .flatMap(stepId => {
          const step = stepById.get(stepId);
          return step ? [this.stepNameLabel(step)] : [];
        });
    }

    return {
      workflowId: workflow.id,
      workflowName: workflow.name ?? '',
      workflowTypeLabel: this.displayWorkflowType(workflow),
      stepNames,
    };
  }

  private formatStepOptionLabel(step: WorkflowStepDto): string {
    const orderLabel = this.translationService.getTranslation('workflow.stepOrder');
    const role = this.roleLabel(step);
    const entity = this.entityLabel(step);
    let line = `${orderLabel} ${step.stepOrder ?? ''} — ${role}`;
    if (entity) {
      line += ` (${entity})`;
    }
    return line;
  }

  private loadInitial(): void {
    this.loading = true;
    this.errorMessage = null;
    this.workflowService
      .getWorkflows()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: workflows => {
          this.workflows = this.sortWorkflows(workflows);
          this.loading = false;
          this.loadSavedTableRows();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'workflow.requesterQtyNotifyLoadFailed';
          this.cdr.markForCheck();
        },
      });
  }

  private applyConfiguredStepsForWorkflow(workflowId: number): void {
    this.workflowService
      .getRequesterQtyNotificationStepIds(workflowId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: configured => {
          const valid = new Set((this.workflowDetail?.workflowSteps ?? []).map(s => s.id));
          const orderIdx = new Map(this.sortedSteps.map((s, i) => [s.id, i]));
          this.selectedStepIds = configured
            .filter(id => valid.has(id))
            .sort((a, b) => (orderIdx.get(a) ?? 0) - (orderIdx.get(b) ?? 0));
          this.cdr.markForCheck();
        },
        error: () => {
          this.toastService.error(
            this.translationService.getTranslation('workflow.requesterQtyNotifyLoadDetailFailed')
          );
          this.cdr.markForCheck();
        },
      });
  }
}

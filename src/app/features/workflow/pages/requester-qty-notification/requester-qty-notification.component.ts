import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkflowDto, BackendWorkflowDto, WorkflowStepDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { WorkflowService } from '@workflow/services/workflow.service';
import { getLocalizedName } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, forkJoin, of } from 'rxjs';
import { switchMap, map, takeUntil, catchError } from 'rxjs/operators';
import { CardComponent } from '@components/card/card.component';
import { ErrorStateComponent } from '@components/index';
import { RequesterQtyNotificationConfigModalComponent } from './components/config-modal/requester-qty-notification-config-modal.component';

interface RequesterQtyNotificationTableRow {
  workflowId: number;
  workflowName: string;
  workflowTypeLabel: string;
  stepNames: string[];
}

interface ConfigureModalState {
  workflowId: number;
  workflowName: string;
  workflowTypeLabel: string;
}

@Component({
  selector: 'app-requester-qty-notification',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    CardComponent,
    ErrorStateComponent,
    RequesterQtyNotificationConfigModalComponent,
  ],
  templateUrl: './requester-qty-notification.component.html',
  styleUrl: './requester-qty-notification.component.css',
})
export class RequesterQtyNotificationComponent implements OnInit, OnDestroy {
  workflows: WorkflowDto[] = [];
  savedTableRows: RequesterQtyNotificationTableRow[] = [];
  configureModal: ConfigureModalState | null = null;

  loading = false;
  loadingSavedTable = false;
  savedTableLoadError: string | null = null;
  errorMessage: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private workflowService: WorkflowService,
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
    this.configureModal = {
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      workflowTypeLabel: row.workflowTypeLabel,
    };
    this.cdr.markForCheck();
  }

  onConfigureModalClosed(saved: boolean): void {
    this.configureModal = null;
    if (saved) {
      this.loadSavedTableRows();
    }
    this.cdr.markForCheck();
  }

  private getWorkflowTypeLabel(w: WorkflowDto): string {
    const lang = this.translationService.getCurrentLanguage();
    return this.workflowService.getWorkflowTypeNameById(w.workflowType ?? 0, lang);
  }

  private stepNameLabel(step: WorkflowStepDto): string {
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
}

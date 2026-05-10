import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { WorkflowService } from '@workflow/services/workflow.service';
import { WorkflowDto } from '@models/workflow.model';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ErrorHandler } from '@utils/error-handler.utils';

import { OrderAutoRejectWorkflowTriggersModalComponent } from '../workflow-triggers-modal/order-auto-reject-workflow-triggers-modal.component';

@Component({
  selector: 'app-order-auto-reject-workflow-triggers-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, CardComponent, OrderAutoRejectWorkflowTriggersModalComponent],
  templateUrl: './order-auto-reject-workflow-triggers-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderAutoRejectWorkflowTriggersPanelComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  workflows: WorkflowDto[] = [];
  isLoading = false;
  loadError: string | null = null;

  triggersModalWorkflow: WorkflowDto | null = null;

  constructor(
    private workflowService: WorkflowService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private authService: BackendAuthService
  ) {}

  canEditWorkflow(): boolean {
    return this.authService.hasAnyPermission([PERMISSIONS.WORKFLOW.EDIT]);
  }

  ngOnInit(): void {
    this.reload();
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.isLoading = true;
    this.loadError = null;
    this.cdr.markForCheck();
    this.workflowService.getWorkflows().pipe(takeUntil(this.destroy$)).subscribe({
      next: (rows) => {
        this.workflows = [...rows].sort((a, b) => {
          const t = (a.workflowType ?? 0) - (b.workflowType ?? 0);
          if (t !== 0) return t;
          return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        });
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.isLoading = false;
        this.loadError = ErrorHandler.extractErrorMessage(err, 'Failed to load workflows');
        this.workflows = [];
        this.cdr.markForCheck();
      }
    });
  }

  triggerMode(w: WorkflowDto): 'none' | 'role' | 'step' {
    const m = String(w.autoRejectTriggerMode ?? '').trim().toLowerCase();
    if (m === 'role') return 'role';
    if (m === 'step') return 'step';
    return 'none';
  }

  roleTriggerCount(w: WorkflowDto): number {
    return (w.autoRejectTriggerRoleIds ?? []).filter(Boolean).length;
  }

  stepTriggerCount(w: WorkflowDto): number {
    return (w.autoRejectTriggerStepIds ?? []).filter(id => id != null && id > 0).length;
  }

  showAnchorDetail(w: WorkflowDto): boolean {
    return this.triggerMode(w) !== 'none';
  }

  anchorDetailKey(w: WorkflowDto): string {
    return w.autoRejectResetOnReApproval !== false
      ? 'orderAutoRejectSettings.workflowTriggerAnchorDetailLatest'
      : 'orderAutoRejectSettings.workflowTriggerAnchorDetailEarliest';
  }

  trackByWorkflowId(_: number, w: WorkflowDto): number {
    return w.id;
  }

  /** Stable workflow type label (nine standard types) when API omits workflowTypeName. */
  displayWorkflowType(w: WorkflowDto): string {
    if (w.workflowTypeName?.trim()) return w.workflowTypeName.trim();
    const lang = (this.translate.currentLang || 'en') === 'ar' ? 'ar' : 'en';
    return this.workflowService.getWorkflowTypeNameById(w.workflowType, lang);
  }

  openTriggerModal(w: WorkflowDto): void {
    if (!this.canEditWorkflow()) return;
    this.triggersModalWorkflow = w;
    this.cdr.markForCheck();
  }

  onTriggersModalClosed(saved: boolean): void {
    this.triggersModalWorkflow = null;
    if (saved) this.reload();
    this.cdr.markForCheck();
  }
}

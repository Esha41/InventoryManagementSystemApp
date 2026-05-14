import { CommonModule, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PERMISSIONS } from '@constants/permissions.constants';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { WorkflowDto, BackendWorkflowDto, WorkflowStepDto } from '@models/workflow.model';
import { TranslationService } from '@services/translation.service';
import { ToastService } from '@services/toast.service';
import { WorkflowService } from '@workflow/services/workflow.service';
import { getLocalizedName } from '@utils/localization.utils';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { CardComponent } from '@components/card/card.component';
import { ButtonComponent } from '@components/button/button.component';
import { ErrorStateComponent } from '@components/index';

@Component({
  selector: 'app-requester-qty-notification',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    LucideAngularModule,
    HasPermissionDirective,
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
  readonly ArrowLeft = ArrowLeft;

  workflows: WorkflowDto[] = [];
  selectedWorkflowId: number | null = null;
  workflowDetail: BackendWorkflowDto | null = null;
  /** Step IDs selected for the current workflow (saved replaces config for that workflow only). */
  selectedStepIds: number[] = [];

  loading = false;
  loadingDetail = false;
  saving = false;
  errorMessage: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private workflowService: WorkflowService,
    private router: Router,
    private toastService: ToastService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadInitial();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isRTL(): boolean {
    return this.translationService.isRTL();
  }

  get backIcon(): typeof ArrowLeft {
    return this.isRTL ? ArrowLeft : ArrowLeft;
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

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/settings', 'requester-qty-notifications']);
    }
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
          this.workflows = [...workflows].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );
          this.loading = false;
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

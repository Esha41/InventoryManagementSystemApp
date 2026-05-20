import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, Loader2, X } from 'lucide-angular';
import { WorkflowService } from '@workflow/services/workflow.service';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { AutoRejectTriggerMode } from '@models/backend-enums';
import { BackendWorkflowDto, WorkflowStepDto } from '@models/workflow.model';
import { RoleDto } from '@models/backend-user.model';
import { TranslationMap } from '@models/common.types';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-order-auto-reject-workflow-triggers-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, DropdownComponent],
  templateUrl: './order-auto-reject-workflow-triggers-modal.component.html',
  styleUrl: './order-auto-reject-workflow-triggers-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderAutoRejectWorkflowTriggersModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) workflowId!: number;
  /** Optional display name before detail load completes */
  @Input() workflowName: string | null = null;

  @Output() closed = new EventEmitter<boolean>();

  @ViewChild('roleDd') private roleDd?: DropdownComponent;
  @ViewChild('stepDd') private stepDd?: DropdownComponent;

  readonly X = X;
  readonly Loader2 = Loader2;

  roles: RoleDto[] = [];
  loadedWorkflow: BackendWorkflowDto | null = null;

  triggerMode: 'none' | 'role' | 'step' | 'disabled' = 'none';
  triggerRoleIds: string[] = [];
  triggerStepIds: number[] = [];

  stepSelectOptions: Array<{ id: number; displayName: string }> = [];

  loading = true;
  loadFailed: string | null = null;
  saving = false;
  saveError: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private workflowService: WorkflowService,
    private backendUserService: BackendUserService,
    private translate: TranslateService,
    private toastService: ToastService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef
  ) {}

  /** Title uses loaded name, then input fallback */
  get resolvedWorkflowTitle(): string {
    const fromDetail = this.loadedWorkflow?.workflowName?.trim();
    if (fromDetail) return fromDetail;
    const fromInput = this.workflowName?.trim();
    if (fromInput) return fromInput;
    return `#${this.workflowId}`;
  }

  get saveDisabled(): boolean {
    if (this.loading || !!this.loadFailed || this.saving) return true;
    if (this.triggerMode === 'role') {
      const n = (this.triggerRoleIds ?? []).filter(id => !!id && String(id).trim() !== '').length;
      return n === 0;
    }
    if (this.triggerMode === 'step') {
      const n = (this.triggerStepIds ?? []).filter(id => id != null && id > 0).length;
      return n === 0;
    }
    return false;
  }

  ngOnInit(): void {
    this.loadModalData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadModalData(): void {
    this.loading = true;
    this.loadFailed = null;
    this.saveError = null;
    this.cdr.markForCheck();

    forkJoin({
      roles: this.backendUserService.getAllRolesSimple(),
      detail: this.workflowService.getWorkflowAutoRejectTriggerConfig(this.workflowId)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ roles, detail }) => {
          this.roles = roles ?? [];
          this.loadedWorkflow = detail;
          this.loadTriggerConfig(detail);
          this.rebuildStepOptions();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.loadFailed = ErrorHandler.extractErrorMessage(err, 'Failed to load workflow');
          this.configService.logError('Workflow triggers modal load failed', err);
          this.cdr.markForCheck();
        }
      });
  }

  loadTriggerConfig(wf: BackendWorkflowDto | null): void {
    if (!wf) {
      this.triggerMode = 'none';
      this.triggerRoleIds = [];
      this.triggerStepIds = [];
      return;
    }
    const mode = wf.autoRejectTriggerMode ?? AutoRejectTriggerMode.None;
    if (mode === AutoRejectTriggerMode.Role) {
      this.triggerMode = 'role';
      this.triggerRoleIds = [...(wf.autoRejectTriggerRoleIds ?? []).filter(Boolean)];
      this.triggerStepIds = [];
    } else if (mode === AutoRejectTriggerMode.Step) {
      this.triggerMode = 'step';
      this.triggerStepIds = [...(wf.autoRejectTriggerStepIds ?? []).filter(id => id != null)];
      this.triggerRoleIds = [];
    } else if (mode === AutoRejectTriggerMode.Disabled) {
      this.triggerMode = 'disabled';
      this.triggerRoleIds = [];
      this.triggerStepIds = [];
    } else {
      this.triggerMode = 'none';
      this.triggerRoleIds = [];
      this.triggerStepIds = [];
    }
  }

  private rebuildStepOptions(): void {
    const steps = this.loadedWorkflow?.workflowSteps ?? [];
    const sorted = [...steps].sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));
    this.stepSelectOptions = sorted.map(s => ({
      id: s.id,
      displayName: this.formatStepLabel(s)
    }));
  }

  private formatStepLabel(s: WorkflowStepDto): string {
    const lang = getCurrentLang(this.translate);
    const role = this.roles.find(r => r.id === s.applicationRoleId);
    const roleName =
      role != null
        ? lang === 'ar'
          ? role.nameAr || role.name || s.applicationRoleId
          : role.nameEn || role.name || s.applicationRoleId
        : s.applicationRoleName || s.applicationRoleId;
    const ordKey = this.ordinalKey(s.stepOrder);
    const orderLabel = ordKey ? this.translate.instant(ordKey) : String(s.stepOrder ?? '');
    return `${orderLabel} — ${roleName}`;
  }

  private ordinalKey(n: number): string | null {
    const map: Record<number, string> = {
      1: 'common.ordinals.first',
      2: 'common.ordinals.second',
      3: 'common.ordinals.third',
      4: 'common.ordinals.fourth',
      5: 'common.ordinals.fifth',
      6: 'common.ordinals.sixth',
      7: 'common.ordinals.seventh',
      8: 'common.ordinals.eighth',
      9: 'common.ordinals.ninth',
      10: 'common.ordinals.tenth'
    };
    return map[n] ?? null;
  }

  onTriggerModeChange(): void {
    if (this.triggerMode === 'role') {
      this.triggerStepIds = [];
    } else if (this.triggerMode === 'step') {
      this.triggerRoleIds = [];
    } else if (this.triggerMode === 'disabled') {
      this.triggerRoleIds = [];
      this.triggerStepIds = [];
    } else {
      this.triggerRoleIds = [];
      this.triggerStepIds = [];
    }
    this.saveError = null;
    this.roleDd?.closePanel();
    this.stepDd?.closePanel();
    this.cdr.markForCheck();
  }

  onExclusiveDropdownOpened(source: 'role' | 'step', isOpen: boolean): void {
    if (!isOpen) return;
    if (source !== 'role') this.roleDd?.closePanel();
    if (source !== 'step') this.stepDd?.closePanel();
  }

  dismiss(): void {
    this.closed.emit(false);
  }

  save(): void {
    if (!this.loadedWorkflow || this.loadFailed || this.saveDisabled) return;

    this.saveError = null;
    this.cdr.markForCheck();

    const rolePayload =
      this.triggerMode === 'role'
        ? [...new Set((this.triggerRoleIds ?? []).filter(Boolean).map(r => String(r).trim()))]
        : [];
    const stepPayload =
      this.triggerMode === 'step'
        ? [...new Set((this.triggerStepIds ?? []).filter(id => id != null && id > 0))]
        : [];

    this.saving = true;
    this.cdr.markForCheck();

    this.workflowService
      .updateWorkflowAutoRejectTriggers(this.workflowId, {
        mode:
          this.triggerMode === 'none'
            ? AutoRejectTriggerMode.None
            : this.triggerMode === 'role'
              ? AutoRejectTriggerMode.Role
              : this.triggerMode === 'step'
                ? AutoRejectTriggerMode.Step
                : AutoRejectTriggerMode.Disabled,
        triggerRoleIds: rolePayload,
        triggerStepIds: stepPayload
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.cdr.markForCheck();
          this.translate
            .get(['toast.success', 'workflow.autoRejectTriggersSaved'])
            .pipe(takeUntil(this.destroy$))
            .subscribe((t: TranslationMap) => {
              this.toastService.success(t['workflow.autoRejectTriggersSaved'], t['toast.success']);
            });
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.saving = false;
          this.saveError = ErrorHandler.extractErrorMessage(err, 'Failed to update triggers');
          this.cdr.markForCheck();
        }
      });
  }
}

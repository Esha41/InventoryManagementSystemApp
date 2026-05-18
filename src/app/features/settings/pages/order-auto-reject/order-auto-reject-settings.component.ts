import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { ButtonComponent } from '@components/button/button.component';
import { ErrorStateComponent } from '@components/index';
import { RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import {
  OrderAutoRejectSettingsService,
  UpdateOrderAutoRejectSettingsDto
} from '@settings/services/order-auto-reject-settings.service';
import { OrderAutoRejectWorkflowTriggersPanelComponent } from './components/workflow-triggers-panel/order-auto-reject-workflow-triggers-panel.component';

/** Preset crons (5-field, standard). Backend validates with the same format. */
interface OrderAutoRejectScanSchedulePreset {
  cron: string;
  labelKey: string;
}

@Component({
  selector: 'app-order-auto-reject-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TranslateModule, CardComponent, DropdownComponent, ButtonComponent, ErrorStateComponent, OrderAutoRejectWorkflowTriggersPanelComponent],
  templateUrl: './order-auto-reject-settings.component.html',
  styleUrl: './order-auto-reject-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderAutoRejectSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  /** Value for the "Custom" row in the schedule dropdown (not a valid cron by itself). */
  readonly customScheduleValue = '__custom__';

  readonly scanSchedulePresets: OrderAutoRejectScanSchedulePreset[] = [
    { cron: '*/15 * * * *', labelKey: 'orderAutoRejectSettings.scheduleEvery15Min' },
    { cron: '*/30 * * * *', labelKey: 'orderAutoRejectSettings.scheduleEvery30Min' },
    { cron: '0 * * * *', labelKey: 'orderAutoRejectSettings.scheduleHourly' },
    { cron: '0 */6 * * *', labelKey: 'orderAutoRejectSettings.scheduleEvery6Hours' },
    { cron: '0 0 * * *', labelKey: 'orderAutoRejectSettings.scheduleDaily' },
  ];

  /** Options for shared schedule dropdown (`label` keys are translated via `translateLabels`). */
  scanScheduleDropdownOptions: DropdownOption<string>[] = [];

  form!: FormGroup;
  roles: RoleDto[] = [];
  isLoadingRoles = false;
  isLoadingSettings = false;
  isSaving = false;
  errorMessage = '';

  /** Editable list synced on save (days before auto-reject to send reminders). */
  reminderLeadDaysList: number[] = [];
  newLeadDayInput = '';

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private translateService: TranslateService,
    private toastService: ToastService,
    private backendUserService: BackendUserService,
    private settingsService: OrderAutoRejectSettingsService
  ) {}

  ngOnInit(): void {
    this.scanScheduleDropdownOptions = [
      ...this.scanSchedulePresets.map((p) => ({ label: p.labelKey, value: p.cron })),
      { label: 'orderAutoRejectSettings.scheduleCustom', value: this.customScheduleValue },
    ];

    this.form = this.fb.group({
      thresholdDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
      scanCron: ['0 * * * *', Validators.required],
      scanSchedulePreset: ['0 * * * *'],
      isEnabled: [true],
      notifyRequester: [true],
      notifyRoleIds: [[] as string[]],
    });

    this.form
      .get('scanSchedulePreset')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((preset) => {
        if (preset && preset !== this.customScheduleValue) {
          this.form.patchValue({ scanCron: preset }, { emitEvent: false });
        }
        this.cdr.markForCheck();
      });

    this.loadRoles();
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  addLeadDay(): void {
    const v = parseInt(this.newLeadDayInput, 10);
    const th = this.form.get('thresholdDays')?.value as number;
    if (Number.isNaN(v) || v < 1 || v >= th) {
      return;
    }
    if (!this.reminderLeadDaysList.includes(v)) {
      this.reminderLeadDaysList = [...this.reminderLeadDaysList, v].sort((a, b) => b - a);
    }
    this.newLeadDayInput = '';
    this.cdr.markForCheck();
  }

  removeLeadDay(day: number): void {
    this.reminderLeadDaysList = this.reminderLeadDaysList.filter(d => d !== day);
    this.cdr.markForCheck();
  }

  private loadRoles(): void {
    this.isLoadingRoles = true;
    this.backendUserService.getAllRolesSimple().pipe(takeUntil(this.destroy$)).subscribe({
      next: (roles) => {
        this.roles = roles;
        this.isLoadingRoles = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.isLoadingRoles = false;
        this.errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load roles');
        this.cdr.markForCheck();
      }
    });
  }

  private loadSettings(): void {
    this.isLoadingSettings = true;
    this.settingsService.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.reminderLeadDaysList = [...(data.reminderLeadDays ?? [])].sort((a, b) => b - a);
        const cron = (data.scanCron ?? '').trim() || '0 * * * *';
        const presetMatch = this.scanSchedulePresets.some((p) => p.cron === cron);
        this.form.patchValue(
          {
            thresholdDays: data.thresholdDays,
            scanCron: cron,
            scanSchedulePreset: presetMatch ? cron : this.customScheduleValue,
            isEnabled: data.isEnabled,
            notifyRequester: data.notifyRequester,
            notifyRoleIds: (data.notifyRoles ?? []).map((r) => r.id),
          },
          { emitEvent: false }
        );
        this.isLoadingSettings = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.isLoadingSettings = false;
        this.errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load settings');
        this.cdr.markForCheck();
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    const raw = this.form.getRawValue();
    const scanCron =
      raw.scanSchedulePreset === this.customScheduleValue
        ? String(raw.scanCron ?? '').trim()
        : String(raw.scanSchedulePreset ?? '').trim();
    const dto: UpdateOrderAutoRejectSettingsDto = {
      thresholdDays: raw.thresholdDays,
      scanCron,
      isEnabled: raw.isEnabled,
      notifyRequester: raw.notifyRequester,
      reminderLeadDays: [...this.reminderLeadDaysList],
      notifyRoleIds: Array.isArray(raw.notifyRoleIds) ? raw.notifyRoleIds : [],
    };
    this.settingsService.updateSettings(dto).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isSaving = false;
        this.cdr.markForCheck();
        this.translateService.get(['toast.success', 'orderAutoRejectSettings.savedSuccess'])
          .pipe(takeUntil(this.destroy$)).subscribe(t => {
            this.toastService.success(t['orderAutoRejectSettings.savedSuccess'], t['toast.success']);
          });
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.cdr.markForCheck();
        this.translateService.get(['toast.error', 'orderAutoRejectSettings.saveFailed'])
          .pipe(takeUntil(this.destroy$)).subscribe(t => {
            this.toastService.error(
              ErrorHandler.extractErrorMessage(error, t['orderAutoRejectSettings.saveFailed']),
              t['toast.error']
            );
          });
      }
    });
  }
}

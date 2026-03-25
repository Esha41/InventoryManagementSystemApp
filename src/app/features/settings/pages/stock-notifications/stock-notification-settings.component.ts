import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ErrorStateComponent } from '@components/index'; //tbc
import { CardComponent } from '@components/card/card.component';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { BackendUserDto, RoleDto } from '@models/backend-user.model';
import { BackendUserService } from '@services/backend-user.service';
import { ToastService } from '@services/toast.service';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { PaginatedList } from '@models/api-response.model';
import { StockNotificationService, LowStockNotificationScheduleDto, LowStockNotificationSettingsDto } from '@settings/services/stock-notification.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { AppDatePipe } from '@shared/pipes/app-date.pipe';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-stock-notification-settings',
  standalone: true,
  imports: [TranslateModule, ErrorStateComponent, CardComponent, DropdownComponent, ButtonComponent, FormsModule, CommonModule, ReactiveFormsModule],
  templateUrl: './stock-notification-settings.component.html',
  styleUrl: './stock-notification-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockNotificationSettingsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly appDatePipe = new AppDatePipe();

  roles: RoleDto[] = [];
  users: BackendUserDto[] = [];
  selectedRoles: string[] = [];
  selectedUsers: string[] = [];
  schedule: Date | null = null;
  isLoadingRoles = false;
  isLoadingUsers = false;
  isLoadingSchedule = false;
  isLoadingSelectedRecipients = false;
  errorMessage = '';
  recipientsForm!: FormGroup;
  scheduleForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private backendUserService: BackendUserService,
    private toastService: ToastService,
    private stockNotificationService: StockNotificationService,
    private translateService: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
  }
  ngOnInit(): void {
    this.initializeRecipientsForm();
    this.initializeScheduleForm();
    this.loadRoles();
    this.loadUsers();
    this.loadSelectedRecipients();
    this.loadSchedule();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeRecipientsForm() {
    this.recipientsForm = this.fb.group(
      {
        rolesIds: [[]],
        usersIds: [[]],
      },
    )
  }

  private initializeScheduleForm() {
    this.scheduleForm = this.fb.group({
      dateTime: "",
    })
  }
  private loadRoles(): void {
    this.isLoadingRoles = true;
    this.backendUserService.getAllRolesSimple().pipe(takeUntil(this.destroy$)).subscribe({
      next: (roles: RoleDto[]) => {
        this.roles = roles;
        this.isLoadingRoles = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Failed to load roles from API:', error);
        this.isLoadingRoles = false;
        this.errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load roles');
        this.cdr.markForCheck();
      }
    });
  }

  private loadUsers(): void {
    this.isLoadingUsers = true;
    this.backendUserService.getUsers({ page: 1, pageSize: 1000 }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: PaginatedList<BackendUserDto>) => {
        this.users = response.items || [];
        this.isLoadingUsers = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.isLoadingUsers = false;
        this.errorMessage = 'Failed to load users: ' + ErrorHandler.extractErrorMessage(error, 'Unknown error');
        this.cdr.markForCheck();
      }
    });
  }

  private loadSelectedRecipients(): void {
    this.isLoadingSelectedRecipients = true;
    this.stockNotificationService.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.selectedRoles = data.roles ?? [];
        this.selectedUsers = data.users ?? [];
        this.recipientsForm.patchValue({
          rolesIds: this.selectedRoles ?? [],
          usersIds: this.selectedUsers ?? [],
        })
        this.isLoadingSelectedRecipients = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        console.error('Failed to load selected roles and users from API:', error);
        this.errorMessage = ErrorHandler.extractErrorMessage(error, 'Failed to load selected roles and users');
        this.isLoadingSelectedRecipients = false;
        this.cdr.markForCheck();
      }
    });
  }

  private updateSelectedRecipients(dto: LowStockNotificationSettingsDto): void {
    this.stockNotificationService.updateSettings(dto).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.cdr.markForCheck();
        this.translateService.get(['toast.success', 'stockNotificationSettings.recipientsSavedSuccess']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
          this.toastService.success(
            translations['stockNotificationSettings.recipientsSavedSuccess'],
            translations['toast.success']
          );
        });
      },
      error: (error: unknown) => {
        this.cdr.markForCheck();
        this.translateService.get(['toast.error', 'stockNotificationSettings.recipientsSaveFailed']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
          this.toastService.error(
            ErrorHandler.extractErrorMessage(error, translations['stockNotificationSettings.recipientsSaveFailed']),
            translations['toast.error']
          );
        });
      }
    });
  }

  private updateSchedule(dateTime: LowStockNotificationScheduleDto): void {
    this.stockNotificationService.updateSchedule(dateTime).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.cdr.markForCheck();
        this.translateService.get(['toast.success', 'stockNotificationSettings.scheduleSavedSuccess']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
          this.toastService.success(
            translations['stockNotificationSettings.scheduleSavedSuccess'],
            translations['toast.success']
          );
        });
      },
      error: (error: unknown) => {
        this.cdr.markForCheck();
        this.translateService.get(['toast.error', 'stockNotificationSettings.scheduleSaveFailed']).pipe(takeUntil(this.destroy$)).subscribe(translations => {
          this.toastService.error(
            ErrorHandler.extractErrorMessage(error, translations['stockNotificationSettings.scheduleSaveFailed']),
            translations['toast.error']
          );
        });
      }
    });
  }



  openDateTimePicker(input: HTMLInputElement | null): void {
    if (!input) return;
    if (input.showPicker) {
      input.showPicker();
      return;
    }
    input.focus();
  }

  /**
   * Display `dd/mm/yyyy hh:mm AM/PM` for datetime-local values.
   * datetime-local value is `YYYY-MM-DDTHH:mm`.
   */
  getDateTimeDisplay(dateTimeValue?: string | null): string {
    if (!dateTimeValue) return '';

    const match = dateTimeValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return dateTimeValue;

    const [, yyyy, mm, dd, hhStr, min] = match;

    // Use shared pipe for the date portion (dd/MM/yyyy) to match the app format.
    const dateObj = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
    const datePart = this.appDatePipe.transform(dateObj);
    if (!datePart || datePart === 'N/A') return '';

    const hour24 = parseInt(hhStr, 10);
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = (hour24 % 12) || 12;
    const hour12Str = String(hour12).padStart(2, '0');

    return `${datePart} ${hour12Str}:${min} ${ampm}`;
  }

  private loadSchedule(): void {
    this.isLoadingSchedule = true;
    this.stockNotificationService.getSchedule<string | null>().subscribe({
      next: (scheduleValue) => {
        if (scheduleValue && typeof scheduleValue === 'string') {
          // Backend returns date string like "2026-01-20T12:47:00"
          // Extract just the date and time parts for datetime-local input (YYYY-MM-DDTHH:mm)
          const dateStr = scheduleValue.slice(0, 16);
          this.scheduleForm.patchValue({ dateTime: dateStr });
        } else {
          this.scheduleForm.patchValue({ dateTime: '' });
        }
        this.isLoadingSchedule = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.isLoadingSchedule = false;
        this.errorMessage = 'Failed to load schedule: ' + ErrorHandler.extractErrorMessage(error, 'Unknown error');
        this.cdr.markForCheck();
      }
    });
  }

  onSubmitRecipientsForm(): void {
    const formValue = this.recipientsForm.getRawValue();
    const dto: LowStockNotificationSettingsDto = {
      roles: formValue.rolesIds,
      users: formValue.usersIds,
    }
    this.updateSelectedRecipients(dto)
  }

  onSubmitScheduleForm(): void {
    const formValue = this.scheduleForm.getRawValue();
    if (!formValue.dateTime) {
      this.errorMessage = 'Please select a valid schedule time';
      return;
    }
    // Send the datetime string directly with timezone offset (not as Date object)
    // datetime-local gives us "2026-01-20T15:47" (local time, no timezone)
    // Append timezone offset so backend receives and parses the exact local time
    const timezoneOffset = -new Date().getTimezoneOffset(); // Get offset in minutes
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60).toString().padStart(2, '0');
    const offsetMinutes = (Math.abs(timezoneOffset) % 60).toString().padStart(2, '0');
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const offsetString = `${offsetSign}${offsetHours}:${offsetMinutes}`;

    // Create ISO string with timezone: "2026-01-20T15:47:00+03:00"
    // Send as string so backend parses it correctly with timezone info
    const dateTimeWithOffset = `${formValue.dateTime}:00${offsetString}`;

    const dto: LowStockNotificationScheduleDto = {
      scheduleTime: dateTimeWithOffset // string | Date - backend parses ISO string to DateTime
    };
    this.updateSchedule(dto)
  }

}

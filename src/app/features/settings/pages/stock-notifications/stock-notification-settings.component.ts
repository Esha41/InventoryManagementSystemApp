import { Component } from '@angular/core';
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

@Component({
  selector: 'app-stock-notification-settings',
  standalone: true,
  imports: [TranslateModule, ErrorStateComponent, CardComponent, DropdownComponent, ButtonComponent, FormsModule, CommonModule, ReactiveFormsModule],
  templateUrl: './stock-notification-settings.component.html',
  styleUrl: './stock-notification-settings.component.css'
})
export class StockNotificationSettingsComponent {
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
    private translateService: TranslateService
  ) {
  }
  ngOnInit(): void {
    this.loadRoles();
    this.loadUsers();
    this.loadSelectedRecipients();
    this.loadSchedule();
    this.initializeRecipientsForm();
    this.initializeScheduleForm();
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
    this.backendUserService.getAllRolesSimple().subscribe({
      next: (roles: RoleDto[]) => {
        this.roles = roles;
        this.isLoadingRoles = false;
      },
      error: (error: any) => {
        console.error('Failed to load roles from API:', error);
        this.isLoadingRoles = false;
        this.errorMessage = 'Failed to load roles';
      }
    });
  }

  private loadUsers(): void {
    this.isLoadingUsers = true;
    this.backendUserService.getUsers({ page: 1, pageSize: 1000 }).subscribe({
      next: (response: PaginatedList<BackendUserDto>) => {
        this.users = response.items || [];
        this.isLoadingUsers = false;
      },
      error: (error) => {
        this.isLoadingUsers = false;
        this.errorMessage = 'Failed to load users: ' + (error.message || 'Unknown error');
      }
    });
  }

  private loadSelectedRecipients(): void {
    this.isLoadingSelectedRecipients = true;
    this.stockNotificationService.getSettings().subscribe({
      next: (data) => {
        this.selectedRoles = data.data.roles;
        this.selectedUsers = data.data.users;
        this.recipientsForm.patchValue({
          rolesIds: this.selectedRoles ?? [],
          usersIds: this.selectedUsers ?? [],
        })
        this.isLoadingSelectedRecipients = false;
      },
      error: (error: any) => {
        console.error('Failed to load selected roles and users from API:', error);
        this.errorMessage = 'Failed to load selected roles and users';
        this.isLoadingSelectedRecipients = false;
      }
    });
  }

  private updateSelectedRecipients(dto: LowStockNotificationSettingsDto): void {

    const operation = this.stockNotificationService.updateSettings(dto)

    operation.subscribe({
      next: (item) => {
        this.translateService.get(['toast.success', 'stockNotificationSettings.recipientsSavedSuccess']).subscribe(translations => {
          this.toastService.success(
            translations['stockNotificationSettings.recipientsSavedSuccess'],
            translations['toast.success']
          );
        });
      },
      error: (error) => {

        this.translateService.get(['toast.error', 'stockNotificationSettings.recipientsSaveFailed']).subscribe(translations => {
          this.toastService.error(
            error.message || translations['stockNotificationSettings.recipientsSaveFailed'],
            translations['toast.error']
          );
        });
      }
    });
  }

  private updateSchedule(dateTime: LowStockNotificationScheduleDto) {
    const operation = this.stockNotificationService.updateSchedule(dateTime)

    operation.subscribe({
      next: (item) => {
        this.translateService.get(['toast.success', 'stockNotificationSettings.scheduleSavedSuccess']).subscribe(translations => {
          this.toastService.success(
            translations['stockNotificationSettings.scheduleSavedSuccess'],
            translations['toast.success']
          );
        });
      },
      error: (error) => {

        this.translateService.get(['toast.error', 'stockNotificationSettings.scheduleSaveFailed']).subscribe(translations => {
          this.toastService.error(
            error.message ||
            translations['stockNotificationSettings.scheduleSaveFailed'],
            translations['toast.error']
          );
        });
      }
    });
  }



  private loadSchedule(): void {
    this.isLoadingSchedule = true
    this.stockNotificationService.getSchedule<string | null>().subscribe({
      next: (data) => {
        if (data.data) {
          // Backend returns date string like "2026-01-20T12:47:00"
          // Extract just the date and time parts for datetime-local input (YYYY-MM-DDTHH:mm)
          // Use the string directly without any conversion
          const dateStr = (data.data as string).slice(0, 16);
          this.scheduleForm.patchValue({ dateTime: dateStr });
        } else {
          this.scheduleForm.patchValue({ dateTime: '' });
        }
        this.isLoadingSchedule = false;
      },
      error: (error) => {
        this.isLoadingSchedule = false;
        this.errorMessage = 'Failed to load schedule: ' + (error.message || 'Unknown error');
      }

    })
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
      scheduleTime: dateTimeWithOffset as any // Send as string, backend will parse to DateTime
    }
    this.updateSchedule(dto)
  }

}

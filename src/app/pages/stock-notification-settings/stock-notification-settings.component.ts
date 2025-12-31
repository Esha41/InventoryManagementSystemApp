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
import { LowStockNotificationSettingsDto, LowStockNotificationScheduleDto, StockNotificationService } from '@services/stock-notification.service';

@Component({
  selector: 'app-stock-notification-settings',
  standalone: true,
  imports: [ TranslateModule, ErrorStateComponent, CardComponent, DropdownComponent, ButtonComponent, FormsModule, CommonModule, ReactiveFormsModule ],
  templateUrl: './stock-notification-settings.component.html',
  styleUrl: './stock-notification-settings.component.css'
})
export class StockNotificationSettingsComponent {
  roles: RoleDto[] = [];
  users: BackendUserDto[] = [];
  selectedRoles: string[] = [];
  selectedUsers: string[] = [];
  schedule: string = ""; 
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
      {rolesIds: [[]],
      usersIds: [[]],},
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
    this.backendUserService.getUsers().subscribe({ 
      next: (users) => {
        this.users = users;
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
        this.translateService.get(['toast.success','stockNotificationSettings.recipientsSavedSuccess']).subscribe(translations => {
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
          this.translateService.get(['toast.success','stockNotificationSettings.scheduleSavedSuccess']).subscribe(translations => {
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
    this.stockNotificationService.getSchedule().subscribe({
      next: (data) => {
        this.schedule = String(data.data);
        this.scheduleForm.patchValue({dateTime: this.convertCronToISO(this.schedule)})
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
    const dto: LowStockNotificationScheduleDto = {
      scheduleTime: formValue.dateTime
    }
    this.updateSchedule(dto)
  }

  private convertCronToISO(cronExpression: string) {
      // Parse the cron expression (e.g., "50 6 * * *")
      const parts = cronExpression.split(' ');
      const minute = parts[0];
      let hour = parts[1];

      // Pad the hour to ensure it always has two digits (e.g., "06" instead of "6")
      hour = String(hour).padStart(2, '0');

      // Get today's date in 'yyyy-MM-dd' format
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
      const day = String(today.getDate()).padStart(2, '0');

      // Construct the ISO 8601 formatted date
      const formattedDate = `${year}-${month}-${day}T${hour}:${minute}`;

      return formattedDate;
    };
}

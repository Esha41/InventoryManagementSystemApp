import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { UserManagementComponent } from './components/user-management/user-management.component';

/**
 * Manage Users Component
 * Shell page for managing system users.
 */
@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    UserManagementComponent
  ],
  templateUrl: './manage-users.component.html',
  styleUrls: ['./manage-users.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageUsersComponent {
}

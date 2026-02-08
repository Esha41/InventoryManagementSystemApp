import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { UserManagementComponent } from './components/user-management/user-management.component';

/**
 * Manage Admins Component
 * Component for managing system users
 */
@Component({
  selector: 'app-manage-admins',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    UserManagementComponent
  ],
  templateUrl: './manage-admins.component.html',
  styleUrls: ['./manage-admins.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageAdminsComponent {
}

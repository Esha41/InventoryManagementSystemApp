import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { LucideAngularModule, UserPlus, User as UserIcon, Database, Plus } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { LookupManagementComponent } from './components/lookup-management/lookup-management.component';

/**
 * Manage Admins Component
 * Thin orchestrator component that handles tab management between user and lookup management
 */
@Component({
  selector: 'app-manage-admins',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TranslateModule,
    UserManagementComponent,
    LookupManagementComponent
  ],
  templateUrl: './manage-admins.component.html',
  styleUrls: ['./manage-admins.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManageAdminsComponent implements OnInit, OnDestroy {
  readonly UserPlus = UserPlus;
  readonly UserIcon = UserIcon;
  readonly Database = Database;
  readonly Plus = Plus;

  // Tab management
  activeTab: 'users' | 'lookups' = 'users';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initializeTabFromQueryParams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Tab management
  setActiveTab(tab: 'users' | 'lookups'): void {
    this.activeTab = tab;
    this.updateQueryParams(tab);
    this.cdr.markForCheck();
  }

  private initializeTabFromQueryParams(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const tabParam = params['tab'];
        if (tabParam === 'lookups' || tabParam === 'users') {
          this.activeTab = tabParam;
          this.cdr.markForCheck();
        }
      });
  }

  private updateQueryParams(tab: 'users' | 'lookups'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }
}

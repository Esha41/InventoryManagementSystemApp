import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BackendAuthService } from '@services/backend-auth.service';
import { StorageService } from '@services/storage.service';
import { SwitchRoleModalService } from '@services/switch-role-modal.service';
import { RoleForSelection } from '@models/auth.model';
import { getDefaultLandingUrl } from '@core/utils/default-landing-route.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { RoleSelectionPanelComponent } from '@auth/components/role-selection-panel/role-selection-panel.component';

@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule, TranslateModule, RoleSelectionPanelComponent],
  templateUrl: './select-role.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectRoleComponent implements OnInit {
  roles: RoleForSelection[] = [];
  isLoading = false;
  error = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private backendAuth: BackendAuthService,
    private storageService: StorageService,
    private switchRoleModal: SwitchRoleModalService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }

  ngOnInit(): void {
    const isSwitchDeeplink = this.route.snapshot.queryParamMap.get('switch') === '1';
    if (isSwitchDeeplink) {
      if (this.backendAuth.isAuthenticated()) {
        void this.router.navigate(['/'], { replaceUrl: true }).then(() => {
          this.switchRoleModal.open();
        });
      } else {
        void this.router.navigate(['/auth/login']);
      }
      return;
    }

    const raw = this.storageService.get<string>('available_roles_json');
    try {
      this.roles = raw ? (JSON.parse(raw) as RoleForSelection[]) : [];
    } catch {
      this.roles = [];
    }
    if (!this.roles.length) {
      this.error = this.translate.instant('auth.selectRole.errors.noRoles');
    }
    this.cdr.markForCheck();
  }

  select(roleId: string): void {
    this.isLoading = true;
    this.error = '';
    this.cdr.markForCheck();
    this.backendAuth.selectRole(roleId, { switchWhileLoggedIn: false }).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        void this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth));
      },
      error: (err: unknown) => {
        this.isLoading = false;
        this.error = ErrorHandler.extractAndTranslateErrorMessage(
          err,
          this.translate.instant('auth.selectRole.errors.generic'),
          this.translate
        );
        this.cdr.markForCheck();
      }
    });
  }

  cancel(): void {
    this.storageService.remove('role_selection_token');
    this.storageService.remove('available_roles_json');
    void this.router.navigate(['/auth/login']);
  }
}

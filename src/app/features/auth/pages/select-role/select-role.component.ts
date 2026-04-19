import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Users } from 'lucide-angular';
import { BackendAuthService } from '@services/backend-auth.service';
import { StorageService } from '@services/storage.service';
import { UserContextService } from '@services/user-context.service';
import { RoleForSelection } from '@models/auth.model';
import { getDefaultLandingUrl } from '@core/utils/default-landing-route.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { ErrorHandler } from '@utils/error-handler.utils';

@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './select-role.component.html',
  styleUrls: ['./select-role.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectRoleComponent implements OnInit {
  readonly Users = Users;

  roles: RoleForSelection[] = [];
  isSwitchMode = false;
  isLoading = false;
  error = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private backendAuth: BackendAuthService,
    private storageService: StorageService,
    private userContextService: UserContextService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }

  ngOnInit(): void {
    this.isSwitchMode = this.route.snapshot.queryParamMap.get('switch') === '1';
    if (this.isSwitchMode) {
      this.userContextService.getCurrentUserDetails(true).subscribe({
        next: details => {
          this.roles = (details?.roles ?? []).map(r => ({
            id: r.id,
            name: r.name,
            nameAr: r.nameAr
          }));
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.error = ErrorHandler.extractAndTranslateErrorMessage(
            err,
            this.translate.instant('auth.selectRole.errors.loadRolesFailed'),
            this.translate
          );
          this.cdr.markForCheck();
        }
      });
    } else {
      const raw = this.storageService.get<string>('available_roles_json');
      try {
        this.roles = raw ? (JSON.parse(raw) as RoleForSelection[]) : [];
      } catch {
        this.roles = [];
      }
      if (!this.roles.length) {
        this.error = this.translate.instant('auth.selectRole.errors.noRoles');
      }
    }
  }

  select(roleId: string): void {
    this.isLoading = true;
    this.error = '';
    this.cdr.markForCheck();
    this.backendAuth.selectRole(roleId, { switchWhileLoggedIn: this.isSwitchMode }).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth));
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

  roleLabel(r: RoleForSelection): string {
    return getLocalizedName({ name: r.name, nameAr: r.nameAr }, getCurrentLang(this.translate)) || r.name;
  }

  cancel(): void {
    if (this.isSwitchMode) {
      void this.router.navigate(['/']);
    } else {
      this.storageService.remove('role_selection_token');
      this.storageService.remove('available_roles_json');
      void this.router.navigate(['/auth/login']);
    }
  }
}

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { ModalComponent } from '@components/modal/modal.component';
import { RoleSelectionPanelComponent } from '@auth/components/role-selection-panel/role-selection-panel.component';
import { BackendAuthService } from '@services/backend-auth.service';
import { UserContextService } from '@services/user-context.service';
import { SwitchRoleModalService } from './switch-role-modal.service';
import { ToastService } from '@services/toast.service';
import { RoleForSelection } from '@models/auth.model';
import { getDefaultLandingUrl } from '@core/utils/default-landing-route.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

@Component({
  selector: 'app-switch-role-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalComponent, RoleSelectionPanelComponent],
  templateUrl: './switch-role-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SwitchRoleModalComponent implements OnInit, OnDestroy {
  isOpen = false;
  roles: RoleForSelection[] = [];
  listLoading = false;
  submitLoading = false;
  error = '';

  private destroy$ = new Subject<void>();

  constructor(
    private switchRoleModal: SwitchRoleModalService,
    private userContextService: UserContextService,
    private backendAuth: BackendAuthService,
    private router: Router,
    private translate: TranslateService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.switchRoleModal.open$.pipe(takeUntil(this.destroy$)).subscribe(open => {
      this.isOpen = open;
      if (open) {
        this.resetAndLoadRoles();
      } else {
        this.error = '';
        this.roles = [];
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetAndLoadRoles(): void {
    this.error = '';
    this.roles = [];
    this.listLoading = true;
    this.submitLoading = false;
    this.cdr.markForCheck();

    this.userContextService.getCurrentUserDetails(true).subscribe({
      next: details => {
        this.listLoading = false;
        this.roles = (details?.roles ?? []).map(r => ({
          id: r.id,
          name: r.name,
          nameAr: r.nameAr
        }));
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.listLoading = false;
        this.error = ErrorHandler.extractAndTranslateErrorMessage(
          err,
          this.translate.instant('auth.selectRole.errors.loadRolesFailed'),
          this.translate
        );
        this.cdr.markForCheck();
      }
    });
  }

  onRolePick(roleId: string): void {
    this.submitLoading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.backendAuth.selectRole(roleId, { switchWhileLoggedIn: true }).subscribe({
      next: () => {
        this.submitLoading = false;
        const picked = this.roles.find(r => String(r.id) === String(roleId));
        const roleLabel =
          picked != null
            ? getLocalizedName({ name: picked.name, nameAr: picked.nameAr }, getCurrentLang(this.translate)) ||
              picked.name
            : roleId;
        this.toastService.success(
          this.translate.instant('auth.selectRole.roleActiveMessage', { role: roleLabel }),
          this.translate.instant('auth.selectRole.roleActiveTitle')
        );
        this.switchRoleModal.close();
        this.cdr.markForCheck();
        void this.router.navigateByUrl(getDefaultLandingUrl(this.backendAuth));
      },
      error: (err: unknown) => {
        this.submitLoading = false;
        this.error = ErrorHandler.extractAndTranslateErrorMessage(
          err,
          this.translate.instant('auth.selectRole.errors.generic'),
          this.translate
        );
        this.cdr.markForCheck();
      }
    });
  }

  onModalClosed(): void {
    this.switchRoleModal.close();
  }

  onPanelCancel(): void {
    this.switchRoleModal.close();
  }
}

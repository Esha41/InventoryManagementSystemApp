import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Users } from 'lucide-angular';
import { RoleForSelection } from '@models/auth.model';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';

/** Shared UI for picking a role (full auth page or compact modal body). */
@Component({
  selector: 'app-role-selection-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule],
  templateUrl: './role-selection-panel.component.html',
  styleUrls: ['./role-selection-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleSelectionPanelComponent {
  readonly Users = Users;

  /** Full = icon + title + hint (post-login page). Compact = hint only under caller-provided title. */
  @Input() layout: 'full' | 'compact' = 'full';

  /** i18n key for explanatory text (e.g. post-login vs switch-role modal). */
  @Input() hintKey = 'auth.selectRole.hint';

  @Input() roles: RoleForSelection[] = [];
  /** Loading role list from API */
  @Input() listLoading = false;
  /** Submitting selected role */
  @Input() submitLoading = false;
  @Input() error = '';

  /** Cancel shows “Back to sign in”; false shows “Cancel” (in-app switch). */
  @Input() isPostLoginFlow = true;

  @Output() rolePick = new EventEmitter<string>();
  @Output() roleSelectionDismissed = new EventEmitter<void>();

  constructor(
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(() => this.cdr.markForCheck());
  }

  get isBusy(): boolean {
    return this.listLoading || this.submitLoading;
  }

  roleLabel(r: RoleForSelection): string {
    return getLocalizedName({ name: r.name, nameAr: r.nameAr }, getCurrentLang(this.translate)) || r.name;
  }

  onPick(roleId: string): void {
    this.rolePick.emit(roleId);
  }

  onCancel(): void {
    this.roleSelectionDismissed.emit();
  }
}

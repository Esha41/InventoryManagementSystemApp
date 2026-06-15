import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';
import {
  buildAmmunitionCaliberContextFromRequestItem,
  getWeaponAssociationDisplay,
  isCatalogWeaponAssociation,
  isIncompatibleWeaponAssociation,
  isWeaponAssociationCaliberCompatible,
  shouldShowWeaponAssociationCompatibilityBadge,
  type CatalogCaliberContext,
  type WeaponAssociationDisplay,
  type WeaponAssociationLabelItem
} from '@utils/weapon-association-label.utils';
import { getCurrentLang } from '@utils/localization.utils';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-weapon-association-list',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './weapon-association-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeaponAssociationListComponent implements OnInit, OnDestroy {
  @Input() associations: RequestManagementRequestItemWeaponAssociationDto[] | null | undefined;
  @Input() compact = false;
  /** Horizontal row with wrap (e.g. workflow approval table); default stacks vertically */
  @Input() inline = false;
  @Input() linkable = false;
  @Input() customLabelKey = 'newIssueRequest.weaponAssociation.custom';
  /** Parent ammunition line caliber context for compatibility labels. */
  @Input() ammunitionCaliber: CatalogCaliberContext | null = null;
  /** Parent request item (used to resolve ammo caliber when ammunitionCaliber is not passed). */
  @Input() requestItem: WeaponAssociationLabelItem | null = null;
  @Input() showCompatibilityLabels = false;
  @Output() catalogAssociationClick = new EventEmitter<RequestManagementRequestItemWeaponAssociationDto>();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly translate: TranslateService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getAssociationDisplay(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): WeaponAssociationDisplay {
    return getWeaponAssociationDisplay(association, getCurrentLang(this.translate));
  }

  isCatalogAssociation(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): boolean {
    return isCatalogWeaponAssociation(association);
  }

  effectiveAmmunitionCaliber(): CatalogCaliberContext | null {
    return this.ammunitionCaliber ?? buildAmmunitionCaliberContextFromRequestItem(this.requestItem);
  }

  shouldShowCompatibilityBadge(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): boolean {
    return (
      this.showCompatibilityLabels &&
      shouldShowWeaponAssociationCompatibilityBadge(this.effectiveAmmunitionCaliber(), association)
    );
  }

  isAssociationCaliberCompatible(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): boolean {
    return isWeaponAssociationCaliberCompatible(this.effectiveAmmunitionCaliber(), association);
  }

  isAssociationIncompatible(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): boolean {
    const item = this.requestItem;
    if (item) {
      return isIncompatibleWeaponAssociation(item, association);
    }
    if (!this.showCompatibilityLabels) {
      return false;
    }
    return (
      shouldShowWeaponAssociationCompatibilityBadge(this.effectiveAmmunitionCaliber(), association) &&
      !isWeaponAssociationCaliberCompatible(this.effectiveAmmunitionCaliber(), association)
    );
  }

  incompatibleNameClass(association: RequestManagementRequestItemWeaponAssociationDto): string {
    return this.isAssociationIncompatible(association)
      ? 'text-amber-700 dark:text-amber-400 font-medium'
      : '';
  }

  incompatibleBulletClass(association: RequestManagementRequestItemWeaponAssociationDto): string {
    return this.isAssociationIncompatible(association)
      ? 'bg-amber-500'
      : 'bg-[var(--color-brand)]';
  }

  onAssociationClick(
    event: MouseEvent,
    association: RequestManagementRequestItemWeaponAssociationDto
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.catalogAssociationClick.emit(association);
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import type { RequestManagementRequestItemWeaponAssociationDto } from '@models/request-management-base.model';
import {
  getWeaponAssociationDisplay,
  isCatalogWeaponAssociation,
  type WeaponAssociationDisplay
} from '@utils/weapon-association-label.utils';
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
  @Input() linkable = false;
  @Input() customLabelKey = 'newIssueRequest.weaponAssociation.custom';
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
    return getWeaponAssociationDisplay(association);
  }

  isCatalogAssociation(
    association: RequestManagementRequestItemWeaponAssociationDto
  ): boolean {
    return isCatalogWeaponAssociation(association);
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

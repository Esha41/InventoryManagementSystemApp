import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ButtonComponent } from '@components/button/button.component';
import { AssetType, Asset } from '@models/asset-list.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { AssetPropertyAccessor } from '@utils/asset-property.utils';

@Component({
  selector: 'app-asset-view-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, ButtonComponent],
  templateUrl: './asset-view-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetViewModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() activeTab: AssetType = 'ammunition';
  @Input() selectedAsset: Asset | AmmunitionReadDto | WeaponDto | ExplosiveDto | null = null;
  
  @Output() closed = new EventEmitter<void>();

  readonly X = X;

  constructor(
    public propertyAccessor: AssetPropertyAccessor,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeTab'] || changes['selectedAsset']) {
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.closed.emit();
  }

  // Property accessors for template
  getAssetName = () => this.propertyAccessor.getAssetName(this.selectedAsset);
  getArmNumber = () => this.propertyAccessor.getArmNumber(this.selectedAsset);
  getCaseType = () => this.propertyAccessor.getCaseType(this.selectedAsset);
  getPropellant = () => this.propertyAccessor.getPropellant(this.selectedAsset);
  getCompatibility = () => this.propertyAccessor.getCompatibility(this.selectedAsset);
  getHazardDivision = () => this.propertyAccessor.getHazardDivision(this.selectedAsset);
  getPrimer = () => this.propertyAccessor.getPrimer(this.selectedAsset);
  getTotalWeight = () => this.propertyAccessor.getTotalWeight(this.selectedAsset);
  getBulletDiameter = () => this.propertyAccessor.getBulletDiameter(this.selectedAsset);
  getAmmunitionCaliber = () => this.propertyAccessor.getAmmunitionCaliber(this.selectedAsset);
  getCaliber = () => this.propertyAccessor.getCaliber(this.selectedAsset);
  getModel = () => this.propertyAccessor.getModel(this.selectedAsset);
  getYearOfManufacture = () => this.propertyAccessor.getYearOfManufacture(this.selectedAsset);
  getCountryOfManufacture = () => this.propertyAccessor.getCountryOfManufacture(this.selectedAsset);
  getCaliberUnit = () => this.propertyAccessor.getCaliberUnit(this.selectedAsset);
  getDistributionForWeapon = () => this.propertyAccessor.getDistributionForWeapon(this.selectedAsset);
  getUnNumberForWeapon = () => this.propertyAccessor.getUnNumberForWeapon(this.selectedAsset);
  getReferenceNoForWeapon = () => this.propertyAccessor.getReferenceNoForWeapon(this.selectedAsset);
  getClassificationForWeapon = () => this.propertyAccessor.getClassificationForWeapon(this.selectedAsset);
  getTypeForWeapon = () => this.propertyAccessor.getTypeForWeapon(this.selectedAsset);
  getNotesForWeapon = () => this.propertyAccessor.getNotesForWeapon(this.selectedAsset);
  getExplosiveTypeName = () => this.propertyAccessor.getExplosiveTypeName(this.selectedAsset);
  getUnNumber = () => this.propertyAccessor.getUnNumber(this.selectedAsset);
  getNetExplosiveQuantity = () => this.propertyAccessor.getNetExplosiveQuantity(this.selectedAsset);
  getPrice = () => this.propertyAccessor.getPrice(this.selectedAsset);
  getMinimumQuantity = () => this.propertyAccessor.getMinimumQuantity(this.selectedAsset);
  getCriticalQuantity = () => this.propertyAccessor.getCriticalQuantity(this.selectedAsset);
  getBatchNo = () => this.propertyAccessor.getBatchNo(this.selectedAsset);
  getExpiryDate = () => this.propertyAccessor.getExpiryDate(this.selectedAsset);
  getReadyForIssue = () => this.propertyAccessor.getReadyForIssue(this.selectedAsset);
  getDistribution = () => this.propertyAccessor.getDistribution(this.selectedAsset);
  getUnNumberForAmmunition = () => this.propertyAccessor.getUnNumberForAmmunition(this.selectedAsset);
  getReferenceNo = () => this.propertyAccessor.getReferenceNo(this.selectedAsset);
  getClassification = () => this.propertyAccessor.getClassification(this.selectedAsset);
  getType = () => this.propertyAccessor.getType(this.selectedAsset);
  getNotes = () => this.propertyAccessor.getNotes(this.selectedAsset);
  getUnit = () => this.propertyAccessor.getUnit(this.selectedAsset);
  getLinked = () => this.propertyAccessor.getLinked(this.selectedAsset);
  getNature = () => this.propertyAccessor.getNature(this.selectedAsset);
  getPrimaryPurpose = () => this.propertyAccessor.getPrimaryPurpose(this.selectedAsset);
  getProjectileColor = () => this.propertyAccessor.getProjectileColor(this.selectedAsset);
}

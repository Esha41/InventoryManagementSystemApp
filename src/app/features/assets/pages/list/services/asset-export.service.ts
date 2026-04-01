/**
 * Asset Export Service
 * Handles Excel export and template generation for assets
 */

import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ExcelExportService, ExcelColumn } from '@services/excel-export.service';
import { Asset, AssetType } from '@models/asset-list.model';
import { LookupDto } from '@models/ammunition.model';
import { getLookupDisplayName } from '@utils/asset-list.utils';

@Injectable({
  providedIn: 'root'
})
export class AssetExportService {
  constructor(
    private excelExportService: ExcelExportService,
    private translateService: TranslateService
  ) { }

  /**
   * Export assets to Excel
   */
  exportToExcel(assets: Asset[], activeTab: AssetType): void {
    const columns = this.buildExportColumns(activeTab);
    const fileName = `Asset_List_${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`;

    this.excelExportService.exportToExcel({
      fileName: fileName,
      sheetName: activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
      columns: columns,
      data: assets,
      includeTimestamp: true
    });
  }

  /**
   * Build export columns based on active tab
   */
  private buildExportColumns(activeTab: AssetType): ExcelColumn[] {
    const columns: ExcelColumn[] = [
      {
        header: this.translateService.instant('assetList.table.name'),
        key: 'name',
        width: 30,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('assetList.table.itemNo'),
        key: 'itemNo',
        width: 15,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('assetList.table.partNo'),
        key: 'partNo',
        width: 15,
        format: (value: string) => value || '-'
      },
      {
        header: this.translateService.instant('assetList.table.nsn'),
        key: 'nsn',
        width: 15,
        format: (value: string) => value || '-'
      }
    ];

    // Add tab-specific columns
    if (activeTab === 'ammunition') {
      columns.push(
        {
          header: this.translateService.instant('assetList.table.caseType'),
          key: 'caseType',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('assetList.table.primaryPurpose'),
          key: 'primaryPurpose',
          width: 20,
          format: (value: string | LookupDto) => {
            if (!value) return '-';
            if (typeof value === 'string') return value;
            return getLookupDisplayName(value, this.translateService) || '-';
          }
        }
      );
    } else if (activeTab === 'weapon') {
      columns.push(
        {
          header: this.translateService.instant('addAsset.weaponType'),
          key: 'weaponType',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.caliber'),
          key: 'caliber',
          width: 15,
          format: (value: string) => value || '-'
        }
      );
    } else if (activeTab === 'explosive') {
      columns.push(
        {
          header: this.translateService.instant('addAsset.explosiveType'),
          key: 'explosiveType',
          width: 20,
          format: (value: string) => value || '-'
        },
        {
          header: this.translateService.instant('addAsset.unNumber'),
          key: 'unNumber',
          width: 15,
          format: (value: string) => value || '-'
        }
      );
    }

    // Add common columns
    columns.push(
      {
        header: this.translateService.instant('assetList.table.price'),
        key: 'price',
        width: 15,
        format: (value: number) => value ? value.toString() : '-'
      },
      {
        header: this.translateService.instant('assetList.table.minimumQuantity'),
        key: 'minimumQuantity',
        width: 18,
        format: (value: number) => value ? value.toString() : '-'
      }
    );

    return columns;
  }

  /**
   * Download import template
   */
  downloadImportTemplate(activeTab: AssetType): void {
    const { headers, sampleData } = this.getTemplateData(activeTab);

    this.excelExportService.exportToExcel({
      fileName: `${activeTab}_import_template`,
      columns: headers,
      data: sampleData,
      sheetName: 'Import Template',
      includeTimestamp: false
    });
  }

  /**
   * Get template data based on active tab
   */
  private getTemplateData(activeTab: AssetType): { headers: ExcelColumn[]; sampleData: Record<string, unknown>[] } {
    let headers: ExcelColumn[] = [];
    let sampleData: Record<string, unknown>[] = [];

    if (activeTab === 'ammunition') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Arm Number', key: 'armNumber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'Bullet Diameter', key: 'bulletDiameter' },
        { header: 'Is Linked', key: 'isLinked' },
        { header: 'Primer', key: 'primer' },
        { header: 'Total Weight', key: 'totalWeight' },
        { header: 'NSN', key: 'nsn' }
      ];

      sampleData = [
        {
          name: '6.5×55mm Swedish',
          itemNo: 'AMM-111',
          partNo: 'P-65-55',
          armNumber: 'ARM-111',
          price: 4.8,
          minimumQuantity: 100,
          bulletDiameter: 6.5,
          isLinked: false,
          primer: 'Boxer',
          totalWeight: 25.1,
          nsn: '1305-01-612-4419'
        },
        {
          name: '7.62×51mm NATO',
          itemNo: 'AMM-112',
          partNo: 'P-762-NATO',
          armNumber: 'ARM-112',
          price: 5.2,
          minimumQuantity: 200,
          bulletDiameter: 7.62,
          isLinked: true,
          primer: 'Berdan',
          totalWeight: 25.4,
          nsn: '1305-01-234-5678'
        }
      ];
    } else if (activeTab === 'weapon') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' },
        { header: 'Weapon Type', key: 'weaponType' },
        { header: 'Caliber', key: 'caliber' },
        { header: 'Action Type', key: 'actionType' },
        { header: 'Barrel Length', key: 'barrelLength' },
        { header: 'Overall Length', key: 'overallLength' },
        { header: 'Weight', key: 'weight' },
        { header: 'Capacity', key: 'capacity' }
      ];

      sampleData = [
        {
          name: 'M4 Carbine',
          itemNo: 'WPN-001',
          partNo: 'M4-5.56',
          price: 850.00,
          minimumQuantity: 10,
          nsn: '1005-01-231-0973',
          weaponType: 'Rifle',
          caliber: '5.56×45mm NATO',
          actionType: 'SemiAutomatic',
          barrelLength: 14.5,
          overallLength: 33,
          weight: 6.9,
          capacity: 30
        }
      ];
    } else if (activeTab === 'explosive') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' },
        { header: 'Explosive Type', key: 'explosiveType' },
        { header: 'UN Number', key: 'unNumber' },
        { header: 'Net Explosive Quantity', key: 'netExplosiveQuantity' },
        { header: 'Total Weight', key: 'totalWeight' }
      ];

      sampleData = [
        {
          name: 'C-4 Plastic Explosive',
          itemNo: 'EXP-001',
          partNo: 'C4-1.25',
          price: 125.00,
          minimumQuantity: 5,
          nsn: '1375-00-122-2956',
          explosiveType: 'PlasticExplosive',
          unNumber: 'UN0056',
          netExplosiveQuantity: 1.25,
          totalWeight: 1.5
        }
      ];
    }

    return { headers, sampleData };
  }
}

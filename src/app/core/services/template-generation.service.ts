import { Injectable } from '@angular/core';
import { ExcelExportService, ExcelColumn } from './excel-export.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateGenerationService {
  constructor(private excelExportService: ExcelExportService) {}

  /**
   * Generate asset import template based on type
   */
  generateAssetTemplate(type: 'ammunition' | 'weapon' | 'explosive'): void {
    let headers: ExcelColumn[] = [];
    let sampleData: any[] = [];
    
    if (type === 'ammunition') {
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
      sampleData = [{
        name: '6.5×55mm Swedish',
        itemNo: 'AMM-111',
        partNo: 'P-655-SWE',
        armNumber: 'ARM-111',
        price: 4.8,
        minimumQuantity: 100,
        bulletDiameter: 6.5,
        isLinked: false,
        primer: 'Boxer',
        totalWeight: 12.5,
        nsn: '1305-12-345-6789'
      }];
    } else if (type === 'weapon') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Weapon Type', key: 'weaponType' },
        { header: 'Caliber', key: 'caliber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' }
      ];
      sampleData = [{
        name: 'AK-47',
        itemNo: 'WPN-001',
        partNo: 'P-AK47',
        weaponType: 'Rifle',
        caliber: '7.62x39mm',
        price: 500,
        minimumQuantity: 10,
        nsn: '1005-12-345-6789'
      }];
    } else if (type === 'explosive') {
      headers = [
        { header: 'Name', key: 'name' },
        { header: 'Item No', key: 'itemNo' },
        { header: 'Part No', key: 'partNo' },
        { header: 'Explosive Type', key: 'explosiveType' },
        { header: 'UN Number', key: 'unNumber' },
        { header: 'Price', key: 'price' },
        { header: 'Minimum Quantity', key: 'minimumQuantity' },
        { header: 'NSN', key: 'nsn' }
      ];
      sampleData = [{
        name: 'TNT',
        itemNo: 'EXP-001',
        partNo: 'P-TNT',
        explosiveType: 'High Explosive',
        unNumber: 'UN0209',
        price: 50,
        minimumQuantity: 5,
        nsn: '1375-12-345-6789'
      }];
    }
    
    this.excelExportService.exportToExcel({
      fileName: `${type}_import_template`,
      columns: headers,
      data: sampleData,
      sheetName: 'Import Template',
      includeTimestamp: false
    });
  }

  /**
   * Generate warehouse inventory import template
   */
  generateWarehouseInventoryTemplate(depotId: number): void {
    const headers: ExcelColumn[] = [
      { header: 'Item No', key: 'itemNo', width: 20 },
      { header: 'Lot', key: 'lot', width: 10 },
      { header: 'Supplier ID', key: 'supplierId', width: 15 },
      { header: 'Manufacturer ID', key: 'manufacturerId', width: 15 },
      { header: 'Country ID', key: 'countryId', width: 15 },
      { header: 'Original Quantity', key: 'originalQuantity', width: 18 },
      { header: 'Batch No', key: 'batchNo', width: 15 },
      { header: 'Expiry Date', key: 'expiryDate', width: 15 },
      { header: 'Ready For Issue', key: 'readyForIssue', width: 15 },
      { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
      { header: 'Invoice Date', key: 'invoiceDate', width: 15 },
      { header: 'Received Date', key: 'receivedDate', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];

    const sampleData = [{
      itemNo: 'AMM-001',
      lot: 1,
      supplierId: 1,
      manufacturerId: 1,
      countryId: 1,
      originalQuantity: 100,
      batchNo: 'BATCH001',
      expiryDate: '2025-12-31',
      readyForIssue: 'Yes',
      invoiceNumber: 'INV-001',
      invoiceDate: '2025-01-01',
      receivedDate: '2025-01-02',
      notes: 'Sample inventory entry'
    }];

    this.excelExportService.exportToExcel({
      fileName: `Warehouse_Inventory_Import_Template_Depot_${depotId}`,
      columns: headers,
      data: sampleData,
      sheetName: 'Import Template',
      includeTimestamp: false
    });
  }
}


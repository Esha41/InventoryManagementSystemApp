import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AmmunitionService } from './ammunition.service';
import { WeaponService } from './weapon.service';
import { ExplosiveService } from './explosive.service';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto, CreateInventoryDetailDto } from '@models/inventory.model';
import { ImportExportService } from './import-export.service';

export interface ImportResult {
  successCount: number;
  failureCount: number;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class InventoryImportService {
  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private inventoryService: InventoryService,
    private importExportService: ImportExportService
  ) {}

  /**
   * Load all items (ammunition, weapons, explosives)
   */
  async loadAllItems(): Promise<any[]> {
    try {
      const [ammunition, weapons, explosives] = await Promise.all([
        firstValueFrom(this.ammunitionService.getAll().pipe(catchError(() => of([])))),
        firstValueFrom(this.weaponService.getAll().pipe(catchError(() => of([])))),
        firstValueFrom(this.explosiveService.getAll().pipe(catchError(() => of([]))))
      ]);
      return [...(ammunition || []), ...(weapons || []), ...(explosives || [])];
    } catch (error) {
      console.error('Error loading items:', error);
      return [];
    }
  }

  /**
   * Load existing inventory details for duplicate checking
   */
  async loadExistingInventory(depotId: number): Promise<any[]> {
    try {
      return await firstValueFrom(
        this.inventoryService.getWarehouseInventoryItems(depotId).pipe(
          catchError(() => of([]))
        )
      );
    } catch (error) {
      console.error('Error loading existing inventory:', error);
      return [];
    }
  }

  /**
   * Create duplicate key from inventory detail
   */
  createDuplicateKey(itemId: number, lot: number, batchNo: string): string {
    return `${itemId}_${lot}_${batchNo || ''}`;
  }

  /**
   * Build duplicate keys set from existing inventory
   */
  buildDuplicateKeysSet(existingInventory: any[]): Set<string> {
    const keys = new Set<string>();
    existingInventory.forEach(detail => {
      if (detail.itemId && detail.lot !== undefined) {
        const batchNo = detail.batchNo || '';
        const key = this.createDuplicateKey(detail.itemId, detail.lot, batchNo);
        keys.add(key);
      }
    });
    return keys;
  }

  /**
   * Find item ID from Item No or Item ID
   */
  findItemId(row: any, allItems: any[]): number | null {
    const itemNo = row['Item No'] || row['itemNo'] || row['Item ID'] || row['itemId'];
    const itemId = row['Item ID'] || row['itemId'];
    
    if (itemId) {
      const parsed = parseInt(itemId, 10);
      return isNaN(parsed) ? null : parsed;
    }
    
    if (itemNo) {
      const foundItem = allItems.find(item => 
        item.itemNo === itemNo || item.itemNo === String(itemNo)
      );
      if (foundItem && foundItem.id) {
        return typeof foundItem.id === 'string' 
          ? parseInt(foundItem.id, 10) 
          : foundItem.id;
      }
    }
    
    return null;
  }

  /**
   * Validate and create inventory detail from row
   */
  createInventoryDetail(
    row: any,
    allItems: any[],
    existingKeys: Set<string>
  ): { detail: CreateInventoryDetailDto | null; error: string | null } {
    const itemNo = row['Item No'] || row['itemNo'] || row['Item ID'] || row['itemId'];
    const itemId = this.findItemId(row, allItems);
    
    if (!itemId || isNaN(itemId)) {
      return {
        detail: null,
        error: `Item not found (Item No: ${itemNo || 'N/A'}, Item ID: ${row['Item ID'] || row['itemId'] || 'N/A'})`
      };
    }

    const lot = parseInt(row['Lot'] || row['lot'] || '1', 10) || 1;
    const batchNo = row['Batch No'] || row['batchNo'] || '';
    
    // Check for duplicate
    const duplicateKey = this.createDuplicateKey(itemId, lot, batchNo);
    if (existingKeys.has(duplicateKey)) {
      return {
        detail: null,
        error: `Duplicate entry - Item (ID: ${itemId}, Item No: ${itemNo || 'N/A'}) with Lot ${lot} and Batch No "${batchNo || 'N/A'}" already exists in this depot`
      };
    }

    const originalQuantity = parseInt(row['Original Quantity'] || row['originalQuantity'] || '0', 10) || 0;
    if (originalQuantity <= 0) {
      return {
        detail: null,
        error: 'Original Quantity must be greater than 0'
      };
    }

    const detail: CreateInventoryDetailDto = {
      itemId: itemId,
      lot: lot,
      supplierId: row['Supplier ID'] || row['supplierId'] 
        ? parseInt(row['Supplier ID'] || row['supplierId'], 10) 
        : undefined,
      manufacturerId: row['Manufacturer ID'] || row['manufacturerId'] 
        ? parseInt(row['Manufacturer ID'] || row['manufacturerId'], 10) 
        : undefined,
      countryId: row['Country ID'] || row['countryId'] 
        ? parseInt(row['Country ID'] || row['countryId'], 10) 
        : undefined,
      originalQuantity: originalQuantity,
      batchNo: batchNo || undefined,
      expiryDate: this.importExportService.parseDate(row['Expiry Date'] || row['expiryDate']),
      readyForIssue: row['Ready For Issue'] !== undefined 
        ? (row['Ready For Issue'] === true || row['Ready For Issue'] === 'true' || row['Ready For Issue'] === 'Yes') 
        : true
    };

    // Add to existing keys to prevent duplicates within the same import batch
    existingKeys.add(duplicateKey);

    return { detail, error: null };
  }

  /**
   * Process warehouse inventory import
   */
  async processImport(
    jsonData: any[],
    depotId: number
  ): Promise<ImportResult> {
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Load data
    const [allItems, existingInventory] = await Promise.all([
      this.loadAllItems(),
      this.loadExistingInventory(depotId)
    ]);

    const existingInventoryKeys = this.buildDuplicateKeysSet(existingInventory);

    // Group rows by invoice number
    const rowGroups = this.groupRowsByInvoice(jsonData);

    // Process each invoice group
    const inventoryGroups = new Map<string, { 
      createDto: CreateInventoryDto; 
      rowCount: number; 
      invoiceNumber: string 
    }>();

    for (const [invoiceNumber, rows] of rowGroups.entries()) {
      try {
        const invoiceResult = this.processInvoiceGroup(
          invoiceNumber,
          rows,
          allItems,
          existingInventoryKeys,
          depotId
        );

        if (invoiceResult.errors.length > 0) {
          const errorMsg = `Invoice ${invoiceNumber}: Skipped due to ${invoiceResult.errors.length} error(s). ${invoiceResult.errors.join('; ')}`;
          errors.push(errorMsg);
          failureCount += rows.length;
          continue;
        }

        if (invoiceResult.inventoryDetails.length === 0) {
          errors.push(`Invoice ${invoiceNumber}: No valid inventory details found`);
          failureCount += rows.length;
          continue;
        }

        const createDto: CreateInventoryDto = {
          depoId: depotId,
          invoiceNumber: invoiceNumber.startsWith('IMPORT-') ? undefined : invoiceNumber,
          invoiceDate: invoiceResult.invoiceDate,
          recievedDate: invoiceResult.receivedDate,
          notes: invoiceResult.notes,
          inventoryDetails: invoiceResult.inventoryDetails
        };

        inventoryGroups.set(invoiceNumber, {
          createDto,
          rowCount: invoiceResult.inventoryDetails.length,
          invoiceNumber
        });
      } catch (error: any) {
        errors.push(`Invoice ${invoiceNumber}: ${error.message || 'Unknown error'}`);
        failureCount++;
      }
    }

    // Create all inventories
    if (inventoryGroups.size > 0) {
      const createResults = await this.createInventories(inventoryGroups);
      successCount += createResults.successCount;
      failureCount += createResults.failureCount;
      errors.push(...createResults.errors);
    }

    return { successCount, failureCount, errors };
  }

  /**
   * Group rows by invoice number
   */
  private groupRowsByInvoice(jsonData: any[]): Map<string, any[]> {
    const rowGroups = new Map<string, any[]>();
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and row 1 is headers
      
      const invoiceNumber = row['Invoice Number'] || row['invoiceNumber'] || `IMPORT-${Date.now()}-${i}`;
      
      if (!rowGroups.has(invoiceNumber)) {
        rowGroups.set(invoiceNumber, []);
      }
      rowGroups.get(invoiceNumber)!.push({ ...row, _rowNumber: rowNum });
    }
    
    return rowGroups;
  }

  /**
   * Process a single invoice group
   */
  private processInvoiceGroup(
    invoiceNumber: string,
    rows: any[],
    allItems: any[],
    existingKeys: Set<string>,
    depotId: number
  ): {
    inventoryDetails: CreateInventoryDetailDto[];
    invoiceDate?: string;
    receivedDate?: string;
    notes?: string;
    errors: string[];
  } {
    const invoiceErrors: string[] = [];
    const inventoryDetails: CreateInventoryDetailDto[] = [];
    let invoiceDate: string | undefined;
    let receivedDate: string | undefined;
    let notes: string | undefined;

    for (const row of rows) {
      const result = this.createInventoryDetail(row, allItems, existingKeys);
      
      if (result.error) {
        invoiceErrors.push(`Row ${row._rowNumber}: ${result.error}`);
        continue;
      }

      if (result.detail) {
        inventoryDetails.push(result.detail);
      }

      // Capture invoice-level data from first row
      if (rows.indexOf(row) === 0) {
        invoiceDate = this.importExportService.parseDate(row['Invoice Date'] || row['invoiceDate']);
        receivedDate = this.importExportService.parseDate(row['Received Date'] || row['receivedDate']);
        notes = row['Notes'] || row['notes'] || undefined;
      }
    }

    return { inventoryDetails, invoiceDate, receivedDate, notes, errors: invoiceErrors };
  }

  /**
   * Create all inventories in parallel
   */
  private async createInventories(
    inventoryGroups: Map<string, { createDto: CreateInventoryDto; rowCount: number; invoiceNumber: string }>
  ): Promise<{ successCount: number; failureCount: number; errors: string[] }> {
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    const createObservables = Array.from(inventoryGroups.values()).map(group => {
      return this.inventoryService.create(group.createDto).pipe(
        map(() => ({ success: true, count: group.rowCount, invoiceNumber: group.invoiceNumber })),
        catchError((err: any) => {
          const errorMsg = err?.error?.message || err?.message || 'Failed to create inventory';
          errors.push(`Invoice ${group.invoiceNumber}: ${errorMsg}`);
          return of({ success: false, count: group.rowCount, invoiceNumber: group.invoiceNumber, error: errorMsg });
        })
      );
    });

    if (createObservables.length === 0) {
      return { successCount: 0, failureCount: 0, errors };
    }

    const results = await firstValueFrom(forkJoin(createObservables));
    
    results.forEach(result => {
      if (result.success) {
        successCount += result.count;
      } else {
        failureCount += result.count;
      }
    });

    return { successCount, failureCount, errors };
  }
}


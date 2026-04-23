import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, X, Eye, Edit, Trash2, Download, Upload, FileText } from 'lucide-angular';
import { LookupItem } from '@models/lookup.model';
import { InventoryDetailDto } from '@models/inventory.model';
import { AssetDto } from '@models/asset.model';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { EditInventoryDetailModalComponent } from './components/edit-inventory-detail-modal/edit-inventory-detail-modal.component';
import { EditAssetModalComponent } from '@assets/pages/edit/components/edit-asset-modal/edit-asset-modal.component';
import { DropdownOption } from '@components/dropdown/dropdown.component';
import { PaginationComponent } from '@components/pagination/pagination.component';
import { RowsPerPageComponent } from '@components/rows-per-page/rows-per-page.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { HasPermissionDirective } from '@core/directives/has-permission.directive';
import { trackById } from '@utils/trackby.utils';
import { ImportDialogComponent } from '@components/import-dialog/import-dialog.component';
import { ImportPreviewDialogComponent } from '@components/import-preview-dialog/import-preview-dialog.component';
import {
  WAREHOUSE_DEPOT_EXPORT_PERMISSIONS,
  WAREHOUSE_DEPOT_INVENTORY_IMPORT_PERMISSIONS,
  WAREHOUSE_DEPOT_ASSET_IMPORT_PERMISSIONS
} from '@core/constants/asset-import-export-permissions';
import { WarehouseInventoryFiltersComponent } from './warehouse-inventory-filters.component';
import { WarehouseInventoryTableComponent } from './warehouse-inventory-table.component';
import { WarehouseInventoryFilterService } from './services/warehouse-inventory-filter.service';
import { WarehouseInventoryFormatterService } from './services/warehouse-inventory-formatter.service';
import { WarehouseInventoryStore } from '../../services/warehouse-inventory.store';
import { WarehouseInventoryFacadeService } from '../../services/warehouse-inventory-facade.service';
import { WarehouseInventoryViewModelService } from '../../services/warehouse-inventory-view-model.service';

@Component({
  selector: 'app-warehouse-inventory',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule, LucideAngularModule, TranslateModule,
    ConfirmDialogComponent, EditInventoryDetailModalComponent, EditAssetModalComponent,
    HasPermissionDirective, LoadingStateComponent, ErrorStateComponent,
    PaginationComponent, RowsPerPageComponent,
    WarehouseInventoryFiltersComponent, WarehouseInventoryTableComponent,
    ImportDialogComponent, ImportPreviewDialogComponent
  ],
  providers: [WarehouseInventoryStore, WarehouseInventoryFacadeService],
  templateUrl: './warehouse-inventory.component.html',
  styleUrls: ['./warehouse-inventory.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WarehouseInventoryComponent implements OnInit {
  readonly store = inject(WarehouseInventoryStore);
  readonly orchestrator = inject(WarehouseInventoryFacadeService);
  readonly formatterService = inject(WarehouseInventoryFormatterService);
  private readonly filterService = inject(WarehouseInventoryFilterService);
  private readonly viewModel = inject(WarehouseInventoryViewModelService);
  private readonly translateService = inject(TranslateService);

  // Icons / perms / constants exposed to template
  readonly X = X;
  readonly Eye = Eye;
  readonly Edit = Edit;
  readonly Trash2 = Trash2;
  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileText = FileText;
  readonly trackById = trackById;
  readonly warehouseExportPerms = [...WAREHOUSE_DEPOT_EXPORT_PERMISSIONS];
  readonly warehouseInventoryImportPerms = [...WAREHOUSE_DEPOT_INVENTORY_IMPORT_PERMISSIONS];
  readonly warehouseAssetImportPerms = [...WAREHOUSE_DEPOT_ASSET_IMPORT_PERMISSIONS];
  readonly batchAssetsPageSizeOptions = [50, 100, 200, 500];

  ngOnInit(): void { this.orchestrator.initialize(); }

  // ---------- Lookup label functions (pure; share a single impl) ----------
  readonly lookupLabel = (o: DropdownOption<LookupItem> | LookupItem | null) =>
    this.viewModel.getLookupLabel(o, this.translateService);

  // ---------- Formatter / filter bindings (pure, passed into table) ----------
  readonly getItemName = (d: InventoryDetailDto | null | undefined) => this.formatterService.getItemName(d);
  readonly getItemNo = (d: InventoryDetailDto) => this.formatterService.getItemNo(d);
  readonly getSupplierName = (d: InventoryDetailDto) => this.formatterService.getSupplierName(d);
  readonly getManufacturerName = (d: InventoryDetailDto) => this.formatterService.getManufacturerName(d);
  readonly getPrimaryPurposeName = (d: InventoryDetailDto) => this.formatterService.getPrimaryPurposeName(d);
  readonly getHccName = (d: InventoryDetailDto) => this.formatterService.getHccName(d);
  readonly getAssetItemName = (a: AssetDto | null | undefined) => this.formatterService.getAssetItemName(a);
  readonly getAssetDepartmentLabel = (a: AssetDto) => this.formatterService.getAssetDepartmentLabel(a);
  readonly getAssetCustodianLabel = (a: AssetDto) => this.formatterService.getAssetCustodianLabel(a);
  readonly getAssetSupplierLabel = (a: AssetDto) => this.formatterService.getAssetSupplierLabel(a);
  readonly getAssetManufacturerLabel = (a: AssetDto) => this.formatterService.getAssetManufacturerLabel(a);
  readonly getAssetPrimaryPurposeLabel = (a: AssetDto) => this.formatterService.getAssetPrimaryPurposeLabel(a);
  readonly formatAssetPurchasePrice = (p?: number | null) => this.formatterService.formatAssetPurchasePrice(p);
  readonly truncateAssetNotes = (a: AssetDto) => this.formatterService.truncateText(a.notes, 80);
  readonly getAssetStatusLabel = (a: AssetDto) => this.formatterService.getAssetStatusLabel(a);
  readonly formatDate = (d?: Date | string) => this.formatterService.formatDate(d);
  readonly formatNumber = (n: number) => this.formatterService.formatNumber(n);
  readonly isStaticItem = (d: InventoryDetailDto) => this.filterService.isStaticItem(d);
  readonly isItemExpired = (i: InventoryDetailDto) => this.viewModel.isItemExpired(i);

  getDeleteAssetMessage(): string {
    return this.formatterService.getDeleteAssetMessage(this.store.selectedAsset());
  }

  onEditAssetModalSaved(): void { /* reload happens in onEditAssetModalClosed */ }
}

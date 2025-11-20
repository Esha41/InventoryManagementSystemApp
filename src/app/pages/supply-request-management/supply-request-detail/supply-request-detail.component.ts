import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, CheckCircle, Clock, User, Package, Sparkles, X } from 'lucide-angular';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { OrderService, OrderDto, OrderRequestItemDto } from '@services/order.service';
import { SupplyService, OrderSupplySuggestionDto, CreateSupplyDto, CreateSupplyDetailDto } from '@services/supply.service';
import { InventoryService, LotDetailDto } from '@services/inventory.service';
import { ToastService } from '@services/toast.service';
import { ConfigService } from '@services/config.service';
import { Subject, takeUntil } from 'rxjs';

export interface ApprovalStep {
  id: string;
  approverName: string;
  approverId: string;
  militaryRank: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedDate?: string;
  comments?: string;
}

export interface LotItem {
  inventoryDetailId: number;
  lotNumber: number;
  quantity: number;
  expiryDate?: Date;
  location: string;
  condition: 'Good' | 'Fair' | 'Near Expiry';
  daysUntilExpiry: number;
  selectedQuantity: number;
  depotName?: string;
  supplierName?: string;
  manufacturerName?: string;
}

export interface OrderItem {
  requestItemId: number;
  itemId: number;
  itemName: string;
  itemType: string;
  requestedQuantity: number;
  approvedQuantity: number;
  availableLots: LotItem[];
  totalSelectedForDischarge: number;
  canFulfillCompletely: boolean;
}

export interface SupplyRequestDetail {
  issueNo: string;
  requestType: 'Issue' | 'Return';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  requestDate: string;
  requesterName: string;
  requesterId: string;
  requesterRank: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Delivered' | 'Returned' | 'Cancelled';
  approvalWorkflow: ApprovalStep[];
  items: OrderItem[];
}

@Component({
  selector: 'app-supply-request-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule, ModalComponent],
  templateUrl: './supply-request-detail.component.html',
  styleUrls: ['./supply-request-detail.component.css']
})
export class SupplyRequestDetailComponent implements OnInit, OnDestroy {
  // ==================== LIFECYCLE & ICONS ====================
  private destroy$ = new Subject<void>();
  
  readonly ArrowLeft = ArrowLeft;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly Sparkles = Sparkles;
  readonly XIcon = X;

  // ==================== STATE ====================
  orderId: number = 0;
  issueNo: string = '';
  requestDetail: SupplyRequestDetail | null = null;
  orderData: OrderDto | null = null;
  
  // Loading states
  loading: boolean = true;
  loadingSuggestion: boolean = false;
  processingDischarge: boolean = false;
  loadingAllLots: boolean = false;
  
  // Lot selection modal state
  isLotModalOpen: boolean = false;
  selectedItem: OrderItem | null = null;
  tempLotSelections: Map<number, number> = new Map(); // Temporary selections in modal
  showManualLotEntry: boolean = false; // Toggle manual entry section
  manualLotNumber: string = ''; // For manual lot entry
  loadingManualLot: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private config: ConfigService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['id'];
    this.orderId = parseInt(idParam, 10);
    if (isNaN(this.orderId)) {
      this.toastService.error('Invalid order ID');
      this.router.navigate(['/supply-request-management']);
      return;
    }
    this.loadRequestDetail();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== DATA LOADING ====================

  /**
   * Load order details from backend
   */
  loadRequestDetail(): void {
    this.loading = true;
    this.orderService.getOrderById(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order: OrderDto) => {
          this.orderData = order;
          this.issueNo = order.requestNo || order.orderNo || `#${order.id}`;
          
      
          this.requestDetail = this.mapOrderToRequestDetail(order);
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load order details:', error);
          this.toastService.error('Failed to load order details');
          this.loading = false;
          this.goBack();
        }
      });
  }

  private mapOrderToRequestDetail(order: OrderDto): SupplyRequestDetail {
    const priorityMap: { [key: number]: SupplyRequestDetail['priority'] } = {
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Critical'
    };

    const statusMap: { [key: number]: SupplyRequestDetail['status'] } = {
      1: 'Pending',
      2: 'Processing',
      3: 'Completed',
      4: 'Delivered',
      5: 'Cancelled'
    };

    const items: OrderItem[] = (order.requestItems || []).map(item => ({
      requestItemId: item.id,
      itemId: item.itemId,
      itemName: item.itemName || 'N/A',
      itemType: this.getItemTypeName(item.itemType),
      requestedQuantity: item.quantity,
      approvedQuantity: item.quantity,
      availableLots: [],
      totalSelectedForDischarge: 0,
      canFulfillCompletely: false
    }));

    return {
      issueNo: order.requestNo || order.orderNo || `#${order.id}`,
      requestType: order.requestType === 1 ? 'Issue' : 'Return',
      priority: priorityMap[order.priority] || 'Low',
      requestDate: this.formatOrderDate(order.usageDate),
      requesterName: order.requesterName || 'N/A',
      requesterId: order.requesterId || 'N/A',
      requesterRank: 'N/A', // This would need to come from user/rank service
      status: statusMap[order.status] || 'Pending',
      approvalWorkflow: this.getStaticApprovalWorkflow(),
      items: items
    };
  }

  private getItemTypeName(itemType?: number): string {
    const typeMap: { [key: number]: string } = {
      1: 'Ammunition',
      2: 'Weapon',
      3: 'Explosive'
    };
    return itemType ? typeMap[itemType] || 'Other' : 'Other';
  }

  formatOrderDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  private getStaticApprovalWorkflow(): ApprovalStep[] {
    // Static workflow as requested by user
    return [
      {
        id: '1',
        approverName: 'Maj. Khalid Hassan',
        approverId: 'MIL-32145',
        militaryRank: 'Major',
        status: 'Approved',
        approvedDate: '11 Sept 2024',
        comments: 'Approved for operational needs'
      },
      {
        id: '2',
        approverName: 'Lt. Col. Mohammed Al-Farsi',
        approverId: 'MIL-21087',
        militaryRank: 'Lieutenant Colonel',
        status: 'Approved',
        approvedDate: '11 Sept 2024',
        comments: 'Verified inventory availability'
      },
      {
        id: '3',
        approverName: 'Col. Saeed Abdullah',
        approverId: 'MIL-10234',
        militaryRank: 'Colonel',
        status: 'Pending',
        comments: ''
      }
    ];
  }

  goBack(): void {
    this.router.navigate(['/supply-request-management']);
  }

  // ==================== LOT SELECTION MODAL ====================

  /**
   * Open lot selection modal for an item
   * Shows empty lots list - user must choose how to load lots
   */
  openLotModal(item: OrderItem): void {
    this.selectedItem = item;
    this.tempLotSelections.clear();
    this.openModalWithLots(item);
  }

  private openModalWithLots(item: OrderItem): void {
    // Copy current selections to temp
    item.availableLots.forEach(lot => {
      if (lot.selectedQuantity > 0) {
        this.tempLotSelections.set(lot.lotNumber, lot.selectedQuantity);
      }
    });
    this.isLotModalOpen = true;
  }

  /**
   * Button 1: Show ALL lots for this item (by itemId only)
   * Endpoint: GET /api/Inventory/item/{itemId}/lots
   */
  onShowAllLots(): void {
    if (!this.selectedItem) return;
    this.loadAllLotsForItem(this.selectedItem);
  }

  /**
   * Button 2: Show AVAILABLE lots for this item and quantity
   * Endpoint: GET /api/Inventory/item/{itemId}/available-lots?quantity=X
   */
  onShowAvailableLots(): void {
    if (!this.selectedItem) return;
    this.loadAvailableLotsForQuantity(this.selectedItem);
  }

  /**
   * Button 3: Add lot manually by lot number
   * Shows input field for manual entry
   */
  onAddLotManually(): void {
    // Toggle manual entry section
    this.showManualLotEntry = !this.showManualLotEntry;
    if (this.showManualLotEntry) {
      this.manualLotNumber = '';
    }
  }

  /**
   * Get details for manually entered lot number
   * Endpoint: GET /api/Inventory/lot/{lotNumber}
   */
  onGetManualLotDetails(): void {
    console.log('onGetManualLotDetails called', { 
      manualLotNumber: this.manualLotNumber, 
      selectedItem: this.selectedItem?.itemId 
    });

    if (!this.selectedItem || !this.manualLotNumber.trim()) {
      this.toastService.warning('Please enter a lot number');
      return;
    }

    const lotNum = parseInt(this.manualLotNumber.trim(), 10);
    console.log('Parsed lot number:', lotNum);
    
    if (isNaN(lotNum)) {
      this.toastService.error('Invalid lot number');
      return;
    }

    console.log('Calling API to fetch lot:', lotNum);
    this.loadingManualLot = true;
    this.inventoryService.getLotByNumber(lotNum)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lot: LotDetailDto) => {
          // Check if lot is for the correct item
          if (lot.itemId !== this.selectedItem!.itemId) {
            this.toastService.error(`Lot ${lotNum} belongs to a different item (${lot.itemName})`);
            this.loadingManualLot = false;
            return;
          }

          // Check if lot already exists in the list
          const existingLot = this.selectedItem!.availableLots.find(l => l.lotNumber === lot.lot);
          if (existingLot) {
            this.toastService.warning(`Lot ${lotNum} is already in the list`);
            this.loadingManualLot = false;
            return;
          }

          // Add the lot to the list
          const newLot: LotItem = {
            inventoryDetailId: lot.inventoryDetailId,
            lotNumber: lot.lot,
            quantity: lot.remainingQuantity,
            expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
            location: this.formatLocation(lot.depot),
            condition: lot.isExpired ? 'Near Expiry' : this.determineCondition(lot.expiryDate),
            daysUntilExpiry: this.calculateDaysUntilExpiry(lot.expiryDate),
            selectedQuantity: 0,
            depotName: lot.depot?.nameEn || lot.depot?.nameAr,
            supplierName: lot.supplier?.nameEn || lot.supplier?.nameAr,
            manufacturerName: lot.manufacturer?.nameEn || lot.manufacturer?.nameAr
          };

          this.selectedItem!.availableLots.push(newLot);
          
          // Sort by expiry date
          this.selectedItem!.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

          this.toastService.success(`Lot ${lotNum} added successfully`);
          this.manualLotNumber = '';
          this.loadingManualLot = false;
        },
        error: (error) => {
          console.error('Failed to load lot details:', error);
          this.toastService.error('Lot not found or error loading details');
          this.loadingManualLot = false;
        }
      });
  }

  /**
   * Load ALL lots for an item by itemId
   * Endpoint: GET /api/Inventory/item/{itemId}/lots
   */
  private loadAllLotsForItem(item: OrderItem): void {
    this.loadingAllLots = true;
    this.inventoryService.getLotsByItemId(item.itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotDetailDto[]) => {
          // Save current selections before updating
          const currentSelections = new Map(this.tempLotSelections);
          
          // Map lots to UI format and preserve selections
          item.availableLots = this.mapLotDetailsToLotItems(lots, currentSelections);
          this.loadingAllLots = false;
          
          if (item.availableLots.length > 0) {
            this.toastService.success(`Loaded ${item.availableLots.length} total lot(s) for item`);
          } else {
            this.toastService.warning('No lots found for this item');
          }
        },
        error: (error) => {
          console.error('Failed to load all lots:', error);
          this.toastService.error('Failed to load lots');
          this.loadingAllLots = false;
        }
      });
  }

  /**
   * Load AVAILABLE lots for an item and quantity (FEFO logic)
   * Endpoint: GET /api/Inventory/item/{itemId}/available-lots?quantity=X
   */
  private loadAvailableLotsForQuantity(item: OrderItem): void {
    this.loadingAllLots = true;
    this.inventoryService.getAvailableLotsForQuantity(item.itemId, item.approvedQuantity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots: LotDetailDto[]) => {
          // Save current selections before updating
          const currentSelections = new Map(this.tempLotSelections);
          
          // Map lots to UI format and preserve selections
          item.availableLots = this.mapLotDetailsToLotItems(lots, currentSelections);
          this.loadingAllLots = false;
          
          if (item.availableLots.length > 0) {
            this.toastService.success(`Loaded ${item.availableLots.length} available lot(s) optimized for quantity ${item.approvedQuantity}`);
          } else {
            this.toastService.warning('No available lots found for requested quantity');
          }
        },
        error: (error) => {
          console.error('Failed to load available lots:', error);
          this.toastService.error('Failed to load available lots');
          this.loadingAllLots = false;
        }
      });
  }

  /**
   * Format location string from depot information
   */
  private formatLocation(depot?: { nameEn?: string; nameAr?: string }): string {
    if (!depot) return 'Unknown Location';
    return depot.nameEn || depot.nameAr || 'Unknown Location';
  }

  closeLotModal(): void {
    this.isLotModalOpen = false;
    this.selectedItem = null;
    this.tempLotSelections.clear();
    this.showManualLotEntry = false;
    this.manualLotNumber = '';
  }

  /**
   * Handle quantity change in lot selection modal
   */
  onTempLotQuantityChange(lotNumber: number, quantity: number): void {
    if (quantity > 0) {
      this.tempLotSelections.set(lotNumber, quantity);
    } else {
      this.tempLotSelections.delete(lotNumber);
    }
  }

  /**
   * Remove a lot from the selection list (frontend only)
   */
  onRemoveLot(lotNumber: number): void {
    if (!this.selectedItem) return;

    // Remove from availableLots array
    const index = this.selectedItem.availableLots.findIndex(lot => lot.lotNumber === lotNumber);
    if (index > -1) {
      this.selectedItem.availableLots.splice(index, 1);
      
      // Remove from temp selections if it was selected
      this.tempLotSelections.delete(lotNumber);
      
      this.toastService.success(`Lot ${lotNumber} removed from list`);
    }
  }

  /**
   * Calculate total quantity selected in modal
   */
  getTempTotalSelected(): number {
    return Array.from(this.tempLotSelections.values())
      .reduce((sum, qty) => sum + qty, 0);
  }

  /**
   * Check if selection can be confirmed (has selections and doesn't exceed approved qty)
   */
  canConfirmSelection(): boolean {
    if (!this.selectedItem) return false;
    const total = this.getTempTotalSelected();
    return total > 0 && total <= this.selectedItem.approvedQuantity;
  }

  /**
   * Confirm lot selection and update item's discharge quantity
   * Updates both individual lot selections and item totals
   */
  confirmLotSelection(): void {
    if (!this.selectedItem || !this.canConfirmSelection()) return;

    // Apply selections from temp map to actual lot items
    this.selectedItem.availableLots.forEach(lot => {
      lot.selectedQuantity = this.tempLotSelections.get(lot.lotNumber) || 0;
    });

    // Recalculate total selected for this item from all its lots
    this.selectedItem.totalSelectedForDischarge = this.selectedItem.availableLots
      .reduce((sum, lot) => sum + lot.selectedQuantity, 0);

    this.config.log('Lot selection confirmed', {
      itemId: this.selectedItem.itemId,
      itemName: this.selectedItem.itemName,
      totalSelected: this.selectedItem.totalSelectedForDischarge,
      approvedQty: this.selectedItem.approvedQuantity,
      lotsSelected: this.selectedItem.availableLots.filter(l => l.selectedQuantity > 0).length
    });

    this.closeLotModal();
  }

  // ==================== DISCHARGE SUMMARY CALCULATIONS ====================

  /**
   * Calculate total approved quantity across all items in the order
   */
  getTotalApproved(): number {
    if (!this.requestDetail?.items) return 0;
    return this.requestDetail.items.reduce((sum, item) => sum + item.approvedQuantity, 0);
  }

  /**
   * Calculate total selected for discharge across all items
   * Sums up totalSelectedForDischarge from each item (which is sum of lot selections)
   */
  getTotalSelectedForDischarge(): number {
    if (!this.requestDetail?.items) return 0;
    return this.requestDetail.items.reduce((sum, item) => sum + item.totalSelectedForDischarge, 0);
  }

  /**
   * Calculate remaining quantity to be fulfilled
   * Remaining = Total Approved - Total Selected
   */
  getTotalRemaining(): number {
    return this.getTotalApproved() - this.getTotalSelectedForDischarge();
  }

  /**
   * Check if discharge can be processed
   * Requirements: Must have selections AND not exceed approved quantity
   */
  canProcessDischarge(): boolean {
    const total = this.getTotalSelectedForDischarge();
    return total > 0 && total <= this.getTotalApproved();
  }

  // ==================== SUPPLY SUGGESTIONS ====================

  
  onSuggestForAllItems(): void {
    if (!this.orderData) return;

    this.loadingSuggestion = true;
    this.supplyService.getSupplySuggestion(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suggestion: OrderSupplySuggestionDto) => {
          this.applySuggestionToItems(suggestion);
          this.loadingSuggestion = false;
          
          if (suggestion.canFulfillCompletely) {
            this.toastService.success('Suggestions loaded! All items can be fulfilled from inventory.');
          } else {
            this.toastService.warning('Suggestions loaded. Note: Insufficient inventory for full fulfillment.');
          }
        },
        error: (error) => {
          console.error('Failed to load suggestions:', error);
          this.toastService.error('Failed to load supply suggestions');
          this.loadingSuggestion = false;
        }
      });
  }

  /**
   * Apply suggestion results to all items in the request
   * Updates lots and pre-selects suggested quantities
   */
  private applySuggestionToItems(suggestion: OrderSupplySuggestionDto): void {
    if (!this.requestDetail) return;

    suggestion.itemSuggestions.forEach(itemSuggestion => {
      const item = this.requestDetail!.items.find(i => i.requestItemId === itemSuggestion.requestItemId);
      if (item) {
        item.canFulfillCompletely = itemSuggestion.canFulfillCompletely;
        
        // Map lot suggestions and pre-select suggested quantities
        item.availableLots = this.mapSuggestedLotsToLotItems(itemSuggestion.lotSuggestions);
        
        // Update total selected for discharge summary
        item.totalSelectedForDischarge = item.availableLots.reduce((sum, lot) => sum + lot.selectedQuantity, 0);
      }
    });
  }

  // ==================== LOT MAPPING HELPERS ====================


  private mapSuggestedLotsToLotItems(
    suggestions: any[],
    existingSelections?: Map<number, number>
  ): LotItem[] {
    const lots = suggestions.map(lotSuggestion => ({
      inventoryDetailId: lotSuggestion.inventoryDetailId,
      lotNumber: lotSuggestion.lot,
      quantity: lotSuggestion.availableQuantity,
      expiryDate: lotSuggestion.expiryDate ? new Date(lotSuggestion.expiryDate) : undefined,
      location: this.formatLocation(lotSuggestion.depot),
      condition: this.determineCondition(lotSuggestion.expiryDate),
      daysUntilExpiry: this.calculateDaysUntilExpiry(lotSuggestion.expiryDate),
      selectedQuantity: existingSelections?.get(lotSuggestion.lot) ?? lotSuggestion.suggestedQuantity,
      depotName: lotSuggestion.depot?.nameEn || lotSuggestion.depot?.nameAr,
      supplierName: lotSuggestion.supplier?.nameEn || lotSuggestion.supplier?.nameAr,
      manufacturerName: lotSuggestion.manufacturer?.nameEn || lotSuggestion.manufacturer?.nameAr
    }));

    // Sort by expiry date (FEFO)
    return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  /**
   * Map LotDetailDto from inventory API to UI LotItem format
   */
  private mapLotDetailsToLotItems(
    lotDetails: LotDetailDto[],
    existingSelections?: Map<number, number>
  ): LotItem[] {
    const lots = lotDetails
      .filter(lot => !lot.isEmptyLot) // Exclude empty lots
      .map(lot => ({
        inventoryDetailId: lot.inventoryDetailId,
        lotNumber: lot.lot,
        quantity: lot.remainingQuantity,
        expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : undefined,
        location: this.formatLocation(lot.depot),
        condition: lot.isExpired ? 'Near Expiry' as const : this.determineCondition(lot.expiryDate),
        daysUntilExpiry: this.calculateDaysUntilExpiry(lot.expiryDate),
        selectedQuantity: existingSelections?.get(lot.lot) ?? 0,
        depotName: lot.depot?.nameEn || lot.depot?.nameAr,
        supplierName: lot.supplier?.nameEn || lot.supplier?.nameAr,
        manufacturerName: lot.manufacturer?.nameEn || lot.manufacturer?.nameAr
      }));

    // Sort by expiry date
    return lots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  // ==================== UTILITY METHODS ====================

  private determineCondition(expiryDate?: string): 'Good' | 'Fair' | 'Near Expiry' {
    if (!expiryDate) return 'Good';
    
    const days = this.calculateDaysUntilExpiry(expiryDate);
    if (days < 60) return 'Near Expiry';
    if (days < 180) return 'Fair';
    return 'Good';
  }

  private calculateDaysUntilExpiry(expiryDate?: string): number {
    if (!expiryDate) return 999999;
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  // ==================== DISCHARGE PROCESSING ====================

  /**
   * Process discharge - creates supply record from selected lots
   * First checks if draft supply already exists for this order
   */
  onProcessDischarge(): void {
    if (!this.canProcessDischarge() || !this.requestDetail) return;

    // First check if draft supply already exists
    this.processingDischarge = true;
    this.supplyService.checkDraftSupplyExists(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existingSupply) => {
          if (existingSupply) {
            // Draft supply already exists
            this.processingDischarge = false;
            this.toastService.warning(`A draft supply (ID: ${existingSupply.id}) already exists for this order. Please update it instead.`);
            return;
          }

          // No draft exists, proceed with creation
          this.createNewSupply();
        },
        error: (error) => {
          console.error('Failed to check existing supply:', error);
          // Continue with creation attempt anyway
          this.createNewSupply();
        }
      });
  }

  /**
   * Create new supply record from selected lots
   * Converts UI selections to backend DTO format
   */
  private createNewSupply(): void {
    if (!this.requestDetail) return;

    // Build supply details array from all selected lots across all items
    const supplyDetails: CreateSupplyDetailDto[] = [];
    
    this.requestDetail.items.forEach(item => {
      item.availableLots.forEach(lot => {
        if (lot.selectedQuantity > 0) {
          supplyDetails.push({
            itemId: item.itemId,
            lot: lot.lotNumber,
            quantity: lot.selectedQuantity,
            notes: undefined
          });
        }
      });
    });

    // Validation
    if (supplyDetails.length === 0) {
      this.toastService.error('No items selected for discharge');
      this.processingDischarge = false;
      return;
    }

    const createSupplyDto: CreateSupplyDto = {
      orderId: this.orderId,
      supplyDetails: supplyDetails
    };

    this.config.log('Creating supply', { 
      orderId: this.orderId, 
      detailCount: supplyDetails.length 
    });

    // Call backend to create supply
    this.supplyService.create(createSupplyDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supplyId: number) => {
          this.toastService.success(`Discharge processed successfully! Supply ID: ${supplyId}`);
          this.processingDischarge = false;
          
          // Navigate to supply order detail page to fill receiver info and submit
          setTimeout(() => {
            this.router.navigate(['/supply-order', supplyId]);
          }, 1500);
        },
        error: (error) => {
          console.error('Failed to create supply:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to process discharge';
          this.toastService.error(errorMessage);
          this.processingDischarge = false;
        }
      });
  }

  // ==================== UI HELPER METHODS ====================

  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.AlertTriangle;
      case 'Pending': return this.Clock;
      default: return this.Clock;
    }
  }

  getApprovalStatusClass(status: string): string {
    switch (status) {
      case 'Approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'Pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }

  getLotConditionClass(condition: string): string {
    switch (condition) {
      case 'Near Expiry': return 'bg-red-100 text-red-800 border-red-300';
      case 'Fair': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Good': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  getItemTypeIcon(type: string): any {
    return this.Package;
  }

  formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    return this.orderData.departmentNameEn || this.orderData.departmentNameAr || 'N/A';
  }
}

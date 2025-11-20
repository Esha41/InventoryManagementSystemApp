import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, CheckCircle, Clock, User, Package, Check, X as XIcon, Plus, AlertTriangle } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { DropdownComponent } from '@components/dropdown/dropdown.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { OrderService, OrderDto } from '@services/order.service';
import { SupplyService, SupplyDto, SubmitSupplyDto } from '@services/supply.service';
import { LookupService, LookupItem } from '@services/lookup.service';
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

export interface SupplyItemDisplay {
  supplyDetailId: number; // ID of the supply detail record
  itemId: number;
  itemName: string;
  itemType: string;
  lot: number;
  quantity: number;
  requestedQuantity: number;
  totalSuppliedQuantity: number;
  isFullyFulfilled: boolean;
  notes?: string;
  isEditing: boolean; // Track if item is being edited
}

@Component({
  selector: 'app-supply-order',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    LucideAngularModule,
    DropdownComponent,
    ModalComponent
  ],
  templateUrl: './supply-order.component.html',
  styleUrls: ['./supply-order.component.css']
})
export class SupplyOrderComponent implements OnInit, OnDestroy {
  // ==================== LIFECYCLE & ICONS ====================
  private destroy$ = new Subject<void>();
  
  readonly ArrowLeft = ArrowLeft;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly Check = Check;
  readonly XIcon = XIcon;
  readonly Plus = Plus;
  readonly AlertTriangle = AlertTriangle;

  // ==================== STATE ====================
  orderId: number = 0;
  supplyId: number = 0;
  orderData: OrderDto | null = null;
  supplyData: SupplyDto | null = null;
  
  loading: boolean = true;
  submitting: boolean = false;
  rejecting: boolean = false;
  updatingItem: boolean = false;
  deletingItem: boolean = false;
  
  // Add lot modal state
  isAddLotModalOpen: boolean = false;
  addLotForm!: FormGroup;
  loadingLotDetails: boolean = false;
  
  // Confirmation modal state
  isConfirmModalOpen: boolean = false;
  confirmModalTitle: string = '';
  confirmModalMessage: string = '';
  confirmModalAction: (() => void) | null = null;
  
  // Receiver form
  receiverForm!: FormGroup;
  ranks: LookupItem[] = [];
  loadingRanks: boolean = false;
  
  // Display data
  approvalWorkflow: ApprovalStep[] = [];
  supplyItems: SupplyItemDisplay[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private orderService: OrderService,
    private supplyService: SupplyService,
    private lookupService: LookupService,
    private toastService: ToastService,
    private config: ConfigService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.params['supplyId'];
    this.supplyId = parseInt(idParam, 10);
    
    if (isNaN(this.supplyId)) {
      this.toastService.error('Invalid supply ID');
      this.router.navigate(['/supply-order']);
      return;
    }
    
    this.loadRanks();
    this.loadSupplyData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== FORM INITIALIZATION ====================

  private initializeForm(): void {
    this.receiverForm = this.fb.group({
      recieverName: ['', Validators.required],
      receiverRankId: [null, Validators.required],
      recieverMilitaryId: ['', Validators.required],
      notes: ['']
    });

    this.addLotForm = this.fb.group({
      itemId: [null, Validators.required],
      lot: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: ['']
    });
  }

  // ==================== DATA LOADING ====================

  private loadRanks(): void {
    this.loadingRanks = true;
    this.lookupService.getLookupItems('Rank')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items: LookupItem[]) => {
          this.ranks = items ?? [];
          this.loadingRanks = false;
        },
        error: () => {
          this.ranks = [];
          this.loadingRanks = false;
        }
      });
  }

  private loadSupplyData(): void {
    this.loading = true;
    
    // Get supply by ID
    this.supplyService.getById(this.supplyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supply: SupplyDto) => {
          this.supplyData = supply;
          this.orderId = supply.orderId;
          this.orderData = supply.order;
          
          // Pre-fill receiver form if data exists
          if (supply.recieverName || supply.receiverRankId || supply.recieverMilitaryId) {
            this.receiverForm.patchValue({
              recieverName: supply.recieverName || '',
              receiverRankId: supply.receiverRankId || null,
              recieverMilitaryId: supply.recieverMilitaryId || '',
              notes: supply.notes || ''
            });
          }
          
          // Map supply details to display items
          this.supplyItems = this.mapSupplyDetailsToDisplay(supply);
          
          // Set static approval workflow
          this.approvalWorkflow = this.getStaticApprovalWorkflow();
          
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load supply data:', error);
          this.toastService.error('Failed to load supply order');
          this.loading = false;
          this.goBack();
        }
      });
  }

  private mapSupplyDetailsToDisplay(supply: SupplyDto): SupplyItemDisplay[] {
    return supply.supplyDetails.map(detail => ({
      supplyDetailId: detail.id,
      itemId: detail.itemId,
      itemName: (detail.item as any)?.name || `Item #${detail.itemId}`,
      itemType: this.getItemTypeName(detail.item?.itemNo),
      lot: detail.lot,
      quantity: detail.quantity,
      requestedQuantity: detail.requestedQuantity,
      totalSuppliedQuantity: detail.totalSuppliedQuantity,
      isFullyFulfilled: detail.isFullyFulfilled,
      notes: detail.notes,
      isEditing: false
    }));
  }

  private getItemTypeName(itemNo?: string): string {
    // Determine type from item number or default
    return 'Supply Item';
  }

  private getStaticApprovalWorkflow(): ApprovalStep[] {
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

  // ==================== ACTIONS ====================

  goBack(): void {
    this.router.navigate(['/supply-order']);
  }

  // ==================== ITEM EDITING ====================

  /**
   * Enable editing for an item
   */
  onEditItem(item: SupplyItemDisplay): void {
    item.isEditing = true;
  }

  /**
   * Cancel editing for an item
   */
  onCancelEdit(item: SupplyItemDisplay): void {
    item.isEditing = false;
    // Reload to reset changes
    this.loadSupplyData();
  }

  /**
   * Update supply detail
   * Endpoint: PUT /api/Supply/{supplyId}/details/{detailId}
   */
  onUpdateItem(item: SupplyItemDisplay): void {
    if (!this.supplyData || item.quantity <= 0) {
      this.toastService.error('Invalid quantity');
      return;
    }

    this.updatingItem = true;
    this.supplyService.updateSupplyDetail(this.supplyId, item.supplyDetailId, {
      itemId: item.itemId,
      lot: item.lot,
      quantity: item.quantity,
      notes: item.notes
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Item updated successfully');
          item.isEditing = false;
          this.updatingItem = false;
          // Reload to get updated calculations
          this.loadSupplyData();
        },
        error: (error) => {
          console.error('Failed to update item:', error);
          this.toastService.error('Failed to update item');
          this.updatingItem = false;
        }
      });
  }

  /**
   * Open add lot modal
   */
  openAddLotModal(): void {
    this.addLotForm.reset();
    this.addLotForm.patchValue({ quantity: 1 });
    this.isAddLotModalOpen = true;
  }

  /**
   * Close add lot modal
   */
  closeAddLotModal(): void {
    this.isAddLotModalOpen = false;
    this.addLotForm.reset();
  }

  /**
   * Add new supply detail
   * Endpoint: POST /api/Supply/{supplyId}/details
   */
  onAddLot(): void {
    if (this.addLotForm.invalid) {
      this.addLotForm.markAllAsTouched();
      this.toastService.error('Please fill in all required fields');
      return;
    }

    const formValue = this.addLotForm.value;
    this.loadingLotDetails = true;

    this.supplyService.addSupplyDetail(this.supplyId, {
      itemId: formValue.itemId,
      lot: formValue.lot,
      quantity: formValue.quantity,
      notes: formValue.notes
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Lot added successfully to supply');
          this.loadingLotDetails = false;
          this.closeAddLotModal();
          // Reload to show new item
          this.loadSupplyData();
        },
        error: (error) => {
          console.error('Failed to add lot:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to add lot';
          this.toastService.error(errorMessage);
          this.loadingLotDetails = false;
        }
      });
  }

  /**
   * Show confirmation modal before deleting item
   */
  onDeleteItem(item: SupplyItemDisplay): void {
    this.confirmModalTitle = 'Delete Item';
    this.confirmModalMessage = `Are you sure you want to delete "${item.itemName}" (LOT-${item.lot}, Qty: ${item.quantity}) from this supply?`;
    this.confirmModalAction = () => this.confirmDeleteItem(item);
    this.isConfirmModalOpen = true;
  }

  /**
   * Actually delete the item after confirmation
   */
  private confirmDeleteItem(item: SupplyItemDisplay): void {
    this.deletingItem = true;
    this.supplyService.deleteSupplyDetail(this.supplyId, item.supplyDetailId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success(`Item "${item.itemName}" removed from supply`);
          this.deletingItem = false;
          // Reload to refresh list
          this.loadSupplyData();
        },
        error: (error) => {
          console.error('Failed to delete item:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to delete item';
          this.toastService.error(errorMessage);
          this.deletingItem = false;
        }
      });
  }

  /**
   * Accept (Submit) the supply - requires receiver information
   * Endpoint: POST /api/Supply/{id}/submit
   */
  onAccept(): void {
    if (this.receiverForm.invalid) {
      this.receiverForm.markAllAsTouched();
      this.toastService.error('Please fill in all required receiver information');
      return;
    }

    if (!this.supplyData) return;

    const submitDto: SubmitSupplyDto = this.receiverForm.value;

    this.submitting = true;
    this.supplyService.submit(this.supplyId, submitDto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Supply order accepted and submitted successfully!');
          this.submitting = false;
          
          setTimeout(() => {
            this.goBack();
          }, 1500);
        },
        error: (error) => {
          console.error('Failed to submit supply:', error);
          const errorMessage = error?.error?.message || error?.message || 'Failed to submit supply';
          this.toastService.error(errorMessage);
          this.submitting = false;
        }
      });
  }

  /**
   * Show confirmation modal before rejecting
   */
  onReject(): void {
    if (!this.supplyData) return;

    const orderNo = this.orderData?.requestNo || this.orderData?.orderNo || `#${this.orderId}`;
    this.confirmModalTitle = 'Reject Supply Order';
    this.confirmModalMessage = `Are you sure you want to reject supply order ${orderNo}? You can edit it later.`;
    this.confirmModalAction = () => this.confirmReject();
    this.isConfirmModalOpen = true;
  }

  /**
   * Actually reject after confirmation
   */
  private confirmReject(): void {
    this.rejecting = true;
    this.toastService.warning('Supply order rejected. No changes submitted.');
    
    setTimeout(() => {
      this.rejecting = false;
      this.goBack();
    }, 1000);
  }

  /**
   * Handle confirmation modal actions
   */
  onConfirmAction(): void {
    this.isConfirmModalOpen = false;
    if (this.confirmModalAction) {
      this.confirmModalAction();
      this.confirmModalAction = null;
    }
  }

  onCancelConfirmation(): void {
    this.isConfirmModalOpen = false;
    this.confirmModalAction = null;
  }

  // ==================== UI HELPER METHODS ====================

  getApprovalStatusIcon(status: string): any {
    switch (status) {
      case 'Approved': return this.CheckCircle;
      case 'Rejected': return this.XIcon;
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

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  getDepartmentName(): string {
    if (!this.orderData) return 'N/A';
    return this.orderData.departmentNameEn || this.orderData.departmentNameAr || 'N/A';
  }

  getPriorityText(priority?: number): string {
    const priorityMap: { [key: number]: string } = {
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Critical'
    };
    return priority ? priorityMap[priority] || 'Low' : 'Low';
  }

  getPriorityClass(priority?: number): string {
    const priorityClassMap: { [key: number]: string } = {
      1: 'text-green-600',
      2: 'text-yellow-600',
      3: 'text-orange-600',
      4: 'text-red-600'
    };
    return priority ? priorityClassMap[priority] || 'text-gray-600' : 'text-gray-600';
  }

  rankOptionLabel = (option: any): string => {
    if (!option) return '';
    return option.nameEn || option.nameAr || '';
  };

  getTotalQuantity(): number {
    return this.supplyItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  canSubmit(): boolean {
    return this.receiverForm.valid && !this.submitting && !this.rejecting;
  }
}


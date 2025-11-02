import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, CheckCircle, Clock, User, Package } from 'lucide-angular';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

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
  lotNumber: string;
  quantity: number;
  expiryDate: Date;
  location: string;
  condition: 'Good' | 'Fair' | 'Near Expiry';
  daysUntilExpiry: number;
  selectedQuantity?: number;
}

export interface OrderItem {
  id: string;
  itemName: string;
  itemType: 'Ammunition' | 'Weapon' | 'Explosive';
  requestedQuantity: number;
  approvedQuantity: number;
  availableLots: LotItem[];
  totalSelectedForDischarge: number;
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
export class SupplyRequestDetailComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;

  issueNo: string = '';
  requestDetail: SupplyRequestDetail | null = null;
  loading: boolean = true;
  
  // Modal state
  isLotModalOpen: boolean = false;
  selectedItem: OrderItem | null = null;
  tempLotSelections: Map<string, number> = new Map();

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.issueNo = this.route.snapshot.params['id'];
    this.loadRequestDetail();
  }

  loadRequestDetail(): void {
    // Simulate API call - replace with actual service call
    setTimeout(() => {
      this.requestDetail = {
        issueNo: this.issueNo,
        requestType: 'Issue',
        priority: 'High',
        requestDate: '10 Sept 2024',
        requesterName: 'Capt. Ahmed Al-Mansoori',
        requesterId: 'MIL-45632',
        requesterRank: 'Captain',
        status: 'Processing',
        approvalWorkflow: [
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
        ],
        items: [
          {
            id: '1',
            itemName: '5.56x45mm NATO Ball Ammunition',
            itemType: 'Ammunition',
            requestedQuantity: 30000,
            approvedQuantity: 30000,
            totalSelectedForDischarge: 0,
            availableLots: [
              {
                lotNumber: 'LOT-2024-001',
                quantity: 5000,
                expiryDate: new Date('2024-12-15'),
                location: 'Warehouse DOH-01 - Section A',
                condition: 'Near Expiry',
                daysUntilExpiry: 45,
                selectedQuantity: 0
              },
              {
                lotNumber: 'LOT-2024-003',
                quantity: 8000,
                expiryDate: new Date('2025-03-20'),
                location: 'Warehouse DOH-01 - Section B',
                condition: 'Good',
                daysUntilExpiry: 140,
                selectedQuantity: 0
              },
              {
                lotNumber: 'LOT-2024-007',
                quantity: 12000,
                expiryDate: new Date('2025-06-10'),
                location: 'Warehouse DOH-02 - Section A',
                condition: 'Good',
                daysUntilExpiry: 222,
                selectedQuantity: 0
              }
            ]
          },
          {
            id: '2',
            itemName: '7.62x51mm NATO Tracer Ammunition',
            itemType: 'Ammunition',
            requestedQuantity: 15000,
            approvedQuantity: 15000,
            totalSelectedForDischarge: 0,
            availableLots: [
              {
                lotNumber: 'LOT-2024-012',
                quantity: 6000,
                expiryDate: new Date('2025-01-10'),
                location: 'Warehouse DOH-01 - Section C',
                condition: 'Fair',
                daysUntilExpiry: 70,
                selectedQuantity: 0
              },
              {
                lotNumber: 'LOT-2024-015',
                quantity: 10000,
                expiryDate: new Date('2025-05-18'),
                location: 'Warehouse DOH-02 - Section B',
                condition: 'Good',
                daysUntilExpiry: 200,
                selectedQuantity: 0
              }
            ]
          },
          {
            id: '3',
            itemName: 'M67 Fragmentation Grenade',
            itemType: 'Explosive',
            requestedQuantity: 200,
            approvedQuantity: 200,
            totalSelectedForDischarge: 0,
            availableLots: [
              {
                lotNumber: 'LOT-2024-020',
                quantity: 100,
                expiryDate: new Date('2026-02-20'),
                location: 'Warehouse DOH-03 - Section A',
                condition: 'Good',
                daysUntilExpiry: 505,
                selectedQuantity: 0
              },
              {
                lotNumber: 'LOT-2024-022',
                quantity: 150,
                expiryDate: new Date('2026-08-15'),
                location: 'Warehouse DOH-03 - Section B',
                condition: 'Good',
                daysUntilExpiry: 682,
                selectedQuantity: 0
              }
            ]
          }
        ]
      };
      
      // Sort lots by expiry date for each item
      this.requestDetail.items.forEach(item => {
        item.availableLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
      });
      
      this.loading = false;
    }, 500);
  }

  goBack(): void {
    this.router.navigate(['/supply-request-management']);
  }

  openLotModal(item: OrderItem): void {
    this.selectedItem = item;
    this.tempLotSelections.clear();
    // Copy current selections to temp
    item.availableLots.forEach(lot => {
      if (lot.selectedQuantity && lot.selectedQuantity > 0) {
        this.tempLotSelections.set(lot.lotNumber, lot.selectedQuantity);
      }
    });
    this.isLotModalOpen = true;
  }

  closeLotModal(): void {
    this.isLotModalOpen = false;
    this.selectedItem = null;
    this.tempLotSelections.clear();
  }

  onTempLotQuantityChange(lotNumber: string, quantity: number): void {
    if (quantity > 0) {
      this.tempLotSelections.set(lotNumber, quantity);
    } else {
      this.tempLotSelections.delete(lotNumber);
    }
  }

  getTempTotalSelected(): number {
    return Array.from(this.tempLotSelections.values())
      .reduce((sum, qty) => sum + qty, 0);
  }

  canConfirmSelection(): boolean {
    if (!this.selectedItem) return false;
    const total = this.getTempTotalSelected();
    return total > 0 && total <= this.selectedItem.approvedQuantity;
  }

  confirmLotSelection(): void {
    if (!this.selectedItem || !this.canConfirmSelection()) return;

    // Apply selections to the item
    this.selectedItem.availableLots.forEach(lot => {
      lot.selectedQuantity = this.tempLotSelections.get(lot.lotNumber) || 0;
    });

    // Update total
    this.selectedItem.totalSelectedForDischarge = this.getTempTotalSelected();

    this.closeLotModal();
  }

  getTotalApproved(): number {
    return this.requestDetail?.items.reduce((sum, item) => sum + item.approvedQuantity, 0) || 0;
  }

  getTotalSelectedForDischarge(): number {
    return this.requestDetail?.items.reduce((sum, item) => sum + item.totalSelectedForDischarge, 0) || 0;
  }

  getTotalRemaining(): number {
    return this.getTotalApproved() - this.getTotalSelectedForDischarge();
  }

  canProcessDischarge(): boolean {
    const total = this.getTotalSelectedForDischarge();
    return total > 0 && total <= this.getTotalApproved();
  }

  onProcessDischarge(): void {
    if (!this.canProcessDischarge()) return;

    const dischargeData = this.requestDetail?.items
      .filter(item => item.totalSelectedForDischarge > 0)
      .map(item => ({
        itemId: item.id,
        itemName: item.itemName,
        totalQuantity: item.totalSelectedForDischarge,
        lots: item.availableLots
          .filter(lot => lot.selectedQuantity && lot.selectedQuantity > 0)
          .map(lot => ({
            lotNumber: lot.lotNumber,
            quantity: lot.selectedQuantity
          }))
      }));

    console.log('Processing discharge:', dischargeData);
    // TODO: Call backend API
    alert(`Discharge processed for ${dischargeData?.length} item(s)`);
  }

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
}

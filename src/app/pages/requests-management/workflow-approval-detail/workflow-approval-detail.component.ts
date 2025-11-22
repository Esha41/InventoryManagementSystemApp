import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, CheckCircle, Clock, User, Package, FileText } from 'lucide-angular';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { BackendAuthService } from '@services/backend-auth.service';

export interface ApprovalStep {
  id: number;
  workflowApprovalstepId?: number;
  workflowStepId?: number;
  oldRequestStatus?: number;
  newRequestStatus?: number;
  comments?: string;
  changedBy?: string;
  changedAt?: string | Date;
  steporder?: number;
  applicationRoleId?: string;
  approverName?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedDate?: string;
  applicationRoleName?: string;
  isPending?: boolean;
  requireHigherApproval?: boolean;
  higherApprovalRoleId?: string;
}

export interface RequestDetail {
  id: number;
  requestNo: string;
  requestType: 'Issue' | 'Return' | 'Discard';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Confirmed' | 'Rejected';
  requestDate: string;
  reason?: string;
  notes?: string;
  departmentName?: string;
  requesterName?: string;
  requesterId?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestItems?: RequestItem[];
  approvalHistory?: ApprovalStep[];
}

export interface RequestItem {
  id: number;
  itemName: string;
  itemNo?: string;
  quantity: number;
  unit?: string;
}

interface BaseRequestDto {
  id: number;
  requestNo: string;
  requestType: number;
  reason?: string;
  priority: number;
  status: number;
  notes?: string;
  departmentId: number;
  requesterId?: string;
  requestPurposeId: number;
  requestDate: string | Date;
  departmentName?: string;
  requesterName?: string;
  requesterUserName?: string;
  requestPurposeName?: string;
  requestItems?: any[];
  approvalHistory?: any[];
  [key: string]: any; // Allow any additional properties
}

@Component({
  selector: 'app-workflow-approval-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './workflow-approval-detail.component.html',
  styleUrls: ['./workflow-approval-detail.component.css']
})
export class WorkflowApprovalDetailComponent implements OnInit {
  readonly ArrowLeft = ArrowLeft;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly User = User;
  readonly Package = Package;
  readonly FileText = FileText;

  requestId: number = 0;
  requestDetail: RequestDetail | null = null;
  loading: boolean = true;
  error: string | null = null;
  
  // Approval/Rejection form
  comments: string = '';
  sendToHigherApproval: boolean = false;
  processing: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: BackendAuthService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    this.requestId = parseInt(id, 10);
    if (isNaN(this.requestId)) {
      this.error = 'Invalid request ID';
      this.loading = false;
      return;
    }
    this.loadRequestDetail();
  }

  loadRequestDetail(): void {
    this.loading = true;
    this.error = null;

    console.log('🔍 Loading Workflow Approval Detail for Request ID:', this.requestId);
    console.log('📡 API Endpoint:', API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS);

    // Get from AllBaseRequests and find the matching one
    this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    ).subscribe({
      next: (response: any) => {
        console.log('✅ API Response Received:', response);
        console.log('📦 Response Type:', Array.isArray(response) ? 'Array' : 'Object');
        
        const data: BaseRequestDto[] = Array.isArray(response) 
          ? response 
          : (response?.data || []);
        
        console.log('📋 Processed Data Array:', data);
        console.log('🔢 Total Requests Found:', data.length);
        
        const baseRequest = data.find(r => r.id === this.requestId);
        
        console.log('🎯 Searching for Request ID:', this.requestId);
        console.log('🔎 Found Request:', baseRequest);
        
        if (!baseRequest) {
          console.warn('⚠️ Request not found in data. Available IDs:', data.map(r => r.id));
          this.error = 'Request not found';
          this.loading = false;
          return;
        }

        console.log('📝 Full BaseRequest Object:', JSON.stringify(baseRequest, null, 2));
        console.log('📊 Approval History:', baseRequest.approvalHistory);
        console.log('📦 Request Items from BaseRequest:', baseRequest.requestItems);

        // Load items from the specific order/return/discard API based on request type
        this.loadRequestItems(baseRequest).then(() => {
          this.requestDetail = this.mapToRequestDetail(baseRequest);
          console.log('✨ Mapped Request Detail:', this.requestDetail);
          this.loading = false;
        }).catch((error) => {
          console.error('❌ Failed to load request items:', error);
          // Still show the request detail even if items fail to load
          this.requestDetail = this.mapToRequestDetail(baseRequest);
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('❌ Failed to load request details:', error);
        console.error('📋 Error Details:', JSON.stringify(error, null, 2));
        this.error = 'Failed to load request details';
        this.loading = false;
      }
    });
  }

  private async loadRequestItems(baseRequest: BaseRequestDto): Promise<void> {
    return new Promise((resolve, reject) => {
      // RequestType enum: 1=Order, 2=Return, 3=Discard
      let endpoint = '';
      
      switch (baseRequest.requestType) {
        case 1: // Order
          endpoint = `/order/${this.requestId}`;
          break;
        case 2: // Return
          endpoint = API_ENDPOINTS.RETURNS.BY_ID(this.requestId);
          break;
        case 3: // Discard
          endpoint = API_ENDPOINTS.DISCARDS.BY_ID(this.requestId);
          break;
        default:
          console.warn('⚠️ Unknown request type:', baseRequest.requestType);
          resolve();
          return;
      }

      console.log('📡 Fetching items from:', endpoint);

      this.apiService.getWithAuth<any>(endpoint).subscribe({
        next: (response: any) => {
          console.log('✅ Items API Response:', response);
          
          // Handle wrapped response (APIOperationResponse format)
          const detailData = response?.data || response;
          
          if (detailData && detailData.requestItems) {
            console.log('📦 Items found in detail API:', detailData.requestItems);
            baseRequest.requestItems = detailData.requestItems;
          } else {
            console.warn('⚠️ No requestItems found in detail API response');
            console.log('📋 Full detail response:', JSON.stringify(detailData, null, 2));
          }
          
          resolve();
        },
        error: (error) => {
          console.error('❌ Failed to load items from detail API:', error);
          // Don't reject - just log the error and continue without items
          resolve();
        }
      });
    });
  }

  private mapToRequestDetail(data: BaseRequestDto): RequestDetail {
    return {
      id: data.id,
      requestNo: data.requestNo,
      requestType: this.mapRequestType(data.requestType),
      priority: this.mapPriority(data.priority),
      status: this.mapStatus(data.status),
      requestDate: this.formatDate(data.requestDate),
      reason: data.reason,
      notes: data.notes,
      departmentName: data.departmentName,
      requesterName: data.requesterName,
      requesterId: data.requesterId,
      requesterUserName: data.requesterUserName,
      requestPurposeName: data.requestPurposeName,
      requestItems: this.mapRequestItems(data.requestItems || []),
      approvalHistory: this.mapApprovalHistory(data.approvalHistory || [])
    };
  }

  private mapRequestItems(items: any[]): RequestItem[] {
    if (!items || items.length === 0) {
      console.log('📦 No request items found in response');
      return [];
    }

    console.log('📦 Mapping request items:', items);

    return items
      .filter(item => item && (item.id || item.itemId))
      .map(item => ({
        id: item.id || 0,
        itemName: item.itemName || item.name || 'Unknown Item',
        itemNo: item.itemNo || item.itemCode || item.code || '-',
        quantity: item.quantity || item.requestedQuantity || 0,
        unit: item.unit || item.unitName || '-'
      }));
  }

  private mapApprovalHistory(history: any[]): ApprovalStep[] {
    // Filter out empty objects and map to ApprovalStep
    return history
      .filter(h => h && (h.id || h.workflowApprovalstepId || h.workflowStepId || h.workflowstepId))
      .map((h, index) => {
        // Check if this is a pending step (IsPending flag or no changedBy)
        const isPending = h.isPending === true || (!h.changedBy && (h.oldRequestStatus === 1 || h.oldRequestStatus === 2));
        
        let status: 'Pending' | 'Approved' | 'Rejected';
        if (isPending) {
          status = 'Pending';
        } else {
          const newStatus = h.newRequestStatus ?? h.oldRequestStatus ?? 0;
          status = this.mapApprovalStatus(newStatus);
        }
        
        // For pending steps, show role name instead of approver name
        const approverName = isPending 
          ? (h.applicationRoleName || h.applicationRoleId || 'Pending Approval')
          : this.getApproverName(h.changedBy);
        
        return {
          id: h.id || index,
          workflowApprovalstepId: h.workflowApprovalstepId,
          workflowStepId: h.workflowStepId || h.workflowstepId,
          oldRequestStatus: h.oldRequestStatus,
          newRequestStatus: h.newRequestStatus,
          comments: h.comments,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
          steporder: h.steporder || h.stepOrder || index + 1,
          applicationRoleId: h.applicationRoleId,
          approverName: approverName,
          status: status,
          approvedDate: h.changedAt && !isPending ? this.formatApprovalDate(h.changedAt) : undefined,
          applicationRoleName: h.applicationRoleName,
          isPending: isPending,
          requireHigherApproval: h.requireHigherApproval || false,
          higherApprovalRoleId: h.higherApprovalRoleId
        };
      })
      .sort((a, b) => (a.steporder || 0) - (b.steporder || 0)); // Sort by step order
  }

  private mapApprovalStatus(status: number): 'Pending' | 'Approved' | 'Rejected' {
    // RequestStatus enum: 1=New, 2=UnderProcess, 3=Approved, 4=Rejected
    switch (status) {
      case 3: return 'Approved';
      case 4: return 'Rejected';
      case 1:
      case 2:
      default: return 'Pending';
    }
  }

  private getApproverName(changedBy?: string): string {
    if (!changedBy) return 'Unknown Approver';
    // Extract name from email or username
    // If it's an email like "don@localhost", extract "don"
    const parts = changedBy.split('@');
    if (parts.length > 0) {
      const name = parts[0];
      // Capitalize first letter
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return changedBy;
  }

  private formatApprovalDate(date: string | Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private mapPriority(priority: number): 'High' | 'Medium' | 'Low' | 'Critical' {
    switch (priority) {
      case 0: return 'Low';
      case 1: return 'Medium';
      case 2: return 'High';
      case 3: return 'Critical';
      default: return 'Low';
    }
  }

  private mapRequestType(type: number): 'Issue' | 'Return' | 'Discard' {
    switch (type) {
      case 1: return 'Issue';
      case 2: return 'Return';
      case 3: return 'Discard';
      default: return 'Issue';
    }
  }

  private mapStatus(status: number): 'Pending' | 'Confirmed' | 'Rejected' {
    switch (status) {
      case 1:
      case 2: return 'Pending';
      case 3: return 'Confirmed';
      case 4: return 'Rejected';
      default: return 'Pending';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';
      case 'Confirmed': return 'bg-[#D1FAE5] text-[#065F46] border-[#10B981]';
      case 'Rejected': return 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
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

  approveRequest(): void {
    if (this.processing || !this.requestDetail) return;
    
    this.processing = true;
    const payload = {
      baseRequestID: this.requestId,
      isApproved: true,
      comments: this.comments || undefined,
      sendToHigherApproval: this.sendToHigherApproval || false,
      action: 3 // RequestStatus.Approved
    };

    console.log('✅ Approving request:', payload);

    this.apiService.postWithAuth(
      API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
      payload
    ).subscribe({
      next: (response: any) => {
        console.log('✅ Approval successful:', response);
        this.comments = '';
        this.sendToHigherApproval = false;
        this.loadRequestDetail(); // Reload to get updated status
        this.processing = false;
      },
      error: (error) => {
        console.error('❌ Approval failed:', error);
        this.error = error?.error?.message || 'Failed to approve request';
        this.processing = false;
      }
    });
  }

  rejectRequest(): void {
    if (this.processing || !this.requestDetail) return;
    
    this.processing = true;
    const payload = {
      baseRequestID: this.requestId,
      isApproved: false,
      comments: this.comments || undefined,
      sendToHigherApproval: this.sendToHigherApproval || false,
      action: 4 // RequestStatus.Rejected
    };

    console.log('❌ Rejecting request:', payload);

    this.apiService.postWithAuth(
      API_ENDPOINTS.WORKFLOW_APPROVAL.APPROVE_REJECT,
      payload
    ).subscribe({
      next: (response: any) => {
        console.log('✅ Rejection successful:', response);
        this.comments = '';
        this.sendToHigherApproval = false;
        this.loadRequestDetail(); // Reload to get updated status
        this.processing = false;
      },
      error: (error) => {
        console.error('❌ Rejection failed:', error);
        this.error = error?.error?.message || 'Failed to reject request';
        this.processing = false;
      }
    });
  }

  canApproveOrReject(): boolean {
    if (!this.requestDetail || this.processing) {
      console.log('🔍 canApproveOrReject: false - no requestDetail or processing');
      return false;
    }
    
    // Don't show buttons if status is not Pending
    if (this.requestDetail.status !== 'Pending') {
      console.log('🔍 canApproveOrReject: false - status is not Pending');
      return false;
    }
    
    // Get current user info
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.log('🔍 canApproveOrReject: false - no current user');
      return false;
    }
    
    const currentUserId = currentUser.id?.toLowerCase() || '';
    const currentUserName = currentUser.userName?.toLowerCase() || '';
    const currentUserEmail = currentUser.email?.toLowerCase() || '';
    
    // Check if current user has already approved or rejected in the approval history
    if (this.requestDetail.approvalHistory && this.requestDetail.approvalHistory.length > 0) {
      const hasUserAlreadyActed = this.requestDetail.approvalHistory.some(step => {
        // Only check steps that have been approved or rejected (not pending)
        if (step.status === 'Approved' || step.status === 'Rejected') {
          const changedBy = step.changedBy?.toLowerCase() || '';
          const approverName = step.approverName?.toLowerCase() || '';
          
          // Check if the changedBy or approverName matches current user
          // Match by user ID, username, or email
          const matchesUserId = currentUserId && changedBy.includes(currentUserId);
          const matchesUserName = currentUserName && (changedBy.includes(currentUserName) || approverName.includes(currentUserName));
          const matchesUserEmail = currentUserEmail && changedBy.includes(currentUserEmail);
          
          if (matchesUserId || matchesUserName || matchesUserEmail) {
            console.log('🔍 User has already acted:', {
              stepStatus: step.status,
              changedBy: step.changedBy,
              approverName: step.approverName,
              currentUserId,
              currentUserName,
              currentUserEmail
            });
            return true;
          }
        }
        return false;
      });
      
      if (hasUserAlreadyActed) {
        console.log('🔍 canApproveOrReject: false - current user has already approved/rejected');
        return false;
      }
    }
    
    // If we reach here, the user hasn't acted yet and status is Pending
    // The backend will handle permission check (only current approver can approve)
    console.log('🔍 canApproveOrReject: true - user can approve/reject');
    return true;
  }

  hasHigherApproval(): boolean {
    if (!this.requestDetail || !this.requestDetail.approvalHistory) {
      return false;
    }

    // Find the current pending step
    const pendingStep = this.requestDetail.approvalHistory.find(step => step.status === 'Pending' && step.isPending);
    
    return pendingStep?.requireHigherApproval === true;
  }

  goBack(): void {
    this.router.navigate(['/requests-management']);
  }
}

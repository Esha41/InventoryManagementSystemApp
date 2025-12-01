import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, AlertTriangle, User, Package, FileText } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { RequestDetail, BaseRequestDto } from '@models/workflow-approval.model';
import { mapToRequestDetail, RequestTypeEnum } from '@utils/request-mapper.utils';
import { ErrorHandler } from '@utils/error-handler.utils';
import { getRequestStatusBadgeClass, getPriorityBadgeClass } from '@utils/status-class.utils';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';

@Component({
  selector: 'app-supply-request-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule, LucideAngularModule, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './supply-request-detail.component.html',
  styleUrls: ['./supply-request-detail.component.css']
})
export class SupplyRequestDetailComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly AlertTriangle = AlertTriangle;
  readonly User = User;
  readonly Package = Package;
  readonly FileText = FileText;

  private readonly destroy$ = new Subject<void>();

  requestId: number = 0;
  requestDetail: RequestDetail | null = null;
  loading: boolean = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = parseInt(params['id'], 10);
        if (isNaN(id)) {
          this.error = 'Invalid request ID';
          this.loading = false;
          return;
        }
        this.requestId = id;
        this.loadRequestDetail();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRequestDetail(): void {
    this.loading = true;
    this.error = null;

    this.apiService.getWithAuth<BaseRequestDto[]>(
      API_ENDPOINTS.WORKFLOW_APPROVAL.ALL_BASE_REQUESTS
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (response: any) => {
        const data: BaseRequestDto[] = Array.isArray(response) 
          ? response 
          : (response?.data || []);
        
        const baseRequest = data.find(r => r.id === this.requestId);
        
        if (!baseRequest) {
          this.error = 'Request not found';
          this.loading = false;
          return;
        }

        // Load items from the specific order/return/discard API based on request type
        this.loadRequestItems(baseRequest).then(() => {
          this.requestDetail = mapToRequestDetail(baseRequest);
          this.loading = false;
        }).catch(() => {
          // Still show the request detail even if items fail to load
          this.requestDetail = mapToRequestDetail(baseRequest);
          this.loading = false;
        });
      },
      error: (error) => {
        this.error = ErrorHandler.extractErrorMessage(error, 'Failed to load request details');
        this.loading = false;
      }
    });
  }

  private async loadRequestItems(baseRequest: BaseRequestDto): Promise<void> {
    return new Promise((resolve) => {
      let endpoint = '';
      
      switch (baseRequest.requestType) {
        case RequestTypeEnum.Order:
          endpoint = `/order/${this.requestId}`;
          break;
        case RequestTypeEnum.Return:
          endpoint = API_ENDPOINTS.RETURNS.BY_ID(this.requestId);
          break;
        case RequestTypeEnum.Discard:
          endpoint = API_ENDPOINTS.DISCARDS.BY_ID(this.requestId);
          break;
        default:
          resolve();
          return;
      }

      this.apiService.getWithAuth<any>(endpoint)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            const detailData = response?.data || response;
            
            if (detailData && detailData.requestItems) {
              baseRequest.requestItems = detailData.requestItems;
            }
            
            resolve();
          },
          error: () => {
            // Don't reject - just continue without items
            resolve();
          }
        });
    });
  }

  getStatusClass(status: string): string {
    return getRequestStatusBadgeClass(status);
  }

  getPriorityClass(priority: string): string {
    return getPriorityBadgeClass(priority);
  }

  goBack(): void {
    this.router.navigate(['/supply-request-management']);
  }

  get errorTitle(): string {
    return 'supplyRequestManagement.detail.errorLoading';
  }
}


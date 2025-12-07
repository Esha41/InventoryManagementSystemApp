import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, ArrowLeft, ArrowRight } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { AmmunitionService } from '@services/ammunition.service';
import { CartridgeMapperService } from '@services/cartridge-mapper.service';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { CartridgeDetailsComponent } from '@pages/new-issue-request/components/cartridge-details/cartridge-details.component';
import { LoadingStateComponent, ErrorStateComponent } from '@components/index';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    CartridgeDetailsComponent,
    LoadingStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.css']
})
export class ItemDetailComponent implements OnInit, OnDestroy {
  readonly ArrowLeft = ArrowLeft;
  readonly ArrowRight = ArrowRight;
  
  private readonly destroy$ = new Subject<void>();
  
  itemId: number = 0;
  requestId: number | null = null;
  cartridge: Cartridge | null = null;
  loading: boolean = true;
  error: string | null = null;

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get backIcon() {
    return this.isRTL ? ArrowRight : ArrowLeft;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ammunitionService: AmmunitionService,
    private cartridgeMapper: CartridgeMapperService,
    private toastService: ToastService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Get item ID from route params
    this.route.params
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = params['id'];
        if (id) {
          this.itemId = parseInt(id, 10);
          if (!isNaN(this.itemId) && this.itemId > 0) {
            this.loadItemDetails();
          } else {
            this.error = 'Invalid item ID';
            this.loading = false;
          }
        } else {
          this.error = 'Item ID not provided';
          this.loading = false;
        }
      });

    // Get request ID from query params for navigation back
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(queryParams => {
        const requestIdParam = queryParams['requestId'];
        if (requestIdParam) {
          this.requestId = parseInt(requestIdParam, 10);
          if (isNaN(this.requestId) || this.requestId <= 0) {
            this.requestId = null;
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadItemDetails(): void {
    this.loading = true;
    this.error = null;

    this.ammunitionService.getById<any>(this.itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (data) {
            this.cartridge = this.cartridgeMapper.mapAmmunitionToCartridge(data);
            this.loading = false;
          } else {
            this.error = 'Item not found';
            this.loading = false;
          }
        },
        error: (err) => {
          console.error('Failed to load item details:', err);
          this.error = 'Failed to load item details. Please try again.';
          this.loading = false;
          this.toastService.error('Failed to load item details');
        }
      });
  }

  goBack(): void {
    // Navigate back to the approval page if requestId is available, otherwise go to requests list
    if (this.requestId) {
      this.router.navigate(['/requests-management', this.requestId, 'workflow-approval']);
    } else {
      this.router.navigate(['/requests-management']);
    }
  }
}


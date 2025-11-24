import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, Package } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';

import { SupplyService, SupplyDto } from '@services/supply.service';
import { ToastService } from '@services/toast.service';
import { getSubmissionStatusText, getSubmissionStatusClass } from '@utils/status.utils';

@Component({
  selector: 'app-supply-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  templateUrl: './supply-order-list.component.html',
  styleUrls: ['./supply-order-list.component.css']
})
export class SupplyOrderListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  supplies: SupplyDto[] = [];
  loading: boolean = true;

  constructor(
    private router: Router,
    private supplyService: SupplyService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSupplies();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSupplies(): void {
    this.loading = true;
    this.supplyService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (supplies) => {
          this.supplies = supplies;
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load supplies:', error);
          this.toastService.error('Failed to load supplies');
          this.loading = false;
        }
      });
  }

  viewSupply(supply: SupplyDto): void {
    this.router.navigate(['/supply-order', supply.id]);
  }

  getStatusText = getSubmissionStatusText;
  getStatusClass = getSubmissionStatusClass;
}


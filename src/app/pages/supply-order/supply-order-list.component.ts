import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LucideAngularModule, Search, Package } from 'lucide-angular';
import { SupplyService, SupplyDto } from '@services/supply.service';
import { ToastService } from '@services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-supply-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, LucideAngularModule],
  template: `
    <div class="min-h-screen bg-gray-50 p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text)]">{{ 'supplyOrder.listTitle' | translate }}</h1>
      </div>

      <div *ngIf="loading" class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--color-brand)]"></div>
      </div>

      <div *ngIf="!loading" class="bg-white rounded-lg shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead class="bg-white border-b border-gray-200">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supply ID</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Number</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                <th class="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let supply of supplies" class="border-b border-gray-200 hover:bg-gray-50">
                <td class="px-6 py-4 text-sm font-medium text-gray-900">#{{ supply.id }}</td>
                <td class="px-6 py-4 text-sm text-gray-700">{{ supply.order?.requestNo || supply.order?.orderNo || 'N/A' }}</td>
                <td class="px-6 py-4 text-sm">
                  <span class="px-2 py-1 rounded-md text-xs font-medium"
                        [ngClass]="getStatusClass(supply.submissionStatus)">
                    {{ getStatusText(supply.submissionStatus) }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-700">{{ supply.supplyDetails.length }}</td>
                <td class="px-6 py-4 text-right">
                  <button
                    (click)="viewSupply(supply)"
                    class="px-4 py-2 text-sm font-medium text-white bg-[var(--color-brand)] rounded-lg hover:bg-[var(--color-brand-dark)] transition-colors">
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: []
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

  getStatusText(status: number): string {
    const statusMap: { [key: number]: string } = {
      0: 'Draft',
      1: 'Submitted',
      2: 'Approved',
      3: 'Rejected'
    };
    return statusMap[status] || 'Unknown';
  }

  getStatusClass(status: number): string {
    const classMap: { [key: number]: string } = {
      0: 'bg-gray-100 text-gray-800 border border-gray-300',
      1: 'bg-blue-100 text-blue-800 border border-blue-300',
      2: 'bg-green-100 text-green-800 border border-green-300',
      3: 'bg-red-100 text-red-800 border border-red-300'
    };
    return classMap[status] || 'bg-gray-100 text-gray-800';
  }
}


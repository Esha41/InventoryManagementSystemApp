import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-inventory-forecast',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './inventory-forecast.component.html',
  styleUrls: ['./inventory-forecast.component.css']
})
export class InventoryForecastComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('currentStockChart') currentStockChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activityChart') activityChart!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  ngOnInit(): void {
    console.log('Inventory Forecast component initialized');
  }

  ngAfterViewInit(): void {
    // Small delay to ensure view is ready for animations
    setTimeout(() => {
      this.createCurrentStockChart();
      this.createActivityChart();
    }, 100);
  }

  private createCurrentStockChart(): void {
    const ctx = this.currentStockChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            data: [75, 78, 82, 80, 84, 86],
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 2000,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          scales: {
            y: {
              display: false,
              min: 70,
              max: 90
            },
            x: {
              display: false,
              grid: { display: false }
            }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  private createActivityChart(): void {
    const ctx = this.activityChart.nativeElement.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            data: [20, 25, 28, 30, 32, 34],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 2000,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          scales: {
            y: {
              display: false,
              min: 15,
              max: 40
            },
            x: {
              display: false,
              grid: { display: false }
            }
          }
        }
      });
      this.charts.push(chart);
    }
  }

  ngOnDestroy(): void {
    this.charts.forEach(chart => chart.destroy());
  }
}

